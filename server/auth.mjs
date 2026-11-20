import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

/**
 * Accounts, sessions and the connection guard.
 *
 * Everything here is keyed to a real account: the server issues the player id,
 * so a client can no longer claim to be somebody else, and a socket without a
 * session is never allowed to look at the lobby at all.
 */

const DATA = path.join(process.cwd(), 'server', 'data');
const ACCOUNTS_FILE = path.join(DATA, 'accounts.json');
const BLOCKS_FILE = path.join(DATA, 'blocked.json');
const ADMIN_FILE = path.join(DATA, 'admin.json');
const PLAYERS_FILE = path.join(DATA, 'players.json');
const PINNED_FIRST = (process.env.GM_ID || '').trim();

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/* ---------- storage ---------- */

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
  } catch {
    /* read-only host: the change only lives for this process, which is fine */
  }
}

/** @type {Map<string, any>} lowercased name -> account */
const accounts = new Map(Object.entries(readJson(ACCOUNTS_FILE, {})));

function saveAccounts() {
  writeJson(ACCOUNTS_FILE, Object.fromEntries(accounts));
}

/** Sign-in order, oldest first. The first account ever made carries GM. */
const signIns = (() => {
  const ids = PINNED_FIRST ? [PINNED_FIRST] : [];
  const saved = readJson(PLAYERS_FILE, []);
  for (const id of Array.isArray(saved) ? saved : []) {
    if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
})();

function titleFor(id) {
  if (!id) return null;
  if (!signIns.includes(id)) {
    signIns.push(id);
    writeJson(PLAYERS_FILE, signIns);
  }
  return signIns[0] === id ? 'GM' : null;
}

/* ---------- passwords ---------- */

function makeHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyHash(stored, password) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const known = Buffer.from(hash, 'hex');
  const check = crypto.scryptSync(password, salt, 32);
  return known.length === check.length && crypto.timingSafeEqual(known, check);
}

/* ---------- names ---------- */

const ALLOWED = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,15}$/;
/** Ghost56, bot_12, player1234 — a word with digits stuck on the end */
const AUTOMATED = /^[a-z]{2,}[ _.-]?\d{1,5}$/i;

function nameProblem(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!ALLOWED.test(name)) return 'Names are 2–16 letters, numbers, spaces, . _ or -';
  if (!/[a-z]/i.test(name)) return 'Add at least one letter to the name';
  if (AUTOMATED.test(name)) return 'Names ending in numbers look automated — pick another';
  if (/bot/i.test(name)) return 'That name looks automated — pick another';
  return null;
}

/* ---------- sessions ---------- */

const SESSION_MS = 30 * DAY;
/** @type {Map<string, { name: string, at: number }>} */
const sessions = new Map();

function issue(account) {
  const token = crypto.randomBytes(24).toString('base64url');
  sessions.set(token, { name: account.name.toLowerCase(), at: Date.now() });
  return token;
}

export function userForToken(token) {
  if (typeof token !== 'string' || !token) return null;
  const hit = sessions.get(token);
  if (!hit) return null;
  if (Date.now() - hit.at > SESSION_MS) {
    sessions.delete(token);
    return null;
  }
  const account = accounts.get(hit.name);
  if (!account) {
    sessions.delete(token);
    return null;
  }
  return { id: account.id, name: account.name, title: account.title ?? null };
}

function revoke(token) {
  if (typeof token === 'string') sessions.delete(token);
}

/** bumps every session at once — used when the server changes the rules */
export function revokeAll() {
  sessions.clear();
}

/** avatars and tags travel as data URLs; anything else is dropped */
export function readAppearance(data) {
  const image = (value) =>
    typeof value === 'string' && value.startsWith('data:image/') && value.length < 120_000
      ? value
      : null;
  return { avatar: image(data?.avatar), tag: image(data?.tag) };
}

export function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

/* ---------- the connection guard ---------- */

const blocks = readJson(BLOCKS_FILE, {});
/** @type {Map<string, { regs: number[], fails: number[], rooms: number[], conns: number, until: number, strikes: number }>} */
const watch = new Map();

function watchFor(ip) {
  let state = watch.get(ip);
  if (!state) {
    state = { regs: [], fails: [], rooms: [], conns: 0, until: 0, strikes: 0 };
    watch.set(ip, state);
  }
  return state;
}

function recent(list, windowMs) {
  const cutoff = Date.now() - windowMs;
  return list.filter((at) => at > cutoff);
}

/** three temporary blocks and the address is blocked for good */
function strike(ip, reason, ms) {
  const state = watchFor(ip);
  state.until = Date.now() + ms;
  state.strikes += 1;
  if (state.strikes >= 3 && !blocks[ip]) {
    blocks[ip] = { reason, at: new Date().toISOString() };
    writeJson(BLOCKS_FILE, blocks);
  }
}

export const guard = {
  blocked(ip) {
    if (blocks[ip]) return 'This connection is blocked';
    const state = watchFor(ip);
    if (state.until > Date.now()) return 'Too many attempts — try again in a little while';
    return null;
  },
  noteRegister(ip) {
    const state = watchFor(ip);
    state.regs = recent(state.regs, DAY);
    if (state.regs.length >= 3) {
      strike(ip, 'register flood', DAY);
      return false;
    }
    state.regs.push(Date.now());
    return true;
  },
  noteFail(ip) {
    const state = watchFor(ip);
    state.fails = recent(state.fails, 15 * MINUTE);
    state.fails.push(Date.now());
    if (state.fails.length >= 8) {
      strike(ip, 'login flood', 15 * MINUTE);
      return false;
    }
    return true;
  },
  /** a socket is only opened after the account behind it is known */
  allowSocket(ip) {
    const state = watchFor(ip);
    if (state.conns >= 4) return false;
    state.conns += 1;
    return true;
  },
  dropSocket(ip) {
    const state = watchFor(ip);
    state.conns = Math.max(0, state.conns - 1);
  },
  /** stops one address from filling the random queue with tables */
  noteRoom(ip) {
    const state = watchFor(ip);
    state.rooms = recent(state.rooms, 10 * MINUTE);
    if (state.rooms.length >= 6) {
      strike(ip, 'table flood', 30 * MINUTE);
      return false;
    }
    state.rooms.push(Date.now());
    return true;
  },
};

/* ---------- the admin claim ---------- */

/** ADMIN_NAME pins the claim to one account before anyone else can take it */
const ADMIN_NAME = (process.env.ADMIN_NAME || '').trim().toLowerCase();
let adminRecord = readJson(ADMIN_FILE, null);

/** the account holding the menu, if it has been claimed at all */
export function adminHolder() {
  return adminRecord ? { id: adminRecord.id, name: adminRecord.name } : null;
}

function holdsAdmin(user) {
  return Boolean(adminRecord && user && adminRecord.id === user.id);
}

/**
 * The first signed-in account that asks keeps the menu for good. It is never
 * handed to a second account and signing out does not release it.
 */
function claimAdmin(user) {
  if (ADMIN_NAME && user.name.toLowerCase() !== ADMIN_NAME) return null;
  if (!adminRecord) {
    adminRecord = { id: user.id, name: user.name, at: new Date().toISOString() };
    writeJson(ADMIN_FILE, adminRecord);
    return adminRecord;
  }
  return holdsAdmin(user) ? adminRecord : null;
}

/* ---------- http ---------- */

function bearer(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export const authRouter = express.Router();

authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

authRouter.post('/register', (req, res) => {
  const ip = clientIp(req);
  const stop = guard.blocked(ip);
  if (stop) return res.status(429).json({ error: stop });

  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
  const password = String(req.body?.password || '');
  const problem = nameProblem(name);
  if (problem) return res.status(400).json({ error: problem });
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: 'Passwords are 6–72 characters' });
  }
  if (accounts.has(name.toLowerCase())) {
    return res.status(409).json({ error: 'That name is taken — sign in instead' });
  }
  if (!guard.noteRegister(ip)) {
    return res.status(429).json({ error: 'Too many new accounts from this connection' });
  }

  const account = {
    id: crypto.randomBytes(6).toString('hex'),
    name,
    hash: makeHash(password),
    created: new Date().toISOString(),
    last: new Date().toISOString(),
    ips: [ip],
  };
  account.title = titleFor(account.id);
  accounts.set(account.name.toLowerCase(), account);
  saveAccounts();

  res.json({ token: issue(account), user: { id: account.id, name: account.name, title: account.title } });
});

authRouter.post('/login', (req, res) => {
  const ip = clientIp(req);
  const stop = guard.blocked(ip);
  if (stop) return res.status(429).json({ error: stop });

  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
  const password = String(req.body?.password || '');
  const account = accounts.get(name.toLowerCase());

  if (!account || !verifyHash(account.hash, password)) {
    guard.noteFail(ip);
    return res.status(401).json({ error: 'Wrong name or password' });
  }
  if (!Array.isArray(account.ips)) account.ips = [];
  if (!account.ips.includes(ip) && account.ips.length < 12) account.ips.push(ip);
  account.last = new Date().toISOString();
  saveAccounts();

  res.json({ token: issue(account), user: { id: account.id, name: account.name, title: account.title ?? null } });
});

authRouter.get('/me', (req, res) => {
  const user = userForToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Sign in again' });
  res.json({ user });
});

authRouter.post('/logout', (req, res) => {
  revoke(bearer(req));
  res.json({ ok: true });
});

authRouter.get('/admin', (req, res) => {
  const user = userForToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Sign in again' });
  res.json({ admin: holdsAdmin(user) });
});

authRouter.post('/admin/claim', (req, res) => {
  const user = userForToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Sign in again' });
  const record = claimAdmin(user);
  if (!record) {
    const taken = adminRecord !== null;
    return res
      .status(409)
      .json({ error: taken ? 'Admin is already taken' : 'Admin is reserved for another name' });
  }
  res.json({ admin: true });
});

/** how many accounts exist, for the health ping */
export function accountCount() {
  return accounts.size;
}
