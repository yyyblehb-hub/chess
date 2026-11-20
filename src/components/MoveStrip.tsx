import { useEffect, useRef } from 'react';

/** The move list under the board, and the two arrows that walk it. */
export default function MoveStrip({
  notations,
  viewPly,
  live,
  count,
  onJump,
  onStep,
}: {
  notations: string[];
  viewPly: number;
  live: boolean;
  count: number;
  onJump: () => void;
  onStep: (delta: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = track.scrollWidth;
  }, [count, viewPly]);

  return (
    <div className="nav">
      <button
        type="button"
        className="nav-btn"
        aria-label="Previous move"
        disabled={viewPly === 0}
        onClick={() => onStep(-1)}
      >
        ‹
      </button>
      <div
        className="nav-track"
        ref={trackRef}
        role="button"
        tabIndex={0}
        aria-label={live ? 'Moves played' : 'Back to the live position'}
        onClick={onJump}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onJump();
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
      <button type="button" className="nav-btn" aria-label="Next move" disabled={live} onClick={() => onStep(1)}>
        ›
      </button>
    </div>
  );
}
