import type { Color, GameState } from './chess';

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
 * The five leapers are the Wikimedia Commons fairy set (transparent SVG, one
 * file per colour); Flowey's flower is drawn here, petal by petal.
 */
export type MagicKind = 'camel' | 'zebra' | 'alfil' | 'dabbaba' | 'giraffe' | 'flowey';

export type MagicPiece = { kind: MagicKind; side: Color };

export type MagicEvent =
  | { t: 'spawn'; sq: number; kind: MagicKind; side: Color }
  | { t: 'move'; from: number; to: number }
  | { t: 'gone'; sq: number };

type Spec = { label: string; glyph: string; jumps: number[][]; slider?: boolean; art: Record<Color, string> };

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
    slider: true,
    art: { w: floweyArt, b: floweyArt },
  },
};

export const MAGIC_ORDER: MagicKind[] = ['camel', 'zebra', 'alfil', 'dabbaba', 'giraffe', 'flowey'];

const QUEEN = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

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
  const out: number[] = [];

  for (const [df, dr] of spec.slider ? QUEEN : spec.jumps) {
    if (!spec.slider) {
      if (!onBoard(file + df, rank + dr)) continue;
      const sq = squareOf(file + df, rank + dr);
      if (empty(sq) || !own(sq)) out.push(sq);
      continue;
    }
    let f = file + df;
    let r = rank + dr;
    while (onBoard(f, r)) {
      const sq = squareOf(f, r);
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

/** every magic piece standing on the board, replayed from the event log */
export function magicBoard(events: MagicEvent[] | undefined): Map<number, MagicPiece> {
  const map = new Map<number, MagicPiece>();
  if (!events) return map;
  for (const event of events) {
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

/** the position with the event log laid over it */
export function applyEvents(
  state: GameState,
  events: MagicEvent[] | undefined,
): { state: GameState; magic: Map<number, MagicPiece> } {
  const magic = magicBoard(events);
  if (!events || events.length === 0) return { state, magic };

  const board = state.board.slice();
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
    }
  }

  return { state: touched ? { ...state, board } : state, magic };
}
