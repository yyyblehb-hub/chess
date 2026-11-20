import { useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, initialState, moveNotation, type Move } from '../lib/chess';

export type ChatLine = { id: string; from: string; text: string; at: number };

/* ---------- chat and move list ---------- */

type Group = { id: string; mine: boolean; from: string; lines: { text: string; at: number }[] };

// the clock on the last bubble of a run, in the phone's own time
const clock = (at: number) => {
  const date = new Date(at);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const ChatGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 12.5a6.8 6.8 0 0 1-7.5 6.8 8.6 8.6 0 0 1-2.6-.6L5.5 20l.9-3.2A6.6 6.6 0 0 1 4.5 12.5 6.8 6.8 0 0 1 12 5.7a6.8 6.8 0 0 1 8 6.8Z" />
  </svg>
);

const SendGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 12h8M13 6l6 6-6 6" />
  </svg>
);

export default function GamePanel({
  view,
  lines,
  moves,
  me,
  unread,
  canChat,
  onView,
  onSend,
  onClose,
}: {
  view: 'chat' | 'moves';
  lines: ChatLine[];
  moves: Move[];
  /** the signed-in player, so their own lines sit on the right */
  me: string;
  /** messages that arrived while the panel was closed or on the moves tab */
  unread: number;
  canChat: boolean;
  onView: (view: 'chat' | 'moves') => void;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const movesRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // a run of messages from one person within two minutes reads as one block
  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const line of lines) {
      const previous = out[out.length - 1];
      const lastAt = previous ? previous.lines[previous.lines.length - 1].at : 0;
      if (previous && previous.id === line.id && line.at - lastAt < 120000) {
        previous.lines.push({ text: line.text, at: line.at });
      } else {
        out.push({
          id: line.id,
          mine: line.id === me,
          from: line.from,
          lines: [{ text: line.text, at: line.at }],
        });
      }
    }
    return out;
  }, [lines, me]);

  useEffect(() => {
    const log = logRef.current;
    if (log && atBottom) log.scrollTop = log.scrollHeight;
  }, [groups.length, view, atBottom]);

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
    // sending always brings the newest message into view
    setAtBottom(true);
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  };

  const jumpToLatest = () => {
    setAtBottom(true);
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
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
            {view !== 'chat' && unread > 0 && <span className="tab-dot" aria-hidden="true" />}
          </button>
        )}
      </div>

      {view === 'chat' ? (
        <>
          <div
            className="panel-log"
            ref={logRef}
            onScroll={() => {
              const log = logRef.current;
              if (!log) return;
              setAtBottom(log.scrollHeight - log.scrollTop - log.clientHeight < 40);
            }}
          >
            {lines.length === 0 ? (
              <div className="chat-empty">
                <ChatGlyph />
                <strong>No messages yet</strong>
                <span>Say hello — they see it the moment you send.</span>
              </div>
            ) : (
              groups.map((group, index) => (
                <div key={index} className={`msg${group.mine ? ' mine' : ''}`}>
                  {!group.mine && <span className="msg-name">{group.from}</span>}
                  <div className="msg-stack">
                    {group.lines.map((line, lineIndex) => (
                      <p className="msg-bubble" key={lineIndex}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                  <span className="msg-time">{clock(group.lines[group.lines.length - 1].at)}</span>
                </div>
              ))
            )}
          </div>

          {!atBottom && lines.length > 0 && (
            <button type="button" className="chat-jump" onClick={jumpToLatest}>
              Jump to latest
            </button>
          )}

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
              placeholder="Message"
              aria-label="Message"
              autoComplete="off"
              enterKeyHint="send"
              onChange={(event) => setText(event.target.value)}
            />
            <button className="send" type="submit" disabled={!text.trim()} aria-label="Send message">
              <SendGlyph />
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
