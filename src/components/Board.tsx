import { useMemo, useRef, useState } from 'react';
import {
  gameStatus,
  inCheck,
  kingSquare,
  legalMoves,
  rankOf,
  type Color,
  type GameState,
  type Move,
  type PieceType,
} from '../lib/chess';

// JohnPablok/Cburnett set (CC BY-SA 3.0, see src/assets/pieces/CREDITS.txt).
// Bundled inline so the board needs no image requests at all.
import wb from '../assets/pieces/wb.svg';
import wk from '../assets/pieces/wk.svg';
import wn from '../assets/pieces/wn.svg';
import wp from '../assets/pieces/wp.svg';
import wq from '../assets/pieces/wq.svg';
import wr from '../assets/pieces/wr.svg';
import bb from '../assets/pieces/bb.svg';
import bk from '../assets/pieces/bk.svg';
import bn from '../assets/pieces/bn.svg';
import bp from '../assets/pieces/bp.svg';
import bq from '../assets/pieces/bq.svg';
import br from '../assets/pieces/br.svg';

const PIECES: Record<string, string> = { wb, wk, wn, wp, wq, wr, bb, bk, bn, bp, bq, br };

const pieceImage = (color: Color, type: PieceType) => PIECES[`${color}${type}`];

export default function Board({
  state,
  myColor,
  solo = false,
  onMove,
}: {
  state: GameState;
  myColor: Color;
  /** Test table: one person plays both sides. */
  solo?: boolean;
  onMove: (move: Move) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<{ from: number; to: number } | null>(null);
  // a tap is handled on pointerdown so a swallowed click (fullscreen, scroll)
  // cannot eat the move; the click that follows is then ignored
  const handledByPointer = useRef(false);
  const flip = !solo && myColor === 'b';
  const myTurn = solo || state.turn === myColor;

  const targets = useMemo(() => (selected === null ? [] : legalMoves(state, selected)), [state, selected]);
  const status = useMemo(() => gameStatus(state), [state]);
  const checkedKing = inCheck(state, state.turn) ? kingSquare(state, state.turn) : -1;

  const choose = (square: number) => {
    if (!myTurn) {
      setSelected(null);
      return;
    }

    if (selected !== null && targets.includes(square)) {
      const piece = state.board[selected];
      const promotionRank = piece?.color === 'w' ? 0 : 7;
      if (piece?.type === 'p' && rankOf(square) === promotionRank) {
        setPromotion({ from: selected, to: square });
        setSelected(null);
        return;
      }
      onMove({ from: selected, to: square });
      setSelected(null);
      return;
    }

    const piece = state.board[square];
    setSelected(piece && (solo || piece.color === myColor) ? square : null);
  };

  const squares = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const square = flip ? (7 - row) * 8 + (7 - column) : row * 8 + column;
      const piece = state.board[square];
      const dark = (row + column) % 2 === 1;
      const isTarget = targets.includes(square);
      const classes = ['sq', dark ? 'dark' : 'light'];
      if (state.last && (state.last.from === square || state.last.to === square)) classes.push('last');
      if (selected === square) classes.push('sel');
      if (checkedKing === square) classes.push('check');

      squares.push(
        <button
          key={square}
          type="button"
          className={classes.join(' ')}
          onPointerDown={() => {
            handledByPointer.current = true;
            choose(square);
          }}
          onClick={() => {
            if (handledByPointer.current) {
              handledByPointer.current = false;
              return;
            }
            choose(square);
          }}
          aria-label={`${'abcdefgh'[square & 7]}${8 - (square >> 3)}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
        >
          {piece && (
            <img
              className="piece"
              src={pieceImage(piece.color, piece.type)}
              alt=""
              draggable={false}
              aria-hidden="true"
            />
          )}
          {isTarget && <span className={piece ? 'target capture' : 'target'} aria-hidden="true" />}
        </button>,
      );
    }
  }

  const promotionColour = promotion ? (state.board[promotion.from]?.color ?? myColor) : myColor;

  return (
    <div className="board-wrap">
      <div
        className={`board${status === 'checkmate' || status === 'stalemate' ? ' over' : ''}`}
        role="grid"
        aria-label="Chess board"
      >
        {squares}
      </div>

      {promotion && (
        <div className="promo" role="dialog" aria-label="Choose a piece">
          {(['q', 'r', 'b', 'n'] as PieceType[]).map((type) => (
            <button
              key={type}
              type="button"
              className="promo-btn"
              onClick={() => {
                onMove({ from: promotion.from, to: promotion.to, promotion: type });
                setPromotion(null);
              }}
            >
              <img src={pieceImage(promotionColour, type)} alt={type} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
