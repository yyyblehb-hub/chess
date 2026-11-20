/* the medallion on the result card: crown, flag, or a level score */
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

/** chess.com's end-of-game presentation, in this game's palette */
export default function ResultCard({
  result,
  verdict,
  outcome,
  score,
  winner,
  canRematch,
  onRematch,
  onLeave,
}: {
  result: string;
  verdict: 'win' | 'loss' | 'draw' | 'neutral';
  outcome: string;
  score: string;
  winner: 'white' | 'black' | null;
  canRematch: boolean;
  onRematch: () => void;
  onLeave: () => void;
}) {
  return (
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
  );
}
