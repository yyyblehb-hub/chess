import { adminForUser } from './auth.mjs';

/**
 * The admin's sniper, for both boards.
 *
 * 'aim' carries the moving sight, so the opponent watches the red square slide
 * over their pieces; 'shoot' takes the piece off the board. Only the account
 * holding the admin menu may send either, and a forged frame is refused.
 * One shot per turn, and the room remembers the squares so a rejoin, a move
 * review and a rematch all agree with what was played.
 */
export function sniperMessage(ws, message, rooms, send) {
  if (!adminForUser(ws.data.account)) {
    send(ws, { t: 'error', message: 'Not allowed' });
    return;
  }

  const room = rooms.get(ws.data.roomCode);
  if (!room) return;
  if (room.players.findIndex((player) => player.ws === ws) === -1) return;

  if (message.t === 'aim') {
    const x = Number(message.x);
    const y = Number(message.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const payload = {
      t: 'aim',
      on: message.on !== false,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
    for (const player of room.players) {
      if (player.ws !== ws) send(player.ws, payload);
    }
    return;
  }

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
