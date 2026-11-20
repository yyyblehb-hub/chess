import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import express from 'express';
import { WebSocketServer } from 'ws';
import { applyMove, gameResult, initialState } from './chess.mjs';
import { accountCount, authRouter, clientIp, guard, readAppearance, userForToken } from './auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

const CAPACITY = 2;
const CODE_LENGTH = 5;
/** Always-on solo table for testing: one seat, you move both colours. */
const TEST_CODE = 'AAA4';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** @type {Map<string, { code: string, mode: string, players: Array<{ id: string, name: string, avatar: string | null, tag: string | null, ws: any }> }>} */
const rooms = new Map();
/** @type {any[]} */
const queue = [];

const app = express();
app.set('trust proxy', true);
app.use(compression());
app.use(express.json({ limit: '32kb' }));
// register / login / me / logout — the only way to get a session
app.use('/api/auth', authRouter);
const server = http.createServer(app);

// a plain uptime ping: it deliberately does not list table codes any more
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, tables: Math.max(0, rooms.size - 1), queued: queue.length, accounts: accountCount() });
});

if (isProd) {
  // hashed bundles, artwork and audio can be kept; index.html must be rechecked
  app.use(
    express.static(path.join(root, 'dist'), {
      setHeaders: (res, filePath) => {
        const cached = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader('Cache-Control', cached ? 'public, max-age=604800' : 'no-cache');
      },
    }),
  );
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  });
  app.use(vite.middlewares);
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function makeCode() {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('No room codes available');
}

function readPlayer(data, account) {
  // the identity is the signed-in account; only the artwork is client-supplied
  return { id: account.id, name: account.name, ...readAppearance(data), title: account.title ?? null };
}

function roomView(room) {
  return {
    code: room.code,
    mode: room.mode,
    capacity: room.solo ? 1 : CAPACITY,
    players: room.players.map(({ id, name, avatar, tag, title }) => ({
      id,
      name,
      avatar,
      tag: tag || null,
      title: title || null,
    })),
    moves: room.moves,
    turn: room.state.turn,
    solo: room.solo === true,
  };
}

function pushRoom(room) {
  const payload = { t: 'room', room: roomView(room) };
  for (const player of room.players) send(player.ws, payload);
}

function dropFromQueue(ws) {
  const index = queue.indexOf(ws);
  if (index !== -1) queue.splice(index, 1);
  ws.data.searching = false;
}

function leaveRoom(ws, { notify = true } = {}) {
  const code = ws.data.roomCode;
  if (!code) return;
  ws.data.roomCode = null;
  const room = rooms.get(code);
  if (!room) return;

  room.players = room.players.filter((player) => player.ws !== ws);
  if (room.players.length === 0) {
    if (room.solo) {
      room.moves = [];
      room.state = initialState();
      return;
    }
    rooms.delete(code);
    return;
  }

  // a finished game keeps its final position: the player still at the table
  // reads the result instead of watching the game disappear
  const finished = gameResult(room.state, room.moves) !== null;
  if (!finished) {
    room.moves = [];
    room.state = initialState();
  }

  pushRoom(room);
  if (notify) {
    for (const player of room.players) {
      send(player.ws, { t: 'notice', message: 'Opponent left' });
    }
  }
}

function seatPlayer(ws, player, mode) {
  leaveRoom(ws);
  dropFromQueue(ws);
  const code = makeCode();
  const room = { code, mode, players: [{ ...player, ws }], moves: [], state: initialState() };
  rooms.set(code, room);
  ws.data.roomCode = code;
  pushRoom(room);
  return room;
}

function tryPair() {
  const waiting = queue.filter((ws) => ws.readyState === 1 && !ws.data.roomCode);
  queue.length = 0;

  for (let i = 0; i + 1 < waiting.length; i += 2) {
    const first = waiting[i];
    const second = waiting[i + 1];
    const code = makeCode();
    const room = {
      code,
      mode: 'random',
      players: [
        { ...first.data.player, ws: first },
        { ...second.data.player, ws: second },
      ],
      moves: [],
      state: initialState(),
    };
    rooms.set(code, room);
    first.data.roomCode = code;
    second.data.roomCode = code;
    first.data.searching = false;
    second.data.searching = false;
    pushRoom(room);
  }

  const leftover = waiting.length % 2 === 1 ? waiting[waiting.length - 1] : null;
  if (leftover) queue.push(leftover);
}

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname, searchParams } = new URL(req.url || '/', 'http://localhost');
  if (pathname !== '/ws') return;

  const ip = clientIp(req);
  const room = guard.blocked(ip);
  if (room) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  // no session, no lobby: the handshake itself is refused, so a bot never
  // gets a socket to talk to (a proxied close would just hang instead)
  const account = userForToken(searchParams.get('token'));
  if (!account) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!guard.allowSocket(ip)) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, account, ip));
});

wss.on('connection', (ws, _req, account, ip) => {
  ws.data = {
    roomCode: null,
    searching: false,
    ip,
    account,
    player: { id: account.id, name: account.name, avatar: null, tag: null, title: account.title ?? null },
  };
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!message || typeof message.t !== 'string') return;

    // client heartbeat: inbound traffic keeps a sleeping free host awake
    if (message.t === 'ping') return;

    if (message.t !== 'leave') {
      ws.data.player = readPlayer(message, ws.data.account);
    }

    // menu handshake: claim the sign-in (and the title it earns) without seating a player
    if (message.t === 'hello') {
      send(ws, { t: 'title', title: ws.data.player.title });
      return;
    }

    if (message.t === 'create') {
      if (!guard.noteRoom(ws.data.ip)) {
        send(ws, { t: 'error', message: 'Too many tables from this connection' });
        return;
      }
      seatPlayer(ws, ws.data.player, 'create');
      return;
    }

    if (message.t === 'find') {
      if (!guard.noteRoom(ws.data.ip)) {
        send(ws, { t: 'error', message: 'Too many searches from this connection' });
        return;
      }
      if (ws.data.roomCode) leaveRoom(ws);
      dropFromQueue(ws);
      queue.push(ws);
      ws.data.searching = true;
      send(ws, { t: 'searching' });
      tryPair();
      return;
    }

    if (message.t === 'join') {
      const code = String(message.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!code || !room) {
        send(ws, { t: 'error', message: 'Invalid code' });
        return;
      }
      if (room.players.length >= (room.solo ? 1 : CAPACITY)) {
        send(ws, { t: 'error', message: room.solo ? 'Test table is busy' : 'Table is full' });
        return;
      }
      if (room.players.some((player) => player.id && player.id === ws.data.player.id)) {
        send(ws, { t: 'error', message: 'Already in this table' });
        return;
      }
      leaveRoom(ws);
      dropFromQueue(ws);
      room.players.push({ ...ws.data.player, ws });
      ws.data.roomCode = code;
      pushRoom(room);
      return;
    }

    if (message.t === 'move') {
      const room = rooms.get(ws.data.roomCode);
      if (!room || room.players.length < (room.solo ? 1 : CAPACITY)) return;

      // the board shows moves before the server sees them, so a rejected move
      // comes back as the authoritative snapshot and rolls that square back
      const resync = () => send(ws, { t: 'room', room: roomView(room) });

      const index = room.players.findIndex((player) => player.ws === ws);
      if (index === -1) return;
      if (!room.solo) {
        const color = index === 0 ? 'w' : 'b';
        if (room.state.turn !== color) return resync();
      }

      const from = Number(message.move?.from);
      const to = Number(message.move?.to);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63 || from === to) {
        return resync();
      }

      const requested = message.move?.promotion;
      const promotion = ['q', 'r', 'b', 'n'].includes(requested) ? requested : undefined;

      // a finished game stays finished, even if a client keeps sending moves
      if (gameResult(room.state, room.moves) !== null) return resync();

      // the rules live in the shared engine, so a bogus move can never desync the boards
      const next = applyMove(room.state, from, to, promotion);
      if (!next) return resync();

      room.state = next;
      const move = promotion ? { from, to, promotion } : { from, to };
      room.moves.push(move);

      for (const player of room.players) {
        send(player.ws, { t: 'move', move, turn: next.turn });
      }
      return;
    }

    if (message.t === 'chat') {
      const room = rooms.get(ws.data.roomCode);
      if (!room) return;
      const from = room.players.find((player) => player.ws === ws);
      if (!from) return;
      const text = typeof message.text === 'string' ? message.text.trim().slice(0, 300) : '';
      if (!text) return;
      // the sender id lets each client line its own messages up on the right;
      // the timestamp is what the bubble footer shows
      const payload = { t: 'chat', id: from.id, from: from.name, text, at: Date.now() };
      for (const player of room.players) send(player.ws, payload);
      return;
    }

    if (message.t === 'rematch') {
      const room = rooms.get(ws.data.roomCode);
      if (!room) return;
      if (room.players.findIndex((player) => player.ws === ws) === -1) return;

      // a finished table can be started again; a live game only in the solo test room
      if (!room.solo && gameResult(room.state, room.moves) === null) return;

      room.state = initialState();
      room.moves = [];
      pushRoom(room);
      return;
    }

    if (message.t === 'leave') {
      dropFromQueue(ws);
      leaveRoom(ws);
      send(ws, { t: 'left' });
    }
  });

  ws.on('close', () => {
    dropFromQueue(ws);
    leaveRoom(ws);
    guard.dropSocket(ip);
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));

rooms.set(TEST_CODE, {
  code: TEST_CODE,
  mode: 'test',
  solo: true,
  players: [],
  moves: [],
  state: initialState(),
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Chess lobby listening on http://0.0.0.0:${PORT}`);
});
