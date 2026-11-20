import { useEffect, useMemo, useState } from 'react';
import Board from './Board';
import { gameResult, gameStatus, moveNotation, replay, type Color, type Move } from '../lib/chess';
import { type Profile } from '../lib/profile';
import { type Room } from '../lib/lobby';
import NameTag from './NameTag';

/* ---------- game ---------- */

export default function GameScreen({
  room,
  moves,
  profile,
  onMove,
  onCopy,
  onRematch,
  onLeave,
}: {
  room: Room;
  moves: Move[];
  profile: Profile;
  onMove: (move: Move) => void;
  onCopy: () => void;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const state = useMemo(() => replay(moves), [moves]);
  const solo = room.solo === true;
  const myIndex = room.players.findIndex((player) => player.id === profile.id);
  const myColor: Color = myIndex === 1 ? 'b' : 'w';
  const opponent = room.players.find((player) => player.id !== profile.id);
  const status = gameStatus(state);
  const result = gameResult(state, moves);
  const side = state.turn === 'w' ? 'white' : 'black';
  const over = result !== null;

  // stepping back through the game: 0 is the start, moves.length is the live board
  const [viewPly, setViewPly] = useState(moves.length);
  useEffect(() => {
    setViewPly(moves.length);
  }, [moves.length]);
  const live = viewPly >= moves.length;
  const shown = useMemo(() => replay(moves.slice(0, viewPly)), [moves, viewPly]);
  const step = (delta: number) =>
    setViewPly((ply) => Math.min(moves.length, Math.max(0, ply + delta)));

  // the draw names chess.com prints on the result card
  const draw =
    result === 'stalemate'
      ? 'stalemate'
      : result === 'insufficient'
        ? 'insufficient material'
        : result === 'repetition'
          ? 'threefold repetition'
          : null;

  const label =
    result === 'checkmate'
      ? solo
        ? `checkmate · ${state.turn === 'w' ? 'black' : 'white'} won`
        : state.turn === myColor
          ? 'checkmate · you lost'
          : 'checkmate · you won'
      : draw
        ? `draw · ${draw}`
        : status === 'check'
          ? solo
            ? `${side} in check`
            : 'check'
          : solo
            ? `${side} to move`
            : state.turn === myColor
              ? 'your move'
              : 'waiting';

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
  const canRematch = solo || room.players.length >= 2;

  const opponentName = solo ? profile.name : (opponent?.name ?? 'opponent');
  const myName = profile.name;

  // what the bar says: the move that led to the board you are looking at, and who played it
  const currentMove = viewPly > 0 ? moves[viewPly - 1] : null;
  const currentSan = currentMove ? moveNotation(replay(moves.slice(0, viewPly - 1)), currentMove) : '';
  const mover: Color = viewPly % 2 === 1 ? 'w' : 'b';
  const currentWho = !currentMove
    ? ''
    : solo
      ? mover === 'w'
        ? 'white'
        : 'black'
      : mover === myColor
        ? 'you'
        : opponentName;
  const moveLabel = currentMove
    ? `${Math.ceil(viewPly / 2)}${viewPly % 2 === 1 ? '.' : '...'} ${currentSan}`
    : 'Start';
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

      <Board state={shown} myColor={myColor} solo={solo} locked={over || !live} onMove={onMove} />

      <div className="nav">
        <button
          type="button"
          className="nav-btn"
          aria-label="Previous move"
          disabled={viewPly === 0}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14.5 5.5-7 6.5 7 6.5" />
          </svg>
        </button>
        <button
          type="button"
          className={`nav-now${live ? '' : ' looking'}`}
          aria-label={live ? 'Live position' : 'Back to live position'}
          onClick={() => setViewPly(moves.length)}
        >
          <strong>{moveLabel}</strong>
          {currentWho && <span>{currentWho}</span>}
        </button>
        <button
          type="button"
          className="nav-btn"
          aria-label="Next move"
          disabled={live}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9.5 5.5 7 6.5-7 6.5" />
          </svg>
        </button>
      </div>

      <div className="pcard">
        <div className="pfp mid">{myFace}</div>
        <div className="meta">
          <strong>
            <NameTag tag={myTag} />
            {myName}
          </strong>
          <span className={over ? 'over' : undefined}>{label}</span>
        </div>
      </div>

      {over && (
        <div className="gameover">
          <div className="gameover-black" aria-hidden="true" />
          <div className="result-card" role="dialog" aria-modal="true" aria-label="Game over">
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
  );
}
