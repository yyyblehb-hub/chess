import { useCallback, useEffect, useRef, useState } from 'react';
import GamePanel, { type ChatLine } from './components/GamePanel';
import GameScreen from './components/GameScreen';
import TopBar from './components/TopBar';
import { toggleFullscreen } from './components/chrome';
import { JoinScreen, MenuScreen, RoomScreen, SearchScreen } from './screens/lobby';
import { SettingsScreen } from './screens/setup';
import AuthScreen from './screens/Auth';
import { useSession } from './lib/auth';
import { type Move } from './lib/chess';
import { useLobby, type Room, type ServerMessage } from './lib/lobby';
import { useMusic } from './lib/music';
import { clearProfile, loadProfile, loadTrack, saveProfile, type Profile, type TrackId } from './lib/profile';
import { playMoveSound } from './lib/sound';

type Screen = 'auth' | 'menu' | 'settings' | 'join' | 'search' | 'room';

/* ---------- app ---------- */

export default function App() {
  const { account, token, ready, adopt, forget } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>('auth');
  const [room, setRoom] = useState<Room | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [joinBusy, setJoinBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [panel, setPanel] = useState<'chat' | 'moves' | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  // messages that landed while the chat was not on screen
  const [unread, setUnread] = useState(0);
  const [track, setTrack] = useState<TrackId>(loadTrack());

  const roomRef = useRef<Room | null>(null);
  const panelRef = useRef<'chat' | 'moves' | null>(null);
  const profileRef = useRef<Profile | null>(profile);
  // moves already shown on this board that the server has not echoed yet
  const pendingMoves = useRef<Move[]>([]);

  roomRef.current = room;
  panelRef.current = panel;
  profileRef.current = profile;

  const notify = useCallback((text: string) => setToast({ id: Date.now(), text }), []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.t) {
        case 'room':
          pendingMoves.current = [];
          if (roomRef.current?.code !== message.room.code) {
            setChat([]);
            setUnread(0);
            setPanel(null);
          }
          setRoom(message.room);
          setMoves(message.room.moves ?? []);
          setJoinBusy(false);
          setScreen('room');
          break;
        case 'move': {
          // our own move is already on the board; the echo just confirms it
          const pending = pendingMoves.current;
          const echoed = pending.findIndex(
            (move) =>
              move.from === message.move.from &&
              move.to === message.move.to &&
              (move.promotion ?? '') === (message.move.promotion ?? ''),
          );
          if (echoed !== -1) {
            pending.splice(0, echoed + 1);
            break;
          }
          playMoveSound();
          setMoves((current) => [...current, message.move]);
          break;
        }
        case 'title':
          setProfile((current) => {
            if (!current || current.title === message.title) return current;
            const next = { ...current, title: message.title };
            saveProfile(next);
            return next;
          });
          break;
        case 'chat':
          setChat((current) => [
            ...current,
            {
              // a server that predates the id/at fields still works: the name
              // decides the side and the time is when it landed here
              id:
                message.id ??
                (profileRef.current && message.from === profileRef.current.name
                  ? profileRef.current.id
                  : `other:${message.from}`),
              from: message.from,
              text: message.text,
              at: message.at ?? Date.now(),
            },
          ]);
          if (panelRef.current !== 'chat') setUnread((count) => count + 1);
          break;
        case 'shoot':
          // the emptied square rides with the room, so a review shows it too
          setRoom((current) => (current ? { ...current, shots: message.shots } : current));
          break;
        case 'notice':
          notify(message.message);
          break;
        case 'error':
          setJoinBusy(false);
          notify(message.message);
          if (!roomRef.current) setScreen((current) => (current === 'search' ? 'menu' : current));
          break;
        case 'left':
          setRoom(null);
          setMoves([]);
          setPanel(null);
          setUnread(0);
          break;
        default:
          break;
      }
    },
    [notify],
  );

  const { connected, send } = useLobby(handleMessage, token, forget);

  // a signed-in account is the identity: id, name and title all come from it
  useEffect(() => {
    if (!account) {
      setProfile(null);
      setScreen('auth');
      return;
    }
    const saved = loadProfile();
    const next: Profile = {
      id: account.id,
      name: account.name,
      avatar: saved?.avatar ?? null,
      tag: saved?.tag ?? null,
      title: account.title,
    };
    setProfile(next);
    saveProfile(next);
    setScreen((current) => (current === 'auth' ? 'menu' : current));
  }, [account]);

  // Tell the server who we are as soon as the socket is up. That sign-in is what
  // earns the titles, and the very first player ever gets GM.
  useEffect(() => {
    const current = profileRef.current;
    if (!connected || !current) return;
    send({ t: 'hello', id: current.id, name: current.name, avatar: current.avatar, tag: current.tag ?? null });
  }, [connected, profile?.id, send]);

  // Land the move on the frame it is tapped. The server echo only confirms it;
  // if the move turns out to be illegal the server answers with a room
  // snapshot, which puts the board and the pending list back in step.
  const queueMove = useCallback(
    (move: Move) => {
      pendingMoves.current.push(move);
      playMoveSound();
      setMoves((current) => [...current, move]);
      send({ t: 'move', move });
    },
    [send],
  );

  // A match silences the lobby song; leaving the board brings it back.
  const inGame =
    screen === 'room' &&
    room !== null &&
    (room.solo === true || room.players.length >= 2 || room.moves.length > 0);

  const { audioRef, musicOn, startMusic, toggleMusic, pickTrack } = useMusic(track, inGame);

  // fetch the board artwork during the menu so the board paints from cache
  useEffect(() => {
    const image = new Image();
    image.src = '/assets/board-wood.jpg';
  }, []);

  // First tap anywhere: go fullscreen and start the music (browsers need a gesture).
  useEffect(() => {
    const onFirstGesture = () => {
      void toggleFullscreen();
      startMusic();
      window.removeEventListener('pointerdown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture);
    return () => window.removeEventListener('pointerdown', onFirstGesture);
  }, [startMusic]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveTag = (next: Profile) => {
    setProfile(next);
    saveProfile(next);
  };

  const selectTrack = (next: TrackId) => {
    setTrack(next);
    pickTrack(next);
  };

  const resign = () => {
    send({ t: 'leave' });
    setRoom(null);
    setJoinBusy(false);
    setPanel(null);
    setChat([]);
    setUnread(0);
    clearProfile();
    setProfile(null);
    setScreen('auth');
    forget();
  };

  const leaveTable = () => {
    send({ t: 'leave' });
    setRoom(null);
    setMoves([]);
    setJoinBusy(false);
    setPanel(null);
    setChat([]);
    setUnread(0);
    setScreen('menu');
  };

  const sendChat = (text: string) => {
    send({ t: 'chat', text });
  };

  // chess.com's "Find new match": leave this table and queue for the next one
  const newMatch = () => {
    if (!profile) return;
    leaveTable();
    setScreen('search');
    send({ t: 'find', id: profile.id, name: profile.name, avatar: profile.avatar, tag: profile.tag ?? null });
  };

  const startFind = () => {
    if (!profile) return;
    setRoom(null);
    setScreen('search');
    send({ t: 'find', id: profile.id, name: profile.name, avatar: profile.avatar, tag: profile.tag ?? null });
  };

  const startCreate = () => {
    if (!profile) return;
    setRoom(null);
    setScreen('room');
    send({ t: 'create', id: profile.id, name: profile.name, avatar: profile.avatar, tag: profile.tag ?? null });
  };

  const submitJoin = (code: string) => {
    if (!profile) return;
    setJoinBusy(true);
    send({ t: 'join', code, id: profile.id, name: profile.name, avatar: profile.avatar, tag: profile.tag ?? null });
  };

  // copying stays silent: the code is already on screen, so no popup
  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      /* clipboard blocked — the code is readable on screen anyway */
    }
  };

  const canGoBack = screen !== 'auth' && screen !== 'menu';

  // a stored session is checked before the first screen paints
  if (!ready) return null;

  return (
    <div className={`app${inGame ? ' in-game' : ''}`}>
      <div className="shell">
        <TopBar
          onBack={
            canGoBack
              ? () => (screen === 'room' || screen === 'search' ? leaveTable() : setScreen('menu'))
              : null
          }
          inGame={inGame}
          solo={room?.solo === true}
          panelOpen={panel !== null}
          unread={unread}
          musicOn={musicOn}
          onChat={() => {
            setPanel('chat');
            setUnread(0);
          }}
          onMusic={toggleMusic}
          onFullscreen={() => void toggleFullscreen()}
        />

        {screen === 'auth' && <AuthScreen onAuthed={adopt} />}

        {screen === 'menu' && profile && (
          <MenuScreen
            profile={profile}
            onFind={startFind}
            onJoin={() => setScreen('join')}
            onSettings={() => setScreen('settings')}
            onResign={resign}
          />
        )}

        {screen === 'settings' && profile && (
          <SettingsScreen
            profile={profile}
            track={track}
            onChange={saveTag}
            onTrack={selectTrack}
            onSignOut={resign}
          />
        )}

        {screen === 'join' && <JoinScreen busy={joinBusy} onJoin={submitJoin} onCreate={startCreate} />}

        {screen === 'search' && <SearchScreen onCancel={leaveTable} />}

        {screen === 'room' && inGame && room && profile && (
          <GameScreen
            room={room}
            moves={moves}
            profile={profile}
            onMove={queueMove}
            onCopy={() => void copyCode()}
            onRematch={() => send({ t: 'rematch' })}
            onLeave={newMatch}
            onShoot={(square) => send({ t: 'shoot', square })}
          />
        )}

        {screen === 'room' && !inGame && (
          <RoomScreen room={room} you={profile?.id ?? ''} onCopy={() => void copyCode()} onLeave={leaveTable} />
        )}

        {inGame && room && panel && (
          <GamePanel
            view={panel === 'chat' && room.solo === true ? 'moves' : panel}
            lines={chat}
            moves={moves}
            me={profile?.id ?? ''}
            unread={unread}
            canChat={room.solo !== true}
            onView={(next) => {
              setPanel(next);
              if (next === 'chat') setUnread(0);
            }}
            onSend={sendChat}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      <audio ref={audioRef} loop preload="auto" playsInline />

      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
