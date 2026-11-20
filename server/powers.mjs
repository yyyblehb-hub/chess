import { adminForUser } from './auth.mjs';
import {
  KINDS,
  TURN_KINDS,
  applyMagicEvent,
  clearMagicAt,
  fleeTargets,
  magicBoard,
  magicMoves,
} from './fairy.mjs';

/** a full deck, so the board never disappears under chaos pieces */
const MAX_MAGIC = 10;
/** two bosses a side is already more than a chess game can answer */
const MAX_BOSS = 2;

function magicFrame(room) {
  return { t: 'magic', events: room.magic };
}

function announce(room, send) {
  const payload = magicFrame(room);
  for (const player of room.players) send(player.ws, payload);
}

function merged(room) {
  return (room.magic || []).some((event) => event.t === 'omega');
}

/**
 * The admin's everything: spawn a piece or a boss on an empty square, move it,
 * fire a turn event that sends the other side's pieces running, land a
 * jumpscare on both screens, or merge the whole board into one king. Only the
 * account holding the menu may ask, and the server checks every rule before it
 * agrees, so a client cannot invent a camel's reach.
 */
export function powerMessage(ws, message, rooms, send, pushRoom) {
  if (!adminForUser(ws.data.account)) {
    send(ws, { t: 'error', message: 'Not allowed' });
    return;
  }

  const room = rooms.get(ws.data.roomCode);
  if (!room) return;
  const seat = room.players.findIndex((player) => player.ws === ws);
  if (seat === -1) return;
  if (!room.magic) room.magic = [];
  const side = seat === 0 ? 'w' : 'b';

  // a jumpscare moves no pieces, so it is not part of the replay log: the room
  // snapshot carries it once and both clients show it
  if (message.t === 'scare') {
    const face = Number(message.face);
    if (!Number.isInteger(face) || face < 0 || face > 4) return;
    if (merged(room)) return;
    room.scare = { face, by: room.players[seat].id, at: Date.now() };
    pushRoom(room);
    return;
  }

  if (message.t === 'turn') {
    const kind = String(message.kind || '');
    if (!TURN_KINDS.includes(kind)) return;
    if (merged(room)) return;
    const flees = fleeTargets(room, kind, side);
    if (flees.length === 0) {
      send(ws, { t: 'error', message: 'Nothing left to scare off' });
      return;
    }
    for (const event of flees) {
      room.magic.push(event);
      applyMagicEvent(room, event);
    }
    announce(room, send);
    return;
  }

  if (message.t === 'omega') {
    if (merged(room)) return;
    // any special piece still standing goes with the rest of the board
    for (const sq of magicBoard(room.magic).keys()) room.magic.push({ t: 'gone', sq });
    room.magic.push({ t: 'omega', side });
    applyMagicEvent(room, { t: 'omega', side });
    announce(room, send);
    return;
  }

  if (merged(room)) return;

  if (message.t === 'spawn') {
    const kind = String(message.kind || '');
    const spec = KINDS[kind];
    if (!spec) return;
    const sq = Number(message.square);
    if (!Number.isInteger(sq) || sq < 0 || sq > 63) return;
    const magic = magicBoard(room.magic);
    if (magic.size >= MAX_MAGIC) {
      send(ws, { t: 'error', message: 'The special board is full' });
      return;
    }
    if (spec.boss) {
      let bosses = 0;
      for (const piece of magic.values()) {
        if (KINDS[piece.kind]?.boss && piece.side === side) bosses += 1;
      }
      if (bosses >= MAX_BOSS) {
        send(ws, { t: 'error', message: 'Two bosses is the limit' });
        return;
      }
    }
    if (room.state.board[sq] || magic.has(sq)) return;
    room.magic.push({ t: 'spawn', sq, kind, side });
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
