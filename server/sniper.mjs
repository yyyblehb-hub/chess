import { adminForUser } from './auth.mjs';

/**
 * The admin's sniper. One shot per turn, any piece on the board, and the room
 * remembers the squares so a rejoin or a rematch agrees with what was played.
 * Only the account holding the admin menu may fire; a forged frame is refused.
 */
export function sniper(ws, message, rooms, send) {
  if (!adminForUser(ws.data.account)) {
    send(ws, { t: 'error', message: 'Not allowed' });
    return;
  }

  const room = rooms.get(ws.data.roomCode);
  if (!room) return;
  if (room.players.findIndex((player) => player.ws === ws) === -1) return;
  if (!room.shots) room.shots = [];

  // one bullet a turn: a new move refills it
  if (room.shotAt === room.moves.length) {
    send(ws, { t: 'error', message: 'Sniper is out of bullets this turn' });
    return;
  }

  const square = Number(message.square);
  if (!Number.isInteger(square) || square < 0 || square > 63) return;
  if (!room.state.board[square]) return;

  const board = room.state.board.slice();
  board[square] = null;
  room.state = { ...room.state, board, last: null };
  room.shots.push(square);
  room.shotAt = room.moves.length;

  const payload = { t: 'shoot', square, shots: room.shots };
  for (const player of room.players) send(player.ws, payload);
}
