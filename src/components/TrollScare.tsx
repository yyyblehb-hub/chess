import { SCARE_PHOTO, TROLLS } from '../lib/mayhem';

/**
 * A jumpscare on both screens. Three faces use the admin's own picture, two use
 * the sniper photograph already hosted for this game; the CSS gives each one a
 * different way of lunging at the camera.
 */
export default function TrollScare({ face, avatar }: { face: number; avatar: string | null }) {
  const troll = TROLLS[face] ?? TROLLS[0];
  const own = face !== 1 && face !== 3;
  const src = own ? (avatar || SCARE_PHOTO) : SCARE_PHOTO;

  return (
    <div className={`scare f${face}`} role="alert" aria-label={troll.label}>
      <div className="scare-shake">
        <img src={src} alt="" className={troll.flip ? 'flip' : ''} draggable={false} />
      </div>
      <span className="scare-word">{troll.label}</span>
    </div>
  );
}
