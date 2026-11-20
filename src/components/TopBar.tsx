import { useEffect, useRef, useState } from 'react';
import { adminHeld, claimAdmin } from '../lib/admin';
import { BackIcon, ChatIcon, FullscreenIcon, MutedIcon, SpeakerIcon } from './chrome';

/** five taps on the wordmark inside three seconds opens the admin menu */
const TAPS = 5;
const WINDOW_MS = 3000;

export default function TopBar({
  onBack,
  inGame,
  solo,
  panelOpen,
  unread,
  musicOn,
  onChat,
  onMusic,
  onFullscreen,
}: {
  /** null shows the wordmark instead of the back arrow */
  onBack: (() => void) | null;
  inGame: boolean;
  solo: boolean;
  panelOpen: boolean;
  unread: number;
  musicOn: boolean;
  onChat: () => void;
  onMusic: () => void;
  onFullscreen: () => void;
}) {
  const taps = useRef<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(timer);
  }, [flash]);

  // the wordmark is the lock: only someone who knows about it taps it five times
  const tapLogo = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < WINDOW_MS), now];
    if (taps.current.length < TAPS) return;
    taps.current = [];

    if (adminHeld()) {
      setFlash('Admin already unlocked');
      return;
    }
    // the server decides: one account holds the menu, whoever asks first
    void claimAdmin().then((ok) => setFlash(ok ? 'Admin unlocked' : 'Admin is already taken'));
  };

  return (
    <header className="bar">
      {onBack ? (
        <button className="icon" aria-label="Back" onClick={onBack}>
          <BackIcon />
        </button>
      ) : (
        <span className="logo" onClick={tapLogo}>
          Chess
        </span>
      )}
      <span className="grow" />
      {inGame && (
        <button
          className={`icon${panelOpen ? ' active' : ''}`}
          aria-label={
            unread > 0
              ? `Open chat, ${unread} new ${unread === 1 ? 'message' : 'messages'}`
              : solo
                ? 'Open move list'
                : 'Open chat'
          }
          onClick={onChat}
        >
          <ChatIcon />
          {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}
      <button
        className={`icon${musicOn ? ' active' : ''}`}
        aria-label={musicOn ? 'Pause music' : 'Play music'}
        onClick={onMusic}
      >
        {musicOn ? <SpeakerIcon /> : <MutedIcon />}
      </button>
      <button className="icon" aria-label="Toggle full screen" onClick={onFullscreen}>
        <FullscreenIcon />
      </button>

      {flash && (
        <div className="toast" role="status">
          {flash}
        </div>
      )}
    </header>
  );
}
