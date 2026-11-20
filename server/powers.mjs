import { adminForUser } from './auth.mjs';
import { KINDS, applyMagicEvent, clearMagicAt, magicBoard, magicMoves } from './fairy.mjs';

/** a full deck, so the board never disappears under chaos pieces */
const MAX_MAGIC = 10;

function magicFrame(room) {
  return { t: 'magic', events: room.magic };
}

function announce(room, send) {
  const payload = magicFrame(room);
  for (const player of room.players) send(player.ws, payload);
}

/**
 * The admin's special pieces: spawn one on an empty square, then move it by its
 * own rules. Only the account holding the menu may ask, and the server checks
 * the jump before it agrees, so a client cannot invent a camel's reach.
 */
export function powerMessage(ws, message, rooms, send) {
  if (!adminForUser(ws.data.account)) {
    send(ws, { t: 'error', message: 'Not allowed' });
    return;
  }

  const room = rooms.get(ws.data.roomCode);
  if (!room) return;
  const seat = room.players.findIndex((player) => player.ws === ws);
  if (seat === -1) return;
  if (!room.magic) room.magic = [];

  if (message.t === 'spawn') {
    const kind = String(message.kind || '');
    if (!KINDS[kind]) return;
    const sq = Number(message.square);
    if (!Number.isInteger(sq) || sq < 0 || sq > 63) return;
    const magic = magicBoard(room.magic);
    if (magic.size >= MAX_MAGIC) {
      send(ws, { t: 'error', message: 'The special board is full' });
      return;
    }
    if (room.state.board[sq] || magic.has(sq)) return;
    room.magic.push({ t: 'spawn', sq, kind, side: seat === 0 ? 'w' : 'b' });
    announce(room, send);
    return;
  }

  if (message.t === 'magic') {
    const from = Number(message.from);
    const to = Number(message.to);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    if (from < 0 || from > 63 || to < 0 || to > 63 || from === to) return;
    const legal = magicMoves(room.state.board, magicBoard(room.magic), from);
    if (!legal.includes(to)) return;
    room.magic.push({ t: 'move', from, to });
    applyMagicEvent(room, { t: 'move', from, to });
    announce(room, send);
  }
}

/** a normal piece stepping onto a magic square takes it off the board */
export function magicAfterMove(room, square) {
  const gone = clearMagicAt(room, square);
  if (!gone) return null;
  room.magic.push(gone);
  return magicFrame(room);
}
