export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Move {
  from: number;
  to: number;
  promotion?: PieceType;
}

export interface GameState {
  board: (Piece | null)[];
  turn: Color;
  castling: string;
  ep: number | null;
  last: { from: number; to: number } | null;
  halfmove: number;
  fullmove: number;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const KNIGHT: Array<[number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const BISHOP_DIRS: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ROOK_DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const ALL_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];

/** Squares are 0..63 with 0 = a8 (top left) and 63 = h1 (bottom right). */
export const fileOf = (square: number) => square & 7;
export const rankOf = (square: number) => square >> 3;
const squareAt = (file: number, rank: number) => rank * 8 + file;
const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w');

function squareFromName(name: string): number {
  return squareAt(name.charCodeAt(0) - 97, 8 - Number(name[1]));
}

export function fromFen(fen: string): GameState {
  const [placement, turn, castling, ep] = fen.split(' ');
  const board: (Piece | null)[] = Array(64).fill(null);
  let index = 0;

  for (const character of placement) {
    if (character === '/') continue;
    if (character >= '1' && character <= '8') {
      index += Number(character);
      continue;
    }
    const color: Color = character === character.toUpperCase() ? 'w' : 'b';
    board[index] = { type: character.toLowerCase() as PieceType, color };
    index += 1;
  }

  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: castling === '-' ? '' : castling,
    ep: ep && ep !== '-' ? squareFromName(ep) : null,
    last: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function initialState(): GameState {
  return fromFen(START_FEN);
}

function attacked(board: (Piece | null)[], square: number, by: Color): boolean {
  const file = fileOf(square);
  const rank = rankOf(square);

  // pawns
  const pawnRank = rank + (by === 'w' ? 1 : -1);
  for (const df of [-1, 1]) {
    const f = file + df;
    if (!onBoard(f, pawnRank)) continue;
    const piece = board[squareAt(f, pawnRank)];
    if (piece && piece.color === by && piece.type === 'p') return true;
  }

  // knights
  for (const [df, dr] of KNIGHT) {
    const f = file + df;
    const r = rank + dr;
    if (!onBoard(f, r)) continue;
    const piece = board[squareAt(f, r)];
    if (piece && piece.color === by && piece.type === 'n') return true;
  }

  // king
  for (const [df, dr] of KING) {
    const f = file + df;
    const r = rank + dr;
    if (!onBoard(f, r)) continue;
    const piece = board[squareAt(f, r)];
    if (piece && piece.color === by && piece.type === 'k') return true;
  }

  // sliders
  for (const [df, dr] of ALL_DIRS) {
    let f = file + df;
    let r = rank + dr;
    while (onBoard(f, r)) {
      const piece = board[squareAt(f, r)];
      if (piece) {
        if (piece.color === by) {
          const diagonal = df !== 0 && dr !== 0;
          if (piece.type === 'q') return true;
          if (diagonal && piece.type === 'b') return true;
          if (!diagonal && piece.type === 'r') return true;
        }
        break;
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

export function kingSquare(state: GameState, color: Color): number {
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (piece && piece.type === 'k' && piece.color === color) return index;
  }
  return -1;
}

export function inCheck(state: GameState, color: Color): boolean {
  const king = kingSquare(state, color);
  if (king === -1) return false;
  return attacked(state.board, king, opposite(color));
}

function makeMove(state: GameState, move: Move): GameState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state;

  const color = piece.color;
  const fromFile = fileOf(move.from);
  const fromRank = rankOf(move.from);
  const toFile = fileOf(move.to);
  const toRank = rankOf(move.to);

  board[move.from] = null;

  // en passant: a pawn moving diagonally onto an empty square captures beside it
  if (piece.type === 'p' && fromFile !== toFile && !board[move.to]) {
    board[move.to + (color === 'w' ? 8 : -8)] = null;
  }

  const promotes = piece.type === 'p' && (toRank === 0 || toRank === 7);
  // never leave a pawn on the back rank: fall back to a queen
  board[move.to] = promotes ? { type: move.promotion ?? 'q', color } : piece;

  // castling: the rook jumps over the king
  if (piece.type === 'k' && Math.abs(toFile - fromFile) === 2) {
    if (toFile === 6) {
      board[move.to - 1] = board[move.to + 1];
      board[move.to + 1] = null;
    } else {
      board[move.to + 1] = board[move.to - 2];
      board[move.to - 2] = null;
    }
  }

  let castling = state.castling;
  const clear = (flags: string) => {
    for (const flag of flags) castling = castling.replace(flag, '');
  };
  if (piece.type === 'k') clear(color === 'w' ? 'KQ' : 'kq');
  if (piece.type === 'r') {
    if (move.from === 63) clear('K');
    if (move.from === 56) clear('Q');
    if (move.from === 7) clear('k');
    if (move.from === 0) clear('q');
  }
  // a rook captured on its home square also kills the right
  if (move.to === 63) clear('K');
  if (move.to === 56) clear('Q');
  if (move.to === 7) clear('k');
  if (move.to === 0) clear('q');

  return {
    board,
    turn: opposite(color),
    castling,
    ep: piece.type === 'p' && Math.abs(toRank - fromRank) === 2 ? (move.from + move.to) / 2 : null,
    last: { from: move.from, to: move.to },
    halfmove: state.halfmove + 1,
    fullmove: state.fullmove + (color === 'b' ? 1 : 0),
  };
}

function pseudoTargets(state: GameState, from: number, piece: Piece): number[] {
  const board = state.board;
  const file = fileOf(from);
  const rank = rankOf(from);
  const targets: number[] = [];

  const add = (f: number, r: number) => {
    if (!onBoard(f, r)) return;
    const other = board[squareAt(f, r)];
    if (other && other.color === piece.color) return;
    targets.push(squareAt(f, r));
  };

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRank = piece.color === 'w' ? 6 : 1;
    const one = rank + dir;
    if (onBoard(file, one) && !board[squareAt(file, one)]) {
      targets.push(squareAt(file, one));
      if (rank === startRank && !board[squareAt(file, rank + dir * 2)]) {
        targets.push(squareAt(file, rank + dir * 2));
      }
    }
    for (const df of [-1, 1]) {
      const f = file + df;
      const r = rank + dir;
      if (!onBoard(f, r)) continue;
      const target = board[squareAt(f, r)];
      if (target && target.color !== piece.color) targets.push(squareAt(f, r));
      else if (!target && state.ep === squareAt(f, r)) targets.push(squareAt(f, r));
    }
    return targets;
  }

  if (piece.type === 'n') {
    for (const [df, dr] of KNIGHT) add(file + df, rank + dr);
    return targets;
  }

  if (piece.type === 'k') {
    for (const [df, dr] of KING) add(file + df, rank + dr);

    const homeRank = piece.color === 'w' ? 7 : 0;
    if (rank === homeRank && file === 4 && !attacked(board, from, opposite(piece.color))) {
      const enemy = opposite(piece.color);
      const kingSide = piece.color === 'w' ? 'K' : 'k';
      const queenSide = piece.color === 'w' ? 'Q' : 'q';
      if (
        state.castling.includes(kingSide) &&
        !board[squareAt(5, homeRank)] &&
        !board[squareAt(6, homeRank)] &&
        !attacked(board, squareAt(5, homeRank), enemy)
      ) {
        targets.push(squareAt(6, homeRank));
      }
      if (
        state.castling.includes(queenSide) &&
        !board[squareAt(3, homeRank)] &&
        !board[squareAt(2, homeRank)] &&
        !board[squareAt(1, homeRank)] &&
        !attacked(board, squareAt(3, homeRank), enemy)
      ) {
        targets.push(squareAt(2, homeRank));
      }
    }
    return targets;
  }

  const dirs = piece.type === 'b' ? BISHOP_DIRS : piece.type === 'r' ? ROOK_DIRS : ALL_DIRS;
  for (const [df, dr] of dirs) {
    let f = file + df;
    let r = rank + dr;
    while (onBoard(f, r)) {
      const target = board[squareAt(f, r)];
      if (!target) {
        targets.push(squareAt(f, r));
      } else {
        if (target.color !== piece.color) targets.push(squareAt(f, r));
        break;
      }
      f += df;
      r += dr;
    }
  }

  return targets;
}

/** Destinations that are actually legal (own king cannot be left in check). */
export function legalMoves(state: GameState, from: number): number[] {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn) return [];

  const legal: number[] = [];
  for (const to of pseudoTargets(state, from, piece)) {
    const next = makeMove(state, { from, to, promotion: 'q' });
    if (!inCheck(next, piece.color)) legal.push(to);
  }
  return legal;
}

export function applyMove(state: GameState, from: number, to: number, promotion?: PieceType): GameState | null {
  if (from === to) return null;
  if (!legalMoves(state, from).includes(to)) return null;
  return makeMove(state, { from, to, promotion });
}

export function allMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (!piece || piece.color !== state.turn) continue;
    for (const to of legalMoves(state, index)) {
      if (piece.type === 'p' && (rankOf(to) === 0 || rankOf(to) === 7)) {
        for (const promotion of ['q', 'r', 'b', 'n'] as PieceType[]) {
          moves.push({ from: index, to, promotion });
        }
      } else {
        moves.push({ from: index, to });
      }
    }
  }
  return moves;
}

export type Status = 'playing' | 'check' | 'checkmate' | 'stalemate';

export function gameStatus(state: GameState): Status {
  const hasMove = allMoves(state).length > 0;
  const checked = inCheck(state, state.turn);
  if (!hasMove) return checked ? 'checkmate' : 'stalemate';
  return checked ? 'check' : 'playing';
}

/** Rebuilds the position from the move list the server keeps for the room. */
export function replay(moves: Move[]): GameState {
  let state = initialState();
  for (const move of moves) {
    const next = applyMove(state, move.from, move.to, move.promotion);
    if (!next) break;
    state = next;
  }
  return state;
}
