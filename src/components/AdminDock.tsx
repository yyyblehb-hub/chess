/** The admin dock that sits under the board: one quick shot, one deck. */
export default function AdminDock({
  sniperOff,
  deckOpen,
  placing,
  onSniper,
  onDeck,
}: {
  sniperOff: boolean;
  deckOpen: boolean;
  /** a piece is armed and waiting for a square */
  placing: boolean;
  onSniper: () => void;
  onDeck: () => void;
}) {
  return (
    <div className="admin-dock">
      <span className="admin-dock-head">Admin</span>
      <div className="admin-row">
        <span className="admin-cat">{placing ? 'Tap a square' : 'Events'}</span>
        <button type="button" className="admin-act" disabled={sniperOff} onClick={onSniper}>
          Sniper shot
        </button>
        <button type="button" className="admin-act" onClick={onDeck}>
          {deckOpen ? 'Close deck' : 'Deck'}
        </button>
      </div>
    </div>
  );
}
