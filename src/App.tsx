import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from './components/Board';
import { gameStatus, replay, type Color, type Move } from './lib/chess';
import { useLobby, type Player, type Room, type ServerMessage } from './lib/lobby';
import {
  clearProfile,
  fileToAvatar,
  fileToTag,
  loadId,
  loadProfile,
  loadTrack,
  saveProfile,
  saveTrack,
  type Profile,
  type TrackId,
} from './lib/profile';
import { playMoveSound } from './lib/sound';

type Screen = 'identity' | 'menu' | 'settings' | 'join' | 'search' | 'room';

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

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 12.5a6.8 6.8 0 0 1-7.5 6.8 8.6 8.6 0 0 1-2.6-.6L5.5 20l.9-3.2A6.6 6.6 0 0 1 4.5 12.5 6.8 6.8 0 0 1 12 5.7a6.8 6.8 0 0 1 8 6.8Z" />
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

/* ---------- picture tag ---------- */

function NameTag({ tag }: { tag?: string | null }) {
  return tag ? <img className="tag" src={tag} alt="" /> : null;
}

/* ---------- player row ---------- */

function PlayerRow({ player, you }: { player?: Player; you: string }) {
  return (
    <div className={`row${player ? '' : ' row-empty'}`}>
      <div className="pfp tiny">
        {player ? player.avatar ? <img src={player.avatar} alt="" /> : player.name.slice(0, 1).toUpperCase() : '?'}
      </div>
      <span className="row-name">
        {player ? (
          <>
            <NameTag tag={player.tag} />
            {player.id === you ? `${player.name} (you)` : player.name}
          </>
        ) : (
          'Empty'
        )}
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
  const idRef = useRef(initial?.id ?? loadId());
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
    onSubmit({
      id: idRef.current,
      name: trimmed,
      avatar,
      tag: initial?.tag ?? null,
      title: initial?.title ?? null,
    });
  };

  return (
    <div className="screen identity">
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
  onSettings,
  onEdit,
  onResign,
}: {
  profile: Profile;
  onFind: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onSettings: () => void;
  onEdit: () => void;
  onResign: () => void;
}) {
  return (
    <div className="screen">
      <div className="me">
        <div className="pfp small">
          {profile.avatar ? <img src={profile.avatar} alt="" /> : profile.name.slice(0, 1).toUpperCase()}
        </div>
        <span className="me-name">
          <NameTag tag={profile.tag} />
          {profile.name}
        </span>
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
        <button className="btn" onClick={onSettings}>
          Settings
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
        <input
          id="join-code"
          className="field code-input"
          aria-label="Table code"
          value={code}
          maxLength={5}
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
  const myTag = room.players[myIndex]?.tag ?? profile.tag ?? null;
  const opponentTag = solo ? myTag : (opponent?.tag ?? null);
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
          <strong>
            <NameTag tag={opponentTag} />
            {opponentName}
          </strong>
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
          <strong>
            <NameTag tag={myTag} />
            {myName}
          </strong>
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

type ChatLine = { from: string; text: string };

/* ---------- chat ---------- */

function ChatPanel({
  lines,
  onSend,
  onClose,
}: {
  lines: ChatLine[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines.length]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="label">Chat</span>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="chat-log" ref={logRef}>
        {lines.length === 0 ? (
          <p className="muted">Say something...</p>
        ) : (
          lines.map((line, index) => (
            <p key={index} className="chat-line">
              <strong>{line.from}</strong>
              {line.text}
            </p>
          ))
        )}
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          className="field"
          value={text}
          maxLength={300}
          placeholder="Message"
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn primary" type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

const TRACKS: { id: TrackId; name: string; src: string; clip?: number }[] = [
  // a simple beta song is cut at 01:25 and loops there
  { id: 'beta', name: 'a simple beta song', src: '/assets/chess.m4a', clip: 85 },
  { id: 'diversion', name: 'a simple diversion', src: '/assets/simple-diversion.mp3' },
  { id: 'queen', name: 'queen', src: '/assets/queen.mp3' },
  { id: 'hopes', name: 'field of hopes and dreams', src: '/assets/field-of-hopes.mp3' },
];

function trackSource(track: TrackId): string {
  return TRACKS.find((item) => item.id === track)?.src ?? TRACKS[0].src;
}

/* ---------- settings ---------- */

function SettingsScreen({
  profile,
  track,
  onChange,
  onTrack,
}: {
  profile: Profile;
  track: TrackId;
  onChange: (next: Profile) => void;
  onTrack: (track: TrackId) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickTag = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange({ ...profile, tag: await fileToTag(file) });
    } catch {
      /* unsupported image — keep the tag that is already there */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen settings">
      <div className="setup">
        <button
          type="button"
          className="pfp"
          onClick={() => fileRef.current?.click()}
          aria-label="Choose a tag picture"
        >
          {profile.tag ? <img src={profile.tag} alt="" /> : <span>{busy ? '' : '+'}</span>}
        </button>
        <div className="setup-field">
          <span className="label">Tag</span>
          <p className="me-name">
            <NameTag tag={profile.tag} />
            {profile.name}
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void pickTag(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {profile.tag && (
        <button type="button" className="link" onClick={() => onChange({ ...profile, tag: null })}>
          Remove picture
        </button>
      )}

      <div className="setup-field">
        <span className="label">Music</span>
        <div className="tracks">
          {TRACKS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`track${track === item.id ? ' sel' : ''}`}
              aria-pressed={track === item.id}
              onClick={() => onTrack(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [track, setTrack] = useState<TrackId>(loadTrack());
  const trackSrc = trackSource(track);

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
          if (roomRef.current?.code !== message.room.code) {
            setChat([]);
            setChatOpen(false);
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
          setChat((current) => [...current, { from: message.from, text: message.text }]);
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
          setChatOpen(false);
          break;
        default:
          break;
      }
    },
    [notify],
  );

  const { connected, send } = useLobby(handleMessage);

  // Tell the server who we are as soon as the socket is up. That sign-in is what
  // earns the titles, and the very first player ever gets GM.
  const profileRef = useRef<Profile | null>(profile);
  profileRef.current = profile;
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

  // true only while the player wants music; used to undo browser interruptions
  const wantMusicRef = useRef(false);

  // The chosen song is the one the audio element loads. Switching songs keeps
  // the music going, and the first gesture starts it like before.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = trackSrc;
    audio.load();
    if (wantMusicRef.current) void audio.play().catch(() => undefined);
  }, [trackSrc]);

  // a simple beta song ends at 01:25 whatever the file's real length is.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const clip = TRACKS.find((item) => item.id === track)?.clip;
    if (!clip) return;

    const keepClip = () => {
      if (audio.currentTime >= clip) audio.currentTime = 0;
    };
    audio.addEventListener('timeupdate', keepClip);
    return () => audio.removeEventListener('timeupdate', keepClip);
  }, [track]);

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

  // Music is meant to be on the whole time, so a blocked first attempt retries
  // on the next tap instead of waiting for the speaker button.
  useEffect(() => {
    const resumeOnTap = () => {
      const audio = audioRef.current;
      if (!audio || inGame || !wantMusicRef.current || !audio.paused) return;
      void audio.play().catch(() => undefined);
    };
    window.addEventListener('pointerdown', resumeOnTap);
    return () => window.removeEventListener('pointerdown', resumeOnTap);
  }, [inGame]);

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

  const saveTag = (next: Profile) => {
    setProfile(next);
    saveProfile(next);
  };

  const pickTrack = (next: TrackId) => {
    setTrack(next);
    saveTrack(next);

    // picking a song is a tap, so the browser will let this one play right away
    const audio = audioRef.current;
    if (!audio) return;
    wantMusicRef.current = true;
    audio.src = trackSource(next);
    audio.load();
    void audio
      .play()
      .then(() => setMusicOn(true))
      .catch(() => undefined);
  };

  const resign = () => {
    send({ t: 'leave' });
    setRoom(null);
    setJoinBusy(false);
    setChatOpen(false);
    setChat([]);
    clearProfile();
    setProfile(null);
    setScreen('identity');
  };

  const leaveTable = () => {
    send({ t: 'leave' });
    setRoom(null);
    setMoves([]);
    setJoinBusy(false);
    setChatOpen(false);
    setChat([]);
    setScreen('menu');
  };

  const sendChat = (text: string) => {
    send({ t: 'chat', text });
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
          {inGame && room?.solo !== true && (
            <button
              className={`icon${chatOpen ? ' active' : ''}`}
              aria-label={chatOpen ? 'Close chat' : 'Open chat'}
              onClick={() => setChatOpen((open) => !open)}
            >
              <ChatIcon />
            </button>
          )}
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
            onSettings={() => setScreen('settings')}
            onEdit={() => setScreen('identity')}
            onResign={resign}
          />
        )}

        {screen === 'settings' && profile && (
          <SettingsScreen profile={profile} track={track} onChange={saveTag} onTrack={pickTrack} />
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

        {inGame && chatOpen && room?.solo !== true && (
          <ChatPanel lines={chat} onSend={sendChat} onClose={() => setChatOpen(false)} />
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
