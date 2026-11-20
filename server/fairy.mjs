/**
 * The special pieces, server side. The client owns the pretty version of these
 * rules; this copy is what actually decides, because a client can lie about a
 * camel's jump just as easily as about a move.
 */
export const KINDS = {
  camel: { jumps: [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]] },
  zebra: { jumps: [[2, 3], [3, 2], [3, -2], [2, -3], [-2, -3], [-3, -2], [-3, 2], [-2, 3]] },
  alfil: { jumps: [[2, 2], [2, -2], [-2, 2], [-2, -2]] },
  dabbaba: { jumps: [[0, 2], [2, 0], [0, -2], [-2, 0]] },
  giraffe: { jumps: [[1, 4], [4, 1], [4, -1], [1, -4], [-1, -4], [-4, -1], [-4, 1], [-1, 4]] },
  flowey: { jumps: [], slider: true },
};

const QUEEN = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const onBoard = (file, rank) => file >= 0 && file < 8 && rank >= 0 && rank < 8;

/** the log replayed into square -> piece */
export function magicBoard(events) {
  const map = new Map();
  for (const event of events || []) {
    if (event.t === 'spawn') map.set(event.sq, { kind: event.kind, side: event.side });
    else if (event.t === 'gone') map.delete(event.sq);
    else {
      const piece = map.get(event.from);
      if (!piece) continue;
      map.delete(event.from);
      map.delete(event.to);
      map.set(event.to, piece);
    }
  }
  return map;
}

export function magicMoves(board, magic, from) {
  const piece = magic.get(from);
  if (!piece) return [];
  const spec = KINDS[piece.kind];
  if (!spec) return [];
  const own = (sq) => {
    const other = magic.get(sq);
    if (other) return other.side === piece.side;
    const cell = board[sq];
    return Boolean(cell && cell.color === piece.side);
  };
  const empty = (sq) => !board[sq] && !magic.has(sq);
  const file = from & 7;
  const rank = from >> 3;
  const out = [];

  for (const [df, dr] of spec.slider ? QUEEN : spec.jumps) {
    if (!spec.slider) {
      if (!onBoard(file + df, rank + dr)) continue;
      const sq = (rank + dr) * 8 + (file + df);
      if (empty(sq) || !own(sq)) out.push(sq);
      continue;
    }
    let f = file + df;
    let r = rank + dr;
    while (onBoard(f, r)) {
      const sq = r * 8 + f;
      if (empty(sq)) out.push(sq);
      else {
        if (!own(sq)) out.push(sq);
        break;
      }
      f += df;
      r += dr;
    }
  }
  return out;
}

/** the board change an event makes; returns the squares it emptied */
export function applyMagicEvent(room, event) {
  const gone = [];
  if (event.t !== 'move') return gone;
  if (room.state.board[event.to]) {
    room.state.board = room.state.board.slice();
    room.state.board[event.to] = null;
    gone.push(event.to);
  }
  const piece = magicBoard(room.magic).get(event.to);
  if (piece && piece.kind === 'flowey') {
    for (const step of [-8, 8, -1, 1]) {
      const sq = event.to + step;
      if (sq < 0 || sq > 63) continue;
      if (Math.abs((sq & 7) - (event.to & 7)) > 1) continue;
      if (room.state.board[sq]) {
        room.state.board = room.state.board.slice();
        room.state.board[sq] = null;
        gone.push(sq);
      }
    }
  }
  return gone;
}

/** a normal chess move onto a magic square takes the magic piece off the board */
export function clearMagicAt(room, square) {
  if (!room.magic || !room.magic.length) return null;
  const at = magicBoard(room.magic).get(square);
  if (!at) return null;
  return { t: 'gone', sq: square };
}
