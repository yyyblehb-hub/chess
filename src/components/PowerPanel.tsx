import { useState } from 'react';
import { BOSS_ORDER, KINDS, MAGIC_ORDER, type MagicKind } from '../lib/fairy';
import { TROLLS, TURNS, type TurnKind } from '../lib/mayhem';
import '../powers.css';
import '../mayhem.css';

type Tab = 'pieces' | 'bosses' | 'events' | 'trolls' | 'final';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pieces', label: 'Pieces' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'events', label: 'Turns' },
  { id: 'trolls', label: 'Trolls' },
  { id: 'final', label: 'Final' },
];

function Card({
  glyph,
  label,
  on,
  sel = false,
  boss = false,
}: {
  glyph: string;
  label: string;
  on: () => void;
  sel?: boolean;
  boss?: boolean;
}) {
  return (
    <button
      type="button"
      className={`power-card${sel ? ' sel' : ''}${boss ? ' boss' : ''}`}
      onClick={on}
      aria-pressed={sel}
    >
      <span className="power-glyph">{glyph}</span>
      <span className="power-label">{label}</span>
    </button>
  );
}

/**
 * The admin's deck. Tabs for every kind of trouble: pieces and bosses are
 * placed on a square, turn events and trolls fire straight away, and the last
 * tab merges the whole board into one king.
 */
export default function PowerPanel({
  placing,
  onToggle,
  onPick,
  onCancel,
  onTurn,
  onScare,
  onOmega,
}: {
  placing: MagicKind | null;
  onToggle: () => void;
  onPick: (kind: MagicKind) => void;
  onCancel: () => void;
  onTurn: (kind: TurnKind) => void;
  onScare: (face: number) => void;
  onOmega: () => void;
}) {
  const [tab, setTab] = useState<Tab>('pieces');

  const hint = placing
    ? `Tap an empty square to drop the ${KINDS[placing].label.toLowerCase()}`
    : tab === 'pieces' || tab === 'bosses'
      ? 'Pick a piece, then place it'
      : tab === 'events'
        ? 'Fires at once: their piece runs off the board'
        : tab === 'trolls'
          ? 'Fires at once, on both screens'
          : 'One king to end the game';

  return (
    <div className="power-sheet">
      <div className="power-head">
        <span className="power-title">Admin deck</span>
        <button type="button" className="power-close" onClick={onToggle} aria-label="Close the deck">
          ×
        </button>
      </div>

      <div className="power-tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`power-tab${tab === entry.id ? ' sel' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'pieces' && (
        <div className="power-row">
          {MAGIC_ORDER.map((kind) => (
            <Card
              key={kind}
              glyph={KINDS[kind].glyph}
              label={KINDS[kind].label}
              sel={placing === kind}
              on={() => onPick(kind)}
            />
          ))}
        </div>
      )}

      {tab === 'bosses' && (
        <div className="power-row">
          {BOSS_ORDER.map((kind) => (
            <Card
              key={kind}
              glyph={KINDS[kind].glyph}
              label={KINDS[kind].label}
              boss
              sel={placing === kind}
              on={() => onPick(kind)}
            />
          ))}
        </div>
      )}

      {tab === 'events' && (
        <>
          <div className="power-row">
            {TURNS.map((turn) => (
              <Card
                key={turn.id}
                glyph="»"
                label={turn.label}
                on={() => {
                  onTurn(turn.id);
                  onToggle();
                }}
              />
            ))}
          </div>
          <p className="power-blurb">{TURNS[0].hint}</p>
        </>
      )}

      {tab === 'trolls' && (
        <div className="power-row">
          {TROLLS.map((troll, face) => (
            <Card
              key={troll.label}
              glyph="☻"
              label={troll.label}
              on={() => {
                onScare(face);
                onToggle();
              }}
            />
          ))}
        </div>
      )}

      {tab === 'final' && (
        <div className="power-final">
          <span className="power-final-glyph">♚</span>
          <strong>Super Omega King</strong>
          <p>Every piece on the board merges into one king. Nothing survives it.</p>
          <button
            type="button"
            className="btn primary power-final-btn"
            onClick={() => {
              onOmega();
              onToggle();
            }}
          >
            Merge everything
          </button>
        </div>
      )}

      <p className="power-hint">{hint}</p>

      {placing && (
        <button type="button" className="btn ghost power-cancel" onClick={onCancel}>
          Put it back
        </button>
      )}
    </div>
  );
}
