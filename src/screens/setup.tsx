import { useRef, useState } from 'react';
import NameTag from '../components/NameTag';
import { fileToAvatar, fileToTag, loadId, type Profile, type TrackId } from '../lib/profile';
import { TRACKS } from '../lib/tracks';

/* ---------- identity ---------- */

export function IdentityScreen({
  initial,
  onSubmit,
}: {
  initial: Profile | null;
  onSubmit: (profile: Profile) => void;
}) {
  const idRef = useRef(initial?.id ?? loadId());
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar ?? null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const ready = trimmed.length >= 2;

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      setAvatar(await fileToAvatar(file));
    } catch {
      /* unsupported image — keep whatever is there */
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (!ready) return;
    onSubmit({
      id: idRef.current,
      name: trimmed,
      avatar,
      tag: initial?.tag ?? null,
      title: initial?.title ?? null,
    });
  };

  return (
    <div className="screen identity">
      <div className="setup">
        <button
          type="button"
          className="pfp"
          onClick={() => fileRef.current?.click()}
          aria-label="Choose a profile picture"
        >
          {avatar ? <img src={avatar} alt="" /> : <span>{loading ? '' : '+'}</span>}
        </button>
        <div className="setup-field">
          <label className="label" htmlFor="player-name">
            Name
          </label>
          <input
            id="player-name"
            className="field"
            value={name}
            maxLength={16}
            placeholder="Name"
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
        </div>
      </div>

      {avatar && (
        <button type="button" className="link" onClick={() => setAvatar(null)}>
          Remove picture
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void pickAvatar(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <button className="btn primary push" disabled={!ready} onClick={submit}>
        Continue
      </button>
    </div>
  );
}

/* ---------- settings ---------- */

export function SettingsScreen({
  profile,
  track,
  onChange,
  onTrack,
}: {
  profile: Profile;
  track: TrackId;
  onChange: (next: Profile) => void;
  onTrack: (track: TrackId) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickTag = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange({ ...profile, tag: await fileToTag(file) });
    } catch {
      /* unsupported image — keep the tag that is already there */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen settings">
      <div className="setup">
        <button
          type="button"
          className="pfp"
          onClick={() => fileRef.current?.click()}
          aria-label="Choose a tag picture"
        >
          {profile.tag ? <img src={profile.tag} alt="" /> : <span>{busy ? '' : '+'}</span>}
        </button>
        <div className="setup-field">
          <span className="label">Tag</span>
          <p className="me-name">
            <NameTag tag={profile.tag} />
            {profile.name}
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void pickTag(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {profile.tag && (
        <button type="button" className="link" onClick={() => onChange({ ...profile, tag: null })}>
          Remove picture
        </button>
      )}

      <div className="setup-field">
        <span className="label">Music</span>
        <div className="tracks">
          {TRACKS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`track${track === item.id ? ' sel' : ''}`}
              aria-pressed={track === item.id}
              onClick={() => onTrack(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
