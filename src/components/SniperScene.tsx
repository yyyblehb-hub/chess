import { useRef } from 'react';

/** where the board sits on screen, so the sight can ride on its squares */
export type Box = { left: number; top: number; size: number };

/** the picture the owner supplied: the sniper waiting on the second board */
const ART = 'https://files.catbox.moe/u4b5xa.jpg';

export default function SniperScene({
  mode,
  reticle,
  board,
  interactive,
  onMove,
  onFire,
  onHold,
}: {
  mode: 'zoom' | 'aim' | 'fire' | 'back';
  reticle: { x: number; y: number };
  board: Box | null;
  /** only the admin holding the menu can drag and fire */
  interactive: boolean;
  onMove: (x: number, y: number) => void;
  onFire: () => void;
  onHold: () => void;
}) {
  const dragging = useRef(false);

  const place = (clientX: number, clientY: number) => {
    if (!board || board.size <= 0) return;
    const x = Math.min(1, Math.max(0, (clientX - board.left) / board.size));
    const y = Math.min(1, Math.max(0, (clientY - board.top) / board.size));
    onMove(x, y);
  };

  // the sight is exactly one square of the board
  const side = board ? board.size / 8 : 0;

  return (
    <div className={`sniper ${mode}`}>
      <div className="sniper-veil" />
      <img className="sniper-art" src={ART} alt="" draggable={false} />

      {board && (
        <>
          {/* the whole board takes the drag, so a finger never has to find the
              sight before it can be moved */}
          <div
            className={`sniper-drag${interactive ? ' live' : ''}`}
            style={{ left: board.left, top: board.top, width: board.size, height: board.size }}
            onPointerDown={(event) => {
              if (!interactive) return;
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              place(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (!interactive || !dragging.current) return;
              place(event.clientX, event.clientY);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          />

          <div
            className={`sniper-reticle${interactive ? ' live' : ''}`}
            aria-hidden="true"
            style={{
              left: board.left + reticle.x * board.size,
              top: board.top + reticle.y * board.size,
              width: side,
              height: side,
            }}
          >
            <span className="sniper-frame" />
            <span className="sniper-axes" />
            <span className="sniper-ring" />
            <span className="sniper-dot" />
          </div>
        </>
      )}

      {mode === 'aim' && (
        <div className="sniper-aim">
          <p className="sniper-hint">
            {interactive ? 'Drag the sight over a piece, then fire' : 'The sniper is taking aim'}
          </p>
          {interactive && (
            <div className="sniper-buttons">
              <button type="button" className="btn sniper-fire" onClick={onFire}>
                Fire
              </button>
              <button type="button" className="btn ghost sniper-cancel" onClick={onHold}>
                Hold fire
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
