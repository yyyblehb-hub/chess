import { useEffect, useMemo, useRef, useState } from 'react';
import Board from './Board';
import { applyMove, gameResult, initialState, moveNotation, replay, type Color, type Move } from '../lib/chess';
import { type Profile } from '../lib/profile';
import { type Room } from '../lib/lobby';
import { applyShots } from '../lib/shots';
import { refreshAdmin } from '../lib/admin';
import NameTag from './NameTag';

/* ---------- game ---------- */

/** the medallion at the top of the result card: crown, flag, or a level score */
function Crest({ verdict }: { verdict: string }) {
  if (verdict === 'win') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 8.6l4.3 3.2L12 5.2l4.2 6.6 4.3-3.2-1.7 9.1H5.2z" />
        <path d="M5.2 20h13.6" />
      </svg>
    );
  }
  if (verdict === 'loss') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 20.5V3.5" />
        <path d="M6.5 4.6h10.8l-2.3 4 2.3 4H6.5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 9.5h13" />
      <path d="M5.5 14.5h13" />
    </svg>
  );
}

/** board #2's shooter: a bishop with a scoped rifle, drawn by hand */
function SniperBishop() {
  return (
    <svg viewBox="0 0 120 120" className="sniper-bishop" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="44" cy="30" r="5.5" />
        <path d="M44 24c8 5 10 14 7 21H37c-3-7-1-16 7-21z" />
        <path d="M37 47h14l4 24H33z" />
        <path d="M29 79h30v9H29z" />
        <path d="M55 58h40" />
        <path d="M66 51h13v7H66z" />
        <path d="M75 51v-3" />
        <path d="M92 55l7 3-7 3" />
        <path d="M58 65l7 7" />
        <path d="M64 72l-4 8" />
      </g>
    </svg>
  );
}

export default function GameScreen({
  room,
  moves,
  profile,
  onMove,
  onCopy,
  onRematch,
  onLeave,
  onShoot,
}: {
  room: Room;
  moves: Move[];
  profile: Profile;
  onMove: (move: Move) => void;
  onCopy: () => void;
  onRematch: () => void;
  onLeave: () => void;
  onShoot: (square: number) => void;
}) {
  // the sniper's emptied squares sit on top of the replayed position
  const state = useMemo(() => applyShots(replay(moves), room.shots), [moves, room.shots]);
  const solo = room.solo === true;
  const myIndex = room.players.findIndex((player) => player.id === profile.id);
  const myColor: Color = myIndex === 1 ? 'b' : 'w';
  const opponent = room.players.find((player) => player.id !== profile.id);
  const result = gameResult(state, moves);
  const over = result !== null;

  // stepping back through the game: 0 is the start, moves.length is the live board
  const [viewPly, setViewPly] = useState(moves.length);
  useEffect(() => {
    setViewPly(moves.length);
  }, [moves.length]);
  const live = viewPly >= moves.length;
  const shown = useMemo(
    () => applyShots(replay(moves.slice(0, viewPly)), room.shots),
    [moves, viewPly, room.shots],
  );
  const step = (delta: number) =>
    setViewPly((ply) => Math.min(moves.length, Math.max(0, ply + delta)));

  // the whole game written out, one short notation per ply
  const notations = useMemo(() => {
    const list: string[] = [];
    let before = initialState();
    for (const move of moves) {
      list.push(moveNotation(before, move));
      const next = applyMove(before, move.from, move.to, move.promotion);
      if (!next) break;
      before = next;
    }
    return list;
  }, [moves]);

  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = track.scrollWidth;
  }, [moves.length, viewPly]);

  /* ---------- the admin dock and the sniper scene ---------- */

  // the server decides who holds the menu; the dock only appears for that account
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    void refreshAdmin().then(setAdmin);
  }, []);

  const [scene, setScene] = useState<'zoom' | 'aim' | 'fire' | 'back' | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // the camera pulls back diagonally, board #2 slides in, then the pieces arm
  const armSniper = () => {
    if (scene) return;
    setHit(null);
    setScene('zoom');
    later(620, () => setScene('aim'));
  };

  const holdFire = () => {
    clearTimers();
    setScene('back');
    later(560, () => {
      setScene(null);
      setHit(null);
    });
  };

  const fireAt = (square: number) => {
    if (scene !== 'aim') return;
    setScene('fire');
    setHit(square);
    onShoot(square);
    later(1050, () => setScene('back'));
    later(1650, () => {
      setScene(null);
      setHit(null);
    });
  };

  // what chess.com puts in the middle of the board when the game is over
  const winner = result === 'checkmate' ? (state.turn === 'w' ? 'black' : 'white') : null;
  const alone = !solo && room.players.length < 2;
  const mySide = myColor === 'w' ? 'white' : 'black';
  const outcome = !winner
    ? 'Draw'
    : solo || alone
      ? `${winner === 'white' ? 'White' : 'Black'} won`
      : winner === mySide
        ? 'You won'
        : 'You lost';
  const score = !winner ? '½-½' : winner === 'white' ? '1-0' : '0-1';
  // solo and abandoned tables have no "you", so they get the quiet treatment
  const verdict = !winner ? 'draw' : solo || alone ? 'neutral' : winner === mySide ? 'win' : 'loss';
  const canRematch = solo || room.players.length >= 2;

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
    <>
      <div className={`game${scene ? ' sniping' : ''}${scene === 'fire' ? ' firing' : ''}`}>
        <div className="pcard">
          <div className="pfp mid">{opponentFace}</div>
          <div className="meta">
            <strong>
              <NameTag tag={opponentTag} />
              {opponentName}
            </strong>
          </div>
          <button className="chip" onClick={onCopy} aria-label={`Table code ${room.code}, tap to copy`}>
            {room.code}
          </button>
        </div>

        <Board
          state={shown}
          myColor={myColor}
          solo={solo}
          locked={over || !live}
          targeting={scene === 'aim'}
          hit={hit}
          onMove={onMove}
          onShoot={fireAt}
        />

        <div className="pcard">
          <div className="pfp mid">{myFace}</div>
          <div className="meta">
            <strong>
              <NameTag tag={myTag} />
              {myName}
            </strong>
          </div>
        </div>

        <div className="nav">
          <button
            type="button"
            className="nav-btn"
            aria-label="Previous move"
            disabled={viewPly === 0}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <div
            className="nav-track"
            ref={trackRef}
            role="button"
            tabIndex={0}
            aria-label={live ? 'Moves played' : 'Back to the live position'}
            onClick={() => setViewPly(moves.length)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') setViewPly(moves.length);
            }}
          >
            {notations.map((san, index) => (
              <span
                key={index}
                className={`nav-move${index < viewPly ? ' played' : ''}${index === viewPly - 1 ? ' now' : ''}`}
              >
                {san}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="nav-btn"
            aria-label="Next move"
            disabled={live}
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>

        {admin && (
          <div className="admin-dock">
            <span className="admin-dock-head">Admin</span>
            <div className="admin-row">
              <span className="admin-cat">Turns</span>
              <button
                type="button"
                className="admin-act"
                disabled={scene !== null || over}
                onClick={armSniper}
              >
                Sniper shot
              </button>
            </div>
          </div>
        )}

        {over && (
          <div className={`gameover ${verdict}`}>
            <div className="gameover-black" aria-hidden="true" />
            <div className="gameover-glow" aria-hidden="true" />
            <div className="result-card" role="dialog" aria-modal="true" aria-label="Game over">
              <span className="result-crest">
                <Crest verdict={verdict} />
              </span>
              <span className="result-kicker">
                {result === 'checkmate'
                  ? 'Checkmate'
                  : result === 'stalemate'
                    ? 'Stalemate'
                    : result === 'repetition'
                      ? 'Draw by repetition'
                      : 'Insufficient material'}
              </span>
              <strong className="result-title">{outcome}</strong>
              <span className="result-sub">
                {winner ? `${winner === 'white' ? 'White' : 'Black'} won` : 'Draw'} · {score}
              </span>
              <div className="result-actions">
                {canRematch && (
                  <button className="btn primary" onClick={onRematch}>
                    Rematch
                  </button>
                )}
                <button className="btn ghost" onClick={onLeave}>
                  Find new match
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {scene && (
        <div className={`sniper ${scene}`} aria-hidden="true">
          <div className="sniper-veil" />
          <div className="sniper-reticle" />
          <div className="sniper-board">
            <span className="sniper-tag">board #2</span>
            <SniperBishop />
            <span className="sniper-glint" />
          </div>
          {scene === 'aim' && (
            <div className="sniper-aim">
              <p className="sniper-hint">Tap any piece to take it off the board</p>
              <button type="button" className="btn ghost sniper-cancel" onClick={holdFire}>
                Hold fire
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
