import { getToken } from './auth';

/**
 * The admin menu belongs to one account, decided on the server. The first
 * signed-in account that taps out the wordmark keeps it for good: no second
 * account can take it, and signing out does not give it back.
 */

let held = false;

/** what the header and the settings screen read while the request lands */
export function adminHeld(): boolean {
  return held;
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
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Admin is already taken');
  return data;
}

/** asks the server whether this account is the one holding the menu */
export async function refreshAdmin(): Promise<boolean> {
  try {
    const data = await call('/admin');
    held = data?.admin === true;
  } catch {
    held = false;
  }
  return held;
}

/** the wordmark tap sequence lands here; the first account to ask gets it */
export async function claimAdmin(): Promise<boolean> {
  try {
    const data = await call('/admin/claim', {});
    held = data?.admin === true;
  } catch {
    held = false;
  }
  return held;
}

// the old per-device flag is meaningless now that the claim lives on the server
try {
  window.localStorage.removeItem('chess.admin.v1');
} catch {
  /* storage blocked, nothing to clean */
}
