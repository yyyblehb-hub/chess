import { useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, initialState, moveNotation, type Move } from '../lib/chess';

export type ChatLine = { from: string; text: string };

/* ---------- chat and move list ---------- */

export default function GamePanel({
  view,
  lines,
  moves,
  canChat,
  onView,
  onSend,
  onClose,
}: {
  view: 'chat' | 'moves';
  lines: ChatLine[];
  moves: Move[];
  canChat: boolean;
  onView: (view: 'chat' | 'moves') => void;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const movesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines.length, view]);

  useEffect(() => {
    const log = movesRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [moves.length, view]);

  // the score sheet the way chess.com writes it: number, white, black
  const history = useMemo(() => {
    let state = initialState();
    const rows: { number: number; white: string; black: string }[] = [];
    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index];
      const san = moveNotation(state, move);
      if (index % 2 === 0) rows.push({ number: index / 2 + 1, white: san, black: '' });
      else rows[rows.length - 1].black = san;
      const next = applyMove(state, move.from, move.to, move.promotion);
      if (!next) break;
      state = next;
    }
    return rows;
  }, [moves]);

  const last = moves.length - 1;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div
      className="game-panel"
      role="dialog"
      aria-modal="true"
      aria-label={view === 'chat' ? 'Chat' : 'Moves'}
    >
      <div className="panel-bar">
        <button type="button" className="icon" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14.5 5.5-7 6.5 7 6.5" />
          </svg>
        </button>
        <strong className="panel-title">{view === 'chat' ? 'Chat' : 'Moves'}</strong>
        <span className="grow" />
        {canChat && (
          <button
            type="button"
            className="panel-tab"
            onClick={() => onView(view === 'chat' ? 'moves' : 'chat')}
          >
            {view === 'chat' ? 'Moves' : 'Chat'}
          </button>
        )}
      </div>

      {view === 'chat' ? (
        <>
          <div className="panel-log" ref={logRef}>
            {lines.length === 0 ? (
              <p className="panel-empty">No messages yet</p>
            ) : (
              lines.map((line, index) => (
                <p key={index} className="panel-line">
                  <strong>{line.from}</strong>
                  {line.text}
                </p>
              ))
            )}
          </div>
          <form
            className="panel-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              className="field"
              value={text}
              maxLength={300}
              placeholder="Send a message"
              autoComplete="off"
              enterKeyHint="send"
              onChange={(event) => setText(event.target.value)}
            />
            <button className="btn primary" type="submit" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </>
      ) : (
        <div className="moves" ref={movesRef}>
          {history.length === 0 ? (
            <p className="panel-empty">No moves yet</p>
          ) : (
            <>
              <div className="moves-head">
                <span />
                <span>White</span>
                <span>Black</span>
              </div>
              {history.map((row, index) => (
                <div className="moves-row" key={row.number}>
                  <span className="moves-no">{row.number}.</span>
                  <span className={`moves-san${last === index * 2 ? ' last' : ''}`}>{row.white}</span>
                  <span className={`moves-san${last === index * 2 + 1 ? ' last' : ''}`}>{row.black}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
