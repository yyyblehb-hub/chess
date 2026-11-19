const PROFILE_KEY = 'chess.profile.v1';
const ID_KEY = 'chess.id.v1';

export type Profile = { id: string; name: string; avatar: string | null; title?: string | null };

export function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * The id outlives the profile, so signing out to rename yourself keeps the
 * title the server handed out at the first sign-in.
 */
export function loadId(): string {
  try {
    const stored = window.localStorage.getItem(ID_KEY);
    if (stored) return stored;
  } catch {
    /* storage blocked; a fresh id is fine */
  }
  const id = createId();
  try {
    window.localStorage.setItem(ID_KEY, id);
  } catch {
    /* nothing to do */
  }
  return id;
}

export function loadProfile(): Profile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    return {
      id: parsed.id || loadId(),
      name: parsed.name.slice(0, 16),
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
      title: typeof parsed.title === 'string' ? parsed.title : null,
    };
  } catch {
    return null;
  }
}

export function clearProfile() {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* storage can be blocked; nothing to clear */
  }
}

export function saveProfile(profile: Profile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage can be blocked; the session still works */
  }
}

/** Crops an uploaded picture to a small square avatar so it can travel over the socket. */
export async function fileToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}
