/* ---------- icons ---------- */

export const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12.5 19V5L7.2 9.5H4Z" />
    <path d="M16 9a4.5 4.5 0 0 1 0 6" />
    <path d="M18.7 6.2a8.2 8.2 0 0 1 0 11.6" />
  </svg>
);

export const MutedIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12.5 19V5L7.2 9.5H4Z" />
    <path d="m16.2 9.8 4.4 4.4M20.6 9.8l-4.4 4.4" />
  </svg>
);

export const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m14.5 5.5-7 6.5 7 6.5" />
  </svg>
);

export const ChatIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 12.5a6.8 6.8 0 0 1-7.5 6.8 8.6 8.6 0 0 1-2.6-.6L5.5 20l.9-3.2A6.6 6.6 0 0 1 4.5 12.5 6.8 6.8 0 0 1 12 5.7a6.8 6.8 0 0 1 8 6.8Z" />
  </svg>
);

export const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9.5 4H4v5.5" />
    <path d="M14.5 4H20v5.5" />
    <path d="M14.5 20H20v-5.5" />
    <path d="M9.5 20H4v-5.5" />
  </svg>
);

/* ---------- fullscreen ---------- */

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

export async function toggleFullscreen() {
  const doc = document as FullscreenDocument;
  const element = document.documentElement as FullscreenElement;
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
      return;
    }
    if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: 'hide' });
    else await element.webkitRequestFullscreen?.();
  } catch {
    /* iOS Safari refuses on non-video elements — the layout already fills the screen */
  }
}
