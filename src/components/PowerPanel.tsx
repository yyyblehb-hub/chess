import { KINDS, MAGIC_ORDER, type MagicKind } from '../lib/fairy';
import '../powers.css';

/**
 * The admin's deck. One card per special piece: tap a card, then tap the square
 * it appears on. The card stays armed until the piece lands or the deck closes.
 */
export default function PowerPanel({
  open,
  placing,
  onToggle,
  onPick,
  onCancel,
}: {
  open: boolean;
  placing: MagicKind | null;
  onToggle: () => void;
  onPick: (kind: MagicKind) => void;
  onCancel: () => void;
}) {
  return (
    <div className="power-sheet">
      <div className="power-head">
        <span className="power-title">Special pieces</span>
        <button type="button" className="power-close" onClick={onToggle} aria-label="Close the deck">
          ×
        </button>
      </div>

      <div className="power-row">
        {MAGIC_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`power-card${placing === kind ? ' sel' : ''}`}
            onClick={() => onPick(kind)}
            aria-pressed={placing === kind}
          >
            <span className="power-glyph">{KINDS[kind].glyph}</span>
            <span className="power-label">{KINDS[kind].label}</span>
          </button>
        ))}
      </div>

      <p className="power-hint">
        {placing
          ? `Tap an empty square to drop the ${KINDS[placing].label.toLowerCase()}`
          : 'Pick a piece, then place it'}
      </p>

      {placing && (
        <button type="button" className="btn ghost power-cancel" onClick={onCancel}>
          Put it back
        </button>
      )}
    </div>
  );
}
