import { useState } from 'react';
import { signIn, signUp, confirmSignUp } from '../auth';

type Mode = 'signin' | 'signup' | 'confirm';

interface Props {
  onAuthenticated: () => void;
}

export function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ username: email, password });
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      setMode('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      await signIn({ username: email, password });
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Clinical Letters</h1>

        {mode === 'signin' && (
          <>
            <h2>Sign in</h2>
            <form onSubmit={handleSignIn}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            </form>
            <p className="auth-switch">No account? <button onClick={() => { setMode('signup'); setError(null); }}>Sign up</button></p>
          </>
        )}

        {mode === 'signup' && (
          <>
            <h2>Create account</h2>
            <form onSubmit={handleSignUp}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password (min 8 chars, upper, lower, number)" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
            </form>
            <p className="auth-switch">Have an account? <button onClick={() => { setMode('signin'); setError(null); }}>Sign in</button></p>
          </>
        )}

        {mode === 'confirm' && (
          <>
            <h2>Verify your email</h2>
            <p className="auth-info">We sent a code to {email}</p>
            <form onSubmit={handleConfirm}>
              <input type="text" placeholder="Verification code" value={code} onChange={(e) => setCode(e.target.value)} required />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
