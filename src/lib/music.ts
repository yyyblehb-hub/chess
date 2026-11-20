import { useCallback, useEffect, useRef, useState } from 'react';
import { saveTrack, type TrackId } from './profile';
import { TRACKS, trackSource } from './tracks';

/**
 * The lobby song lives here: one audio element, the chosen track, the short
 * clip on a simple beta song, and the rules about when music belongs on screen.
 * A match silences it and the menu brings it back.
 *
 * The element is held as state, not only as a ref, because the app paints
 * nothing while the stored session is checked: the audio tag mounts a moment
 * later, and every rule here has to start once it does.
 */
export function useMusic(track: TrackId, inGame: boolean) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const trackSrc = trackSource(track);

  // true only while the player wants music; used to undo browser interruptions
  const wantMusicRef = useRef(false);
  // the player was listening before the board appeared
  const resumeAfterMatchRef = useRef(false);

  const attachAudio = useCallback((node: HTMLAudioElement | null) => setAudio(node), []);

  // The chosen song is the one the audio element loads. Switching songs keeps
  // the music going, and the first gesture starts it like before.
  useEffect(() => {
    if (!audio) return;
    audio.volume = 0.45;
    audio.src = trackSrc;
    audio.load();
    if (wantMusicRef.current) void audio.play().catch(() => undefined);
  }, [audio, trackSrc]);

  // a simple beta song ends at 01:25 whatever the file's real length is.
  useEffect(() => {
    if (!audio) return;
    const clip = TRACKS.find((item) => item.id === track)?.clip;
    if (!clip) return;

    const keepClip = () => {
      if (audio.currentTime >= clip) audio.currentTime = 0;
    };
    audio.addEventListener('timeupdate', keepClip);
    return () => audio.removeEventListener('timeupdate', keepClip);
  }, [audio, track]);

  const startMusic = useCallback(() => {
    if (!audio) return;
    audio.volume = 0.45;
    wantMusicRef.current = true;
    audio
      .play()
      .then(() => setMusicOn(true))
      .catch(() => setMusicOn(false));
  }, [audio]);

  // Browsers and slow connections like to pause or starve a background track
  // (fullscreen changes, tab switches, a stalled stream). If the player never
  // asked for silence, quietly pick it back up.
  useEffect(() => {
    if (!audio) return;

    const resume = () => {
      if (!wantMusicRef.current || !audio.paused) return;
      void audio.play().catch(() => {
        /* still blocked by the browser; the next gesture retries */
      });
    };

    // A dropped stream should not silence the menu for good, but reloading on
    // every error event makes the track stutter — retry once, after a beat.
    let retry: number | undefined;
    const retryAfterError = () => {
      if (!wantMusicRef.current) return;
      window.clearTimeout(retry);
      retry = window.setTimeout(() => {
        if (!wantMusicRef.current) return;
        audio.load();
        void audio.play().catch(() => undefined);
      }, 1200);
    };

    audio.addEventListener('pause', resume);
    audio.addEventListener('error', retryAfterError);

    return () => {
      window.clearTimeout(retry);
      audio.removeEventListener('pause', resume);
      audio.removeEventListener('error', retryAfterError);
    };
  }, [audio]);

  // Music belongs to the lobby: silence it the moment the board appears, and
  // bring it back if the player returns to the menu afterwards. A finished game
  // stays on the board even if the other player walks away.
  useEffect(() => {
    if (!audio) return;

    if (inGame) {
      if (!audio.paused || wantMusicRef.current) {
        resumeAfterMatchRef.current = wantMusicRef.current;
        wantMusicRef.current = false;
        audio.pause();
        setMusicOn(false);
      }
      return;
    }

    if (resumeAfterMatchRef.current) {
      resumeAfterMatchRef.current = false;
      startMusic();
    }
  }, [audio, inGame, startMusic]);

  // Music is meant to be on the whole time, so a blocked first attempt retries
  // on the next tap instead of waiting for the speaker button.
  useEffect(() => {
    if (!audio) return;
    const resumeOnTap = () => {
      if (inGame || !wantMusicRef.current || !audio.paused) return;
      void audio.play().catch(() => undefined);
    };
    window.addEventListener('pointerdown', resumeOnTap);
    return () => window.removeEventListener('pointerdown', resumeOnTap);
  }, [audio, inGame]);

  /** The speaker button. A match stays quiet, so silence in game is final. */
  const toggleMusic = () => {
    if (!audio || inGame) return;
    if (audio.paused) {
      startMusic();
      return;
    }
    wantMusicRef.current = false;
    audio.pause();
    setMusicOn(false);
  };

  /** Picking a song is a tap, so the browser lets this one play right away. */
  const pickTrack = (next: TrackId) => {
    saveTrack(next);

    if (!audio) return;
    wantMusicRef.current = true;
    audio.src = trackSource(next);
    audio.load();
    void audio
      .play()
      .then(() => {
        setMusicOn(true);
        if (inGame) {
          // the board keeps its silence, but the pick is remembered
          audio.pause();
          wantMusicRef.current = false;
          setMusicOn(false);
        }
      })
      .catch(() => undefined);
  };

  return {
    audioRef: attachAudio,
    musicOn,
    startMusic,
    toggleMusic,
    pickTrack,
  };
}
