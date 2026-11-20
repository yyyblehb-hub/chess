/**
 * The admin's other buttons: turn events that send the other side's pieces
 * running, and the troll faces that land on both screens.
 */

export type TurnKind = 'bolt' | 'panic' | 'desert' | 'vanish' | 'stampede';

export const TURNS: { id: TurnKind; label: string; hint: string }[] = [
  { id: 'bolt', label: 'Bolt', hint: 'Their furthest piece runs for the edge' },
  { id: 'panic', label: 'Panic', hint: 'Their queen abandons the board' },
  { id: 'desert', label: 'Desert', hint: 'A pawn slips away' },
  { id: 'vanish', label: 'Vanish', hint: 'A knight disappears mid-stride' },
  { id: 'stampede', label: 'Stampede', hint: 'Their three lead pieces flee' },
];

/** the picture behind every jumpscare that is not the admin's own face */
export const SCARE_PHOTO = 'https://files.catbox.moe/u4b5xa.jpg';

export const TROLLS: { label: string; flip?: boolean }[] = [
  { label: 'Behind you' },
  { label: 'Say cheese' },
  { label: 'Wrong face' },
  { label: 'From below', flip: true },
  { label: 'The admin' },
];
