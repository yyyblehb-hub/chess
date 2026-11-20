import type { GameState } from './chess';

/**
 * The admin sniper takes pieces off the board, and a position is still built by
 * replaying the moves. The shot squares are laid over the replay, so both
 * players, a rejoin and a move review all end up with the same board.
 */
export function applyShots(state: GameState, shots: number[] | undefined): GameState {
  if (!shots || shots.length === 0) return state;
  const board = state.board.slice();
  let touched = false;
  for (const square of shots) {
    if (Number.isInteger(square) && square >= 0 && square < 64 && board[square]) {
      board[square] = null;
      touched = true;
    }
  }
  return touched ? { ...state, board, last: null } : state;
}
