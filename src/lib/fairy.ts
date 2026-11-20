import type { Color, GameState, PieceType } from './chess';

import camelW from '../assets/magic/camel-w.svg';
import camelB from '../assets/magic/camel-b.svg';
import zebraW from '../assets/magic/zebra-w.svg';
import zebraB from '../assets/magic/zebra-b.svg';
import alfilW from '../assets/magic/alfil-w.svg';
import alfilB from '../assets/magic/alfil-b.svg';
import dabbabaW from '../assets/magic/dabbaba-w.svg';
import dabbabaB from '../assets/magic/dabbaba-b.svg';
import giraffeW from '../assets/magic/giraffe-w.svg';
import giraffeB from '../assets/magic/giraffe-b.svg';
import floweyArt from '../assets/magic/flowey.svg';

/**
 * Special pieces sit outside the normal engine, so the fifty-year-old rules of
 * chess never have to learn about a camel. The admin spawns them, they move by
 * their own table, and every change is an event in an ordered log: both players
 * replay the log over the position, so a rejoin or a move review still agrees.
 *
 * The same log carries the turn events (a piece running off the board) and the
 * final merge, because those move pieces too and must replay identically.
 *
 * The five leapers and the five bosses wear the Wikimedia fairy set
 * (transparent SVG, one file per colour); Flowey's flower is drawn here.
 */
export type MagicKind =
  | 'camel'
  | 'zebra'
  | 'alfil'
  | 'dabbaba'
  | 'giraffe'
  | 'flowey'
  | 'warlord'
  | 'sorcerer'
  | 'wyvern'
  | 'hydra'
  | 'colossus';

export type MagicPiece = { kind: MagicKind; side: Color };

/** a piece that has just fled: where it stood, which way it ran */
export type Flee = { sq: number; dir: number; color: Color; type: PieceType };

export type MagicEvent =
  | { t: 'spawn'; sq: number; kind: MagicKind; side: Color }
  | { t: 'move'; from: number; to: number }
  | { t: 'gone'; sq: number }
  | { t: 'flee'; sq: number; dir: number; color: Color; type: PieceType }
  | { t: 'omega'; side: Color };

type Spec = {
  label: string;
  glyph: string;
  jumps: number[][];
  slides?: number[][];
  /** how far a slider reaches; unlimited when absent */
  reach?: number;
  boss?: boolean;
  art: Record<Color, string>;
};

const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN = [...ROOK, ...BISHOP];

export const KINDS: Record<MagicKind, Spec> = {
  camel: {
    label: 'Camel',
    glyph: 'C',
    jumps: [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]],
    art: { w: camelW, b: camelB },
  },
  zebra: {
    label: 'Zebra',
    glyph: 'Z',
    jumps: [[2, 3], [3, 2], [3, -2], [2, -3], [-2, -3], [-3, -2], [-3, 2], [-2, 3]],
    art: { w: zebraW, b: zebraB },
  },
  alfil: {
    label: 'Alfil',
    glyph: 'A',
    jumps: [[2, 2], [2, -2], [-2, 2], [-2, -2]],
    art: { w: alfilW, b: alfilB },
  },
  dabbaba: {
    label: 'Dabbaba',
    glyph: 'D',
    jumps: [[0, 2], [2, 0], [0, -2], [-2, 0]],
    art: { w: dabbabaW, b: dabbabaB },
  },
  giraffe: {
    label: 'Giraffe',
    glyph: 'G',
    jumps: [[1, 4], [4, 1], [4, -1], [1, -4], [-1, -4], [-4, -1], [-4, 1], [-1, 4]],
    art: { w: giraffeW, b: giraffeB },
  },
  // the one with superpowers: the queen's reach, and it burns what stands next to it
  flowey: {
    label: 'Omega Flowey',
    glyph: '✿',
    jumps: [],
    slides: QUEEN,
    art: { w: floweyArt, b: floweyArt },
  },
  // ---------- bosses: the same log, a much worse piece ----------
  warlord: {
    label: 'Warlord',
    glyph: '♜',
    jumps: KING_STEPS,
    slides: ROOK,
    boss: true,
    art: { w: giraffeW, b: giraffeB },
  },
  sorcerer: {
    label: 'Sorcerer',
    glyph: '✦',
    jumps: KNIGHT_JUMPS,
    slides: BISHOP,
    boss: true,
    art: { w: zebraW, b: zebraB },
  },
  wyvern: {
    label: 'Wyvern',
    glyph: '⌁',
    jumps: [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]],
    slides: ROOK,
    boss: true,
    art: { w: camelW, b: camelB },
  },
  hydra: {
    label: 'Hydra',
    glyph: '☠',
    jumps: [],
    slides: QUEEN,
    reach: 2,
    boss: true,
    art: { w: alfilW, b: alfilB },
  },
  colossus: {
    label: 'Colossus',
    glyph: '⬢',
    jumps: [...KING_STEPS, [0, 2], [2, 0], [0, -2], [-2, 0]],
    boss: true,
    art: { w: dabbabaW, b: dabbabaB },
  },
};

export const MAGIC_ORDER: MagicKind[] = ['camel', 'zebra', 'alfil', 'dabbaba', 'giraffe', 'flowey'];
export const BOSS_ORDER: MagicKind[] = ['warlord', 'sorcerer', 'wyvern', 'hydra', 'colossus'];

const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
const squareOf = (file: number, rank: number) => rank * 8 + file;

type Cell = { color: Color } | null;

/** the squares a magic piece can reach from where it stands */
export function magicMoves(
  board: Cell[],
  magic: Map<number, MagicPiece>,
  from: number,
  side: Color,
): number[] {
  const piece = magic.get(from);
  if (!piece) return [];
  const spec = KINDS[piece.kind];
  const own = (sq: number) => {
    const other = magic.get(sq);
    if (other) return other.side === side;
    const cell = board[sq];
    return Boolean(cell && cell.color === side);
  };
  const empty = (sq: number) => !board[sq] && !magic.has(sq);

  const file = from & 7;
  const rank = from >> 3;
  const reach = spec.reach ?? 8;
  const out: number[] = [];

  for (const [df, dr] of spec.slides ?? []) {
    let f = file + df;
    let r = rank + dr;
    let step = 0;
    while (onBoard(f, r) && step < reach) {
      const sq = squareOf(f, r);
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
    const sq = squareOf(file + df, rank + dr);
    if (empty(sq) || !own(sq)) out.push(sq);
  }
  return out;
}

/** every magic piece standing on the board, replayed from the event log */
export function magicBoard(events: MagicEvent[] | undefined): Map<number, MagicPiece> {
  const map = new Map<number, MagicPiece>();
  if (!events) return map;
  for (const event of events) {
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

/** the fresh flee events in the log, for the run-off animation */
export function fleeList(events: MagicEvent[] | undefined): Flee[] {
  const out: Flee[] = [];
  for (const event of events ?? []) {
    if (event.t === 'flee') out.push({ sq: event.sq, dir: event.dir, color: event.color, type: event.type });
  }
  return out;
}

/** which side the board was merged into, if the final boss is on the table */
export function omegaOf(events: MagicEvent[] | undefined): Color | null {
  let side: Color | null = null;
  for (const event of events ?? []) if (event.t === 'omega') side = event.side;
  return side;
}

/** the position with the event log laid over it */
export function applyEvents(
  state: GameState,
  events: MagicEvent[] | undefined,
): { state: GameState; magic: Map<number, MagicPiece> } {
  const magic = magicBoard(events);
  if (!events || events.length === 0) return { state, magic };

  let board = state.board.slice();
  let touched = false;

  for (const event of events) {
    if (event.t === 'move') {
      const piece = magic.get(event.to);
      if (!piece) continue;
      if (board[event.to]) {
        board[event.to] = null;
        touched = true;
      }
      // Flowey's superpower: whatever stood beside the square it lands on burns
      if (piece.kind === 'flowey') {
        for (const step of [-8, 8, -1, 1]) {
          const sq = event.to + step;
          if (sq < 0 || sq > 63) continue;
          if (Math.abs((sq & 7) - (event.to & 7)) > 1) continue;
          if (board[sq]) {
            board[sq] = null;
            touched = true;
          }
        }
      }
    } else if (event.t === 'gone' && board[event.sq]) {
      board[event.sq] = null;
      touched = true;
    } else if (event.t === 'flee' && board[event.sq]) {
      board[event.sq] = null;
      touched = true;
    } else if (event.t === 'omega') {
      board = Array(64).fill(null);
      touched = true;
    }
  }

  return { state: touched ? { ...state, board } : state, magic };
}
