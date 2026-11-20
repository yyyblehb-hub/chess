import { BackIcon, ChatIcon, FullscreenIcon, MutedIcon, SpeakerIcon } from './chrome';

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
  return (
    <header className="bar">
      {onBack ? (
        <button className="icon" aria-label="Back" onClick={onBack}>
          <BackIcon />
        </button>
      ) : (
        <span className="logo">Chess</span>
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
    </header>
  );
}
