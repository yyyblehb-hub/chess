import type { CSSProperties } from 'react';
import { KINDS, type Flee, type MagicPiece } from '../lib/fairy';
import { pieceImage } from '../lib/pieces';
import type { Color } from '../lib/chess';

/**
 * Everything the admin drops on top of the board: the special pieces and
 * bosses, a piece running for the edge, and the merged king. Kept in its own
 * layer so the board itself only knows about squares and chess pieces.
 */
export default function MagicLayer({
  magic,
  flee,
  omega,
  flip,
}: {
  magic?: Map<number, MagicPiece>;
  flee?: Flee[];
  omega?: Color | null;
  flip: boolean;
}) {
  const cell = (sq: number): CSSProperties => ({
    left: `${(flip ? 7 - (sq & 7) : sq & 7) * 12.5}%`,
    top: `${(flip ? 7 - (sq >> 3) : sq >> 3) * 12.5}%`,
  });

  if (omega) {
    return (
      <>
        <div className="omega-halo" aria-hidden="true" />
        <img className="omega-king" src={pieceImage(omega, 'k')} alt="" draggable={false} aria-hidden="true" />
      </>
    );
  }

  return (
    <>
      {magic &&
        [...magic].map(([sq, piece]) => (
          <span key={`m${sq}`} className="magic-cell" style={cell(sq)}>
            <img
              className={`magic-art ${piece.side}${piece.kind === 'flowey' ? ' flowey' : ''}${
                KINDS[piece.kind].boss ? ' boss' : ''
              }`}
              src={KINDS[piece.kind].art[piece.side]}
              alt=""
              draggable={false}
              aria-hidden="true"
            />
          </span>
        ))}

      {(flee ?? []).map((piece) => {
        const step = [[-1, 0], [1, 0], [0, -1], [0, 1]][piece.dir] ?? [0, -1];
        const dx = (flip ? -step[0] : step[0]) * 700;
        const dy = (flip ? -step[1] : step[1]) * 700;
        return (
          <span key={`f${piece.sq}`} className="magic-cell" style={cell(piece.sq)}>
            <img
              className="flee-art"
              src={pieceImage(piece.color, piece.type)}
              alt=""
              draggable={false}
              aria-hidden="true"
              style={{ '--dx': `${dx}%`, '--dy': `${dy}%` } as CSSProperties}
            />
          </span>
        );
      })}
    </>
  );
}
