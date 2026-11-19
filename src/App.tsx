import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from './components/Board';
import { gameStatus, replay, type Color, type Move } from './lib/chess';
import { useLobby, type Player, type Room, type ServerMessage } from './lib/lobby';
import { clearProfile, createId, fileToAvatar, loadProfile, saveProfile, type Profile } from './lib/profile';
import { playMoveSound } from './lib/sound';

type Screen = 'identity' | 'menu' | 'join' | 'search' | 'room';

/* ---------- icons ---------- */

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12.5 19V5L7.2 9.5H4Z" />
    <path d="M16 9a4.5 4.5 0 0 1 0 6" />
    <path d="M18.7 6.2a8.2 8.2 0 0 1 0 11.6" />
  </svg>
);

const MutedIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12.5 19V5L7.2 9.5H4Z" />
    <path d="m16.2 9.8 4.4 4.4M20.6 9.8l-4.4 4.4" />
  </svg>
);

const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9.5 4H4v5.5" />
    <path d="M14.5 4H20v5.5" />
    <path d="M14.5 20H20v-5.5" />
    <path d="M9.5 20H4v-5.5" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m14.5 5.5-7 6.5 7 6.5" />
  </svg>
);

/* ---------- fullscreen ---------- */

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

async function toggleFullscreen() {
  const doc = document as FullscreenDocument;
  const element = document.documentElement as FullscreenElement;
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
      return;
    }
    if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: 'hide' });
    else await element.webkitRequestFullscreen?.();
  } catch {
    /* iOS Safari refuses on non-video elements — the layout already fills the screen */
  }
}

/* ---------- player row ---------- */

function PlayerRow({ player, you }: { player?: Player; you: string }) {
  return (
    <div className={`row${player ? '' : ' row-empty'}`}>
      <div className="pfp tiny">
        {player ? player.avatar ? <img src={player.avatar} alt="" /> : player.name.slice(0, 1).toUpperCase() : '?'}
      </div>
      <span className="row-name">
        {player ? (player.id === you ? `${player.name} (you)` : player.name) : 'Empty'}
      </span>
    </div>
  );
}

/* ---------- identity ---------- */

function IdentityScreen({
  initial,
  onSubmit,
}: {
  initial: Profile | null;
  onSubmit: (profile: Profile) => void;
}) {
  const idRef = useRef(initial?.id ?? createId());
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar ?? null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const ready = trimmed.length >= 2;

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      setAvatar(await fileToAvatar(file));
    } catch {
      /* unsupported image — keep whatever is there */
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (!ready) return;
    onSubmit({ id: idRef.current, name: trimmed, avatar });
  };

  return (
    <div className="screen">
      <h1 className="title">Chess</h1>

      <div className="setup">
        <button
          type="button"
          className="pfp"
          onClick={() => fileRef.current?.click()}
          aria-label="Choose a profile picture"
        >
          {avatar ? <img src={avatar} alt="" /> : <span>{loading ? '' : '+'}</span>}
        </button>
        <div className="setup-field">
          <label className="label" htmlFor="player-name">
            Name
          </label>
          <input
            id="player-name"
            className="field"
            value={name}
            maxLength={16}
            placeholder="Name"
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
        </div>
      </div>

      {avatar && (
        <button type="button" className="link" onClick={() => setAvatar(null)}>
          Remove picture
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void pickAvatar(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <button className="btn primary push" disabled={!ready} onClick={submit}>
        Continue
      </button>
    </div>
  );
}

/* ---------- menu ---------- */

function MenuScreen({
  profile,
  onFind,
  onCreate,
  onJoin,
  onEdit,
  onResign,
}: {
  profile: Profile;
  onFind: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onEdit: () => void;
  onResign: () => void;
}) {
  return (
    <div className="screen">
      <div className="me">
        <div className="pfp small">
          {profile.avatar ? <img src={profile.avatar} alt="" /> : profile.name.slice(0, 1).toUpperCase()}
        </div>
        <span className="me-name">{profile.name}</span>
        <button className="link" onClick={onEdit}>
          Edit
        </button>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onFind}>
          Find random match
        </button>
        <button className="btn" onClick={onCreate}>
          Create match
        </button>
        <button className="btn" onClick={onJoin}>
          Join match
        </button>
      </div>

      <button className="dev-resign push" onClick={onResign}>
        Click here to resign ! FOR DEV!
      </button>
    </div>
  );
}

/* ---------- join ---------- */

function JoinScreen({ busy, onJoin }: { busy: boolean; onJoin: (code: string) => void }) {
  const [code, setCode] = useState('');
  const ready = code.length >= 4;

  return (
    <div className="screen">
      <div className="setup-field">
        <label className="label" htmlFor="join-code">
          Code
        </label>
        <input
          id="join-code"
          className="field code-input"
          value={code}
          maxLength={5}
          placeholder="CODE"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          onChange={(event) =>
            setCode(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 5),
            )
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' && ready && !busy) onJoin(code);
          }}
        />
      </div>

      <button className="btn primary push" disabled={!ready || busy} onClick={() => onJoin(code)}>
        {busy ? 'Joining...' : 'Join match'}
      </button>
    </div>
  );
}

/* ---------- searching ---------- */

function SearchScreen({ onCancel }: { onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="screen">
      <div className="searching">
        <span className="spinner" />
        <span>Searching...</span>
        <span className="muted">{seconds}s</span>
      </div>
      <button className="btn ghost push" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/* ---------- game ---------- */

function GameScreen({
  room,
  moves,
  profile,
  onMove,
  onCopy,
  onRematch,
}: {
  room: Room;
  moves: Move[];
  profile: Profile;
  onMove: (move: Move) => void;
  onCopy: () => void;
  onRematch: () => void;
}) {
  const state = useMemo(() => replay(moves), [moves]);
  const solo = room.solo === true;
  const myIndex = room.players.findIndex((player) => player.id === profile.id);
  const myColor: Color = myIndex === 1 ? 'b' : 'w';
  const opponent = room.players.find((player) => player.id !== profile.id);
  const status = gameStatus(state);
  const side = state.turn === 'w' ? 'white' : 'black';
  const over = status === 'checkmate' || status === 'stalemate';

  const label = solo
    ? status === 'checkmate'
      ? `checkmate · ${state.turn === 'w' ? 'black' : 'white'} won`
      : status === 'stalemate'
        ? 'stalemate · draw'
        : status === 'check'
          ? `${side} in check`
          : `${side} to move`
    : status === 'checkmate'
      ? state.turn === myColor
        ? 'checkmate · you lost'
        : 'checkmate · you won'
      : status === 'stalemate'
        ? 'stalemate · draw'
        : status === 'check'
          ? 'check'
          : state.turn === myColor
            ? 'your move'
            : 'waiting';

  const opponentName = solo ? profile.name : (opponent?.name ?? 'opponent');
  const myName = profile.name;
  const opponentAvatar = solo ? profile.avatar : (opponent?.avatar ?? null);
  const opponentFace = opponentAvatar ? (
    <img src={opponentAvatar} alt="" />
  ) : (
    solo ? 'B' : opponentName.slice(0, 1).toUpperCase()
  );
  const myFace = profile.avatar ? <img src={profile.avatar} alt="" /> : (solo ? 'W' : myName.slice(0, 1).toUpperCase());

  return (
    <div className="game">
      <div className="pcard">
        <div className="pfp mid">{opponentFace}</div>
        <div className="meta">
          <strong>{opponentName}</strong>
          <span>{solo ? 'you · black' : 'opponent'}</span>
        </div>
        <button className="chip" onClick={onCopy} aria-label={`Table code ${room.code}, tap to copy`}>
          {room.code}
        </button>
      </div>

      <Board state={state} myColor={myColor} solo={solo} onMove={onMove} />

      <div className="pcard">
        <div className="pfp mid">{myFace}</div>
        <div className="meta">
          <strong>{myName}</strong>
          <span className={over ? 'over' : undefined}>{label}</span>
        </div>
        {(over || solo) && (
          <button className="chip" onClick={onRematch}>
            {solo ? 'new game' : 'rematch'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- room ---------- */

function RoomScreen({
  room,
  you,
  onCopy,
  onLeave,
}: {
  room: Room | null;
  you: string;
  onCopy: () => void;
  onLeave: () => void;
}) {
  if (!room) {
    return (
      <div className="screen">
        <div className="searching">
          <span className="spinner" />
          <span>Creating table...</span>
        </div>
      </div>
    );
  }

  const full = room.players.length >= room.capacity;

  return (
    <div className="screen">
      <div className="setup-field">
        <span className="label">Code</span>
        <button className="code" onClick={onCopy} aria-label={`Table code ${room.code}, tap to copy`}>
          {room.code}
        </button>
      </div>

      <div className="players">
        <PlayerRow player={room.players[0]} you={you} />
        <PlayerRow player={room.players[1]} you={you} />
      </div>

      <p className="muted">
        {room.players.length} / {room.capacity} players
      </p>
      {full && <p className="ready">match ready</p>}

      <div className="actions push">
        <button className="btn" onClick={onCopy}>
          Copy code
        </button>
        <button className="btn ghost" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const startingProfile = useRef<Profile | null>(loadProfile());
  const [profile, setProfile] = useState<Profile | null>(startingProfile.current);
  const [screen, setScreen] = useState<Screen>(startingProfile.current ? 'menu' : 'identity');
  const [room, setRoom] = useState<Room | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [joinBusy, setJoinBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [musicOn, setMusicOn] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // moves already shown on this board that the server has not echoed yet
  const pendingMoves = useRef<Move[]>([]);

  roomRef.current = room;

  const notify = useCallback((text: string) => setToast({ id: Date.now(), text }), []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.t) {
        case 'room':
          pendingMoves.current = [];
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
          break;
        default:
          break;
      }
    },
    [notify],
  );

  const { send } = useLobby(handleMessage);

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

  // true only while the player wants music; used to undo browser interruptions
  const wantMusicRef = useRef(false);

  const startMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    wantMusicRef.current = true;
    audio
      .play()
      .then(() => setMusicOn(true))
      .catch(() => setMusicOn(false));
  }, []);

  // Browsers and slow connections like to pause or starve a background track
  // (fullscreen changes, tab switches, a stalled stream). If the player never
  // asked for silence, quietly pick it back up.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const resume = () => {
      if (!wantMusicRef.current || !audio.paused) return;
      void audio.play().catch(() => {
        /* still blocked by the browser; the next gesture retries */
      });
    };

    // A dropped stream should not silence the menu for good, but reloading on
    // every error event makes the track stutter — retry once, after a beat.
    let retry: number | undefined;
    const retryAfterError = () => {
      if (!wantMusicRef.current) return;
      window.clearTimeout(retry);
      retry = window.setTimeout(() => {
        if (!wantMusicRef.current) return;
        audio.load();
        void audio.play().catch(() => undefined);
      }, 1200);
    };

    audio.addEventListener('pause', resume);
    audio.addEventListener('error', retryAfterError);

    return () => {
      window.clearTimeout(retry);
      audio.removeEventListener('pause', resume);
      audio.removeEventListener('error', retryAfterError);
    };
  }, []);

  // Music belongs to the lobby: silence it the moment the board appears, and
  // bring it back if the player returns to the menu afterwards.
  const inGame =
    screen === 'room' && room !== null && (room.solo === true || room.players.length >= 2);
  const resumeAfterMatchRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (inGame) {
      if (!audio.paused || wantMusicRef.current) {
        resumeAfterMatchRef.current = wantMusicRef.current;
        wantMusicRef.current = false;
        audio.pause();
        setMusicOn(false);
      }
      return;
    }

    if (resumeAfterMatchRef.current) {
      resumeAfterMatchRef.current = false;
      startMusic();
    }
  }, [inGame, startMusic]);

  // The board artwork is the one image the board waits for: fetch it while the
  // player is still in the menu so the board paints from cache.
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

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      startMusic();
    } else {
      wantMusicRef.current = false;
      audio.pause();
      setMusicOn(false);
    }
  };

  const saveIdentity = (next: Profile) => {
    setProfile(next);
    saveProfile(next);
    setScreen('menu');
  };

  const resign = () => {
    send({ t: 'leave' });
    setRoom(null);
    setJoinBusy(false);
    clearProfile();
    setProfile(null);
    setScreen('identity');
  };

  const leaveTable = () => {
    send({ t: 'leave' });
    setRoom(null);
    setMoves([]);
    setJoinBusy(false);
    setScreen('menu');
  };

  const startFind = () => {
    if (!profile) return;
    setRoom(null);
    setScreen('search');
    send({ t: 'find', id: profile.id, name: profile.name, avatar: profile.avatar });
  };

  const startCreate = () => {
    if (!profile) return;
    setRoom(null);
    setScreen('room');
    send({ t: 'create', id: profile.id, name: profile.name, avatar: profile.avatar });
  };

  const submitJoin = (code: string) => {
    if (!profile) return;
    setJoinBusy(true);
    send({ t: 'join', code, id: profile.id, name: profile.name, avatar: profile.avatar });
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      notify(`${room.code} copied`);
    } catch {
      notify(room.code);
    }
  };

  const canGoBack = screen !== 'identity' && screen !== 'menu';

  return (
    <div className={`app${inGame ? ' in-game' : ''}`}>
      <div className="shell">
        <header className="bar">
          {canGoBack ? (
            <button
              className="icon"
              aria-label="Back"
              onClick={() => (screen === 'room' || screen === 'search' ? leaveTable() : setScreen('menu'))}
            >
              <BackIcon />
            </button>
          ) : (
            <span className="logo">Chess</span>
          )}
          <span className="grow" />
          <button
            className={`icon${musicOn ? ' active' : ''}`}
            aria-label={musicOn ? 'Pause music' : 'Play music'}
            onClick={toggleMusic}
          >
            {musicOn ? <SpeakerIcon /> : <MutedIcon />}
          </button>
          <button className="icon" aria-label="Toggle full screen" onClick={() => void toggleFullscreen()}>
            <FullscreenIcon />
          </button>
        </header>

        {screen === 'identity' && <IdentityScreen initial={profile} onSubmit={saveIdentity} />}

        {screen === 'menu' && profile && (
          <MenuScreen
            profile={profile}
            onFind={startFind}
            onCreate={startCreate}
            onJoin={() => setScreen('join')}
            onEdit={() => setScreen('identity')}
            onResign={resign}
          />
        )}

        {screen === 'join' && <JoinScreen busy={joinBusy} onJoin={submitJoin} />}

        {screen === 'search' && <SearchScreen onCancel={leaveTable} />}

        {screen === 'room' && inGame && room && profile && (
          <GameScreen
            room={room}
            moves={moves}
            profile={profile}
            onMove={queueMove}
            onCopy={() => void copyCode()}
            onRematch={() => send({ t: 'rematch' })}
          />
        )}

        {screen === 'room' && !inGame && (
          <RoomScreen room={room} you={profile?.id ?? ''} onCopy={() => void copyCode()} onLeave={leaveTable} />
        )}
      </div>

      <audio ref={audioRef} src="/assets/chess.m4a" loop preload="auto" playsInline />

      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
