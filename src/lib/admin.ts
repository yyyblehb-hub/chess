const ADMIN_KEY = 'chess.admin.v1';

/**
 * The admin switch is a per-device preference, not an account: unlocking it on
 * your phone leaves every other player untouched. It is only ever flipped by
 * the hidden tap sequence on the wordmark, or off again from the Admin menu.
 */
export function isAdmin(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_KEY) === 'on';
  } catch {
    /* storage blocked: the menu stays hidden */
    return false;
  }
}

export function setAdmin(on: boolean) {
  try {
    if (on) window.localStorage.setItem(ADMIN_KEY, 'on');
    else window.localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* storage can be blocked; nothing else to do */
  }
}
