/**
 * The special pieces, server side. The client owns the pretty version of these
 * rules; this copy is what actually decides, because a client can lie about a
 * camel's jump just as easily as about a move. It also decides which piece runs
 * off the board when the admin fires a turn event, so both players watch the
 * same piece leave.
 */
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN = [...ROOK, ...BISHOP];

export const KINDS = {
  camel: { jumps: [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]] },
  zebra: { jumps: [[2, 3], [3, 2], [3, -2], [2, -3], [-2, -3], [-3, -2], [-3, 2], [-2, 3]] },
  alfil: { jumps: [[2, 2], [2, -2], [-2, 2], [-2, -2]] },
  dabbaba: { jumps: [[0, 2], [2, 0], [0, -2], [-2, 0]] },
  giraffe: { jumps: [[1, 4], [4, 1], [4, -1], [1, -4], [-1, -4], [-4, -1], [-4, 1], [-1, 4]] },
  flowey: { jumps: [], slides: QUEEN },
  warlord: { jumps: KING_STEPS, slides: ROOK, boss: true },
  sorcerer: { jumps: KNIGHT_JUMPS, slides: BISHOP, boss: true },
  wyvern: { jumps: [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]], slides: ROOK, boss: true },
  hydra: { jumps: [], slides: QUEEN, reach: 2, boss: true },
  colossus: { jumps: [...KING_STEPS, [0, 2], [2, 0], [0, -2], [-2, 0]], boss: true },
};

export const TURN_KINDS = ['bolt', 'panic', 'desert', 'vanish', 'stampede'];

const onBoard = (file, rank) => file >= 0 && file < 8 && rank >= 0 && rank < 8;

/** the log replayed into square -> piece */
export function magicBoard(events) {
  const map = new Map();
  for (const event of events || []) {
    if (event.t === 'spawn') map.set(event.sq, { kind: event.kind, side: event.side });
    else if (event.t === 'gone') map.delete(event.sq);
    else if (event.t === 'move') {
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
  const reach = spec.reach ?? 8;
  const out = [];

  for (const [df, dr] of spec.slides || []) {
    let f = file + df;
    let r = rank + dr;
    let step = 0;
    while (onBoard(f, r) && step < reach) {
      const sq = r * 8 + f;
      if (empty(sq)) out.push(sq);
      else {
        if (!own(sq)) out.push(sq);
        break;
      }
      f += df;
      r += dr;
      step += 1;
    }
  }

  for (const [df, dr] of spec.jumps) {
    if (!onBoard(file + df, rank + dr)) continue;
    const sq = (rank + dr) * 8 + (file + df);
    if (empty(sq) || !own(sq)) out.push(sq);
  }
  return out;
}

/** which edge the piece runs for: 0 left, 1 right, 2 up, 3 down */
function fleeDir(sq) {
  const file = sq & 7;
  const rank = sq >> 3;
  const distance = [file, 7 - file, rank, 7 - rank];
  let dir = 0;
  for (let i = 1; i < 4; i += 1) if (distance[i] < distance[dir]) dir = i;
  return dir;
}

/**
 * The piece (or pieces) that leave for a turn event. The king never runs: an
 * empty throne would end the game instead of playing the joke.
 */
export function fleeTargets(room, kind, side) {
  const enemy = side === 'w' ? 'b' : 'w';
  const pool = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = room.state.board[sq];
    if (!piece || piece.color !== enemy || piece.type === 'k') continue;
    const advance = piece.color === 'w' ? 7 - (sq >> 3) : sq >> 3;
    pool.push({ sq, type: piece.type, color: piece.color, advance });
  }
  const lead = pool.slice().sort((a, b) => b.advance - a.advance);
  let picked = [];
  if (kind === 'bolt') picked = lead.slice(0, 1);
  else if (kind === 'panic') picked = pool.filter((piece) => piece.type === 'q').slice(0, 1);
  else if (kind === 'desert') picked = pool.filter((piece) => piece.type === 'p').slice(0, 1);
  else if (kind === 'vanish') picked = pool.filter((piece) => piece.type === 'n').slice(0, 1);
  else if (kind === 'stampede') picked = lead.slice(0, 3);
  if (!picked.length) picked = lead.slice(0, 1);

  return picked.map((piece) => ({
    t: 'flee',
    sq: piece.sq,
    dir: fleeDir(piece.sq),
    color: piece.color,
    type: piece.type,
  }));
}

/** the board change an event makes; returns the squares it emptied */
export function applyMagicEvent(room, event) {
  if (event.t === 'flee') {
    if (!room.state.board[event.sq]) return [];
    room.state.board = room.state.board.slice();
    room.state.board[event.sq] = null;
    return [event.sq];
  }
  if (event.t === 'omega') {
    room.state.board = Array(64).fill(null);
    return [];
  }
  if (event.t !== 'move') return [];

  const gone = [];
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
