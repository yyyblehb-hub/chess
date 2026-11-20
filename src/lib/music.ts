import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { saveTrack, type TrackId } from './profile';
import { TRACKS, trackSource } from './tracks';

/**
 * The lobby song lives here: one audio element, the chosen track, the short
 * clip on a simple beta song, and the rules about when music belongs on screen.
 * A match silences it and the menu brings it back.
 */
export function useMusic(track: TrackId, inGame: boolean) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [musicOn, setMusicOn] = useState(false);
  const trackSrc = trackSource(track);

  // true only while the player wants music; used to undo browser interruptions
  const wantMusicRef = useRef(false);
  // the player was listening before the board appeared
  const resumeAfterMatchRef = useRef(false);

  // The chosen song is the one the audio element loads. Switching songs keeps
  // the music going, and the first gesture starts it like before.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = trackSrc;
    audio.load();
    if (wantMusicRef.current) void audio.play().catch(() => undefined);
  }, [trackSrc]);

  // a simple beta song ends at 01:25 whatever the file's real length is.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const clip = TRACKS.find((item) => item.id === track)?.clip;
    if (!clip) return;

    const keepClip = () => {
      if (audio.currentTime >= clip) audio.currentTime = 0;
    };
    audio.addEventListener('timeupdate', keepClip);
    return () => audio.removeEventListener('timeupdate', keepClip);
  }, [track]);

  const startMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    wantMusicRef.current = true;
    audio
      .play()
      .then(() => setMusicOn(true))
      .catch(() => setMusicOn(false));
  }, []);

  // Browsers and slow connections like to pause or starve a background track
  // (fullscreen changes, tab switches, a stalled stream). If the player never
  // asked for silence, quietly pick it back up.
  useEffect(() => {
    const audio = audioRef.current;
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
  }, []);

  // Music belongs to the lobby: silence it the moment the board appears, and
  // bring it back if the player returns to the menu afterwards. A finished game
  // stays on the board even if the other player walks away.
  useEffect(() => {
    const audio = audioRef.current;
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
  }, [inGame, startMusic]);

  // Music is meant to be on the whole time, so a blocked first attempt retries
  // on the next tap instead of waiting for the speaker button.
  useEffect(() => {
    const resumeOnTap = () => {
      const audio = audioRef.current;
      if (!audio || inGame || !wantMusicRef.current || !audio.paused) return;
      void audio.play().catch(() => undefined);
    };
    window.addEventListener('pointerdown', resumeOnTap);
    return () => window.removeEventListener('pointerdown', resumeOnTap);
  }, [inGame]);

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      startMusic();
    } else {
      wantMusicRef.current = false;
      audio.pause();
      setMusicOn(false);
    }
  };

  /** Picking a song is a tap, so the browser lets this one play right away. */
  const pickTrack = (next: TrackId) => {
    saveTrack(next);

    const audio = audioRef.current;
    if (!audio) return;
    wantMusicRef.current = true;
    audio.src = trackSource(next);
    audio.load();
    void audio
      .play()
      .then(() => setMusicOn(true))
      .catch(() => undefined);
  };

  return {
    audioRef: audioRef as RefObject<HTMLAudioElement>,
    musicOn,
    startMusic,
    toggleMusic,
    pickTrack,
  };
}
