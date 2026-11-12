'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');
    if (!supabase) {
      setErrorMessage('The password recovery service is not configured. Please try again later.');
      return;
    }
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/student/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) throw error;
      setMessage('If an account exists for this email address, a password reset link will be sent. Please check your inbox and spam folder.');
      setEmail('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not send the reset email. Please try again.');
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
          <h1 style={{ fontSize: 29, margin: '9px 0 8px' }}>Forgot your password?</h1>
          <p style={{ color: '#647b91', lineHeight: 1.6, marginTop: 0 }}>Enter the email address registered with EduAxis India. We’ll send you a secure password reset link.</p>
          {message && <div role="status" style={{ padding: 13, borderRadius: 9, background: '#e5f8ef', color: '#087443', margin: '18px 0', lineHeight: 1.6 }}>{message}</div>}
          {errorMessage && <div role="alert" style={{ padding: 13, borderRadius: 9, background: '#fff0f0', color: '#bd2525', margin: '18px 0', lineHeight: 1.6 }}>{errorMessage}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Registered email address</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
            </div>
            <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 9, padding: 14, background: '#102d49', color: '#fff', fontWeight: 750, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Sending reset link…' : 'Send Password Reset Link'}
            </button>
          </form>
          <p style={{ textAlign: 'center', color: '#647b91', margin: '22px 0 0', fontSize: 14 }}>Remember your password? <Link href="/student/login" style={{ color: '#087f7b', fontWeight: 700 }}>Back to Student Login</Link></p>
        </section>
        <p style={{ textAlign: 'center', color: '#8293a2', fontSize: 12, marginTop: 20 }}>© {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.</p>
      </div>
    </main>
  );
}
