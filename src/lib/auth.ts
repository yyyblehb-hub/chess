import { useCallback, useEffect, useState } from 'react';

/** the session token the server issued; the only thing that opens /ws */
const TOKEN_KEY = 'chess.token.v1';

export type Account = { id: string; name: string; title: string | null };

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the session lasts as long as this tab */
  }
}

async function call(path: string, body?: unknown): Promise<any> {
  const token = getToken();
  const response = await fetch(`/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong');
  }
  return data;
}

async function accept(path: string, name: string, password: string): Promise<Account> {
  const data = await call(path, { name, password });
  storeToken(typeof data?.token === 'string' ? data.token : null);
  return data.user as Account;
}

export const register = (name: string, password: string) => accept('/register', name, password);
export const login = (name: string, password: string) => accept('/login', name, password);

/** true when the stored token still belongs to a real account */
export async function restore(): Promise<Account | null> {
  if (!getToken()) return null;
  try {
    const data = await call('/me');
    return data.user as Account;
  } catch {
    storeToken(null);
    return null;
  }
}

/** used when a socket handshake is refused: is the stored session still good? */
export async function sessionDead(): Promise<boolean> {
  if (!getToken()) return true;
  return (await restore()) === null;
}

export async function signOut(): Promise<void> {
  try {
    await call('/logout', {});
  } catch {
    /* the server already forgot us */
  }
  storeToken(null);
}

/**
 * The app's whole view of who is signed in: the account, its token, whether the
 * stored session has been checked yet, and the two ways it changes.
 */
export function useSession() {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(getToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setReady(true);
      return;
    }
    void restore().then((next) => {
      if (!alive) return;
      setAccount(next);
      setToken(next ? getToken() : null);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const adopt = useCallback((next: Account) => {
    setAccount(next);
    setToken(getToken());
    setReady(true);
  }, []);

  const forget = useCallback(() => {
    void signOut();
    setAccount(null);
    setToken(null);
  }, []);

  return { account, token, ready, adopt, forget };
}
