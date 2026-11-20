import { useEffect, useRef, useState } from 'react';
import NameTag from '../components/NameTag';
import { refreshAdmin } from '../lib/admin';
import { fileToAvatar, fileToTag, type Profile, type TrackId } from '../lib/profile';
import { TRACKS } from '../lib/tracks';

export function SettingsScreen({
  profile,
  track,
  onChange,
  onTrack,
  onSignOut,
}: {
  profile: Profile;
  track: TrackId;
  onChange: (next: Profile) => void;
  onTrack: (track: TrackId) => void;
  onSignOut: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [admin, setAdminOn] = useState(false);

  // the claim lives on the server, so it is asked for when this screen opens
  useEffect(() => {
    void refreshAdmin().then(setAdminOn);
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

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

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      onChange({ ...profile, avatar: await fileToAvatar(file) });
    } catch {
      /* unsupported image — keep the picture that is already there */
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="screen settings">
      <div className="setup">
        <button
          type="button"
          className="pfp"
          onClick={() => avatarRef.current?.click()}
          aria-label="Choose a profile picture"
        >
          {profile.avatar ? <img src={profile.avatar} alt="" /> : <span>{avatarBusy ? '' : '+'}</span>}
        </button>
        <div className="setup-field">
          <span className="label">Picture</span>
          <p className="me-name">{profile.name}</p>
        </div>
      </div>

      <input
        ref={avatarRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void pickAvatar(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {profile.avatar && (
        <button
          type="button"
          className="link"
          onClick={() => onChange({ ...profile, avatar: null })}
        >
          Remove picture
        </button>
      )}

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

      {admin && (
        <div className="setup-field">
          <span className="label">Admin</span>
          <p className="muted">
            This account holds the admin menu for good. Custom pieces will live here.
          </p>
        </div>
      )}

      <button type="button" className="btn ghost push" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
