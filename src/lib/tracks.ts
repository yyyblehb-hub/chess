import { type TrackId } from './profile';

export const TRACKS: { id: TrackId; name: string; src: string; clip?: number }[] = [
  // a simple beta song is cut at 01:25 and loops there
  { id: 'beta', name: 'a simple beta song', src: '/assets/chess.m4a', clip: 85 },
  { id: 'diversion', name: 'a simple diversion', src: '/assets/simple-diversion.mp3' },
  { id: 'queen', name: 'queen', src: '/assets/queen.mp3' },
  { id: 'hopes', name: 'field of hopes and dreams', src: '/assets/field-of-hopes.mp3' },
];

export function trackSource(track: TrackId): string {
  return TRACKS.find((item) => item.id === track)?.src ?? TRACKS[0].src;
}
