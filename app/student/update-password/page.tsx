'use client';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function checkSession() {
      if (!supabase) {
        if (active) { setErrorMessage('The password recovery service is not configured.'); setChecking(false); }
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setErrorMessage('This reset link is invalid, expired, or already used. Please request a new reset link.');
      } else {
        setReady(true);
      }
      setChecking(false);
    }
    checkSession();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');
    if (!supabase) { setErrorMessage('The password recovery service is not configured.'); return; }
    if (password.length < 8) { setErrorMessage('Your new password must contain at least 8 characters.'); return; }
    if (password !== confirmPassword) { setErrorMessage('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('Your password has been changed successfully. You can now sign in using your new password.');
      setPassword('');
      setConfirmPassword('');
      setReady(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not update your password. Please request a new reset link.');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { width: '100%', padding: '13px 14px', border: '1px solid #d7e0e8', borderRadius: 9, fontSize: 15, boxSizing: 'border-box' as const };

  return (
    <main style={{ minHeight: '100vh', background: '#f3f7fa', padding: '35px 18px', color: '#102d49' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#102d49', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 25, fontWeight: 800, fontSize: 21 }}>
          <span style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 12, background: '#102d49', color: '#fff', fontSize: 24 }}>E</span>
          EduAxis <span style={{ color: '#0b918d' }}>India</span>
        </Link>
        <section style={{ background: '#fff', border: '1px solid #dce5ec', borderRadius: 16, padding: 28, boxShadow: '0 8px 30px rgba(16,45,73,.06)' }}>
          <div style={{ color: '#0b918d', fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>ACCOUNT RECOVERY</div>
          <h1 style={{ fontSize: 29, margin: '9px 0 8px' }}>Set a new password</h1>
          <p style={{ color: '#647b91', lineHeight: 1.6, marginTop: 0 }}>Choose a new password for your EduAxis India account.</p>
          {checking && <p style={{ color: '#647b91' }}>Checking your secure reset link…</p>}
          {message && <div role="status" style={{ padding: 13, borderRadius: 9, background: '#e5f8ef', color: '#087443', margin: '18px 0', lineHeight: 1.6 }}>{message}</div>}
          {errorMessage && <div role="alert" style={{ padding: 13, borderRadius: 9, background: '#fff0f0', color: '#bd2525', margin: '18px 0', lineHeight: 1.6 }}>{errorMessage}</div>}
          {!checking && ready && (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label htmlFor="password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>New password</label>
                <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="confirm-password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Confirm new password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter the new password again" style={inputStyle} />
              </div>
              <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 9, padding: 14, background: '#102d49', color: '#fff', fontWeight: 750, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Updating password…' : 'Save New Password'}</button>
            </form>
          )}
          {!checking && !ready && !message && <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}><Link href="/student/forgot-password" style={{ color: '#087f7b', fontWeight: 700 }}>Request another reset link</Link></p>}
          {message && <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}><Link href="/student/login" style={{ color: '#087f7b', fontWeight: 700 }}>Go to Student Login</Link></p>}
        </section>
        <p style={{ textAlign: 'center', color: '#8293a2', fontSize: 12, marginTop: 20 }}>© {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.</p>
      </div>
    </main>
  );
}
