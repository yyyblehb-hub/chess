import { useState } from 'react';
import { login, register, type Account } from '../lib/auth';

export default function AuthScreen({ onAuthed }: { onAuthed: (account: Account) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length >= 2 && password.length >= 6 && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const account =
        mode === 'register' ? await register(name, password) : await login(name, password);
      onAuthed(account);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const flip = () => {
    setMode(mode === 'register' ? 'login' : 'register');
    setError(null);
  };

  return (
    <div className="screen auth">
      <h1 className="auth-title">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
      <p className="muted auth-note">
        {mode === 'register'
          ? 'A name and a password. Nobody gets into the lobby without an account.'
          : 'Sign in with the name and password you made.'}
      </p>

      <div className="setup-field">
        <label className="label" htmlFor="auth-name">
          Name
        </label>
        <input
          id="auth-name"
          className="field"
          value={name}
          maxLength={16}
          placeholder="Name"
          autoComplete="username"
          autoCapitalize="none"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
      </div>

      <div className="setup-field">
        <label className="label" htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          className="field"
          type="password"
          value={password}
          maxLength={72}
          placeholder="At least 6 characters"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn primary push" disabled={!ready} onClick={() => void submit()}>
        {mode === 'register' ? 'Create account' : 'Sign in'}
      </button>
      <button type="button" className="link" onClick={flip}>
        {mode === 'register' ? 'I already have an account' : 'Create a new account'}
      </button>
    </div>
  );
}
