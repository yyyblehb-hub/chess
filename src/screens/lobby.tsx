import { useEffect, useState } from 'react';
import NameTag from '../components/NameTag';
import { type Player, type Room } from '../lib/lobby';

/* ---------- player row ---------- */

export function PlayerRow({ player, you }: { player?: Player; you: string }) {
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

/* ---------- menu ---------- */

export function MenuScreen({
  profile,
  onFind,
  onCreate,
  onJoin,
  onSettings,
  onEdit,
  onResign,
}: {
  profile: { name: string; avatar: string | null; tag?: string | null };
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

export function JoinScreen({ busy, onJoin }: { busy: boolean; onJoin: (code: string) => void }) {
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

export function SearchScreen({ onCancel }: { onCancel: () => void }) {
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

/* ---------- room ---------- */

export function RoomScreen({
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
