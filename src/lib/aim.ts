import { useSyncExternalStore } from 'react';

/**
 * The sniper's sight while it is up. The shooter sends a stream of positions,
 * the server relays them to the other player, and this store keeps the last one
 * so both boards show the sight in the same place.
 */
export type Sight = { on: boolean; x: number; y: number };

let sight: Sight = { on: false, x: 0.5, y: 0.5 };
const listeners = new Set<() => void>();

export function setAim(next: Sight) {
  sight = next;
  listeners.forEach((run) => run());
}

function subscribe(run: () => void) {
  listeners.add(run);
  return () => listeners.delete(run);
}

export function useAim(): Sight {
  return useSyncExternalStore(subscribe, () => sight, () => sight);
}
