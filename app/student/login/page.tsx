
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function StudentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function getReturnPath() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');

    // Allow only safe internal website paths.
    if (
      next &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !next.startsWith('/\\')
    ) {
      return next;
    }

    return '/student/dashboard';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('The login service is not configured. Please try again later.');
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      const returnPath = getReturnPath();

      router.replace(returnPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Login could not be completed. Please check your details and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 14px',
    border: '1px solid #d7e0e8',
    borderRadius: 9,
    fontSize: 15,
    boxSizing: 'border-box' as const,
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f3f7fa', padding: '35px 18px', color: '#102d49' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#102d49', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 25, fontWeight: 800, fontSize: 21 }}>
          <span style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 12, background: '#102d49', color: '#fff', fontSize: 24 }}>E</span>
          EduAxis <span style={{ color: '#0b918d' }}>India</span>
        </Link>

        <section style={{ background: '#fff', border: '1px solid #dce5ec', borderRadius: 16, padding: 28, boxShadow: '0 8px 30px rgba(16,45,73,.06)' }}>
          <div style={{ color: '#0b918d', fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>STUDENT ACCOUNT</div>
          <h1 style={{ fontSize: 29, margin: '9px 0 8px' }}>Welcome back</h1>
          <p style={{ color: '#647b91', lineHeight: 1.6, marginTop: 0 }}>Sign in to continue learning with EduAxis India.</p>

          {errorMessage && (
            <div role="alert" style={{ padding: 13, borderRadius: 9, background: '#fff0f0', color: '#bd2525', margin: '18px 0', lineHeight: 1.6 }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Email address</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your registered email" style={inputStyle} />
            </div>

            <div>
              <label htmlFor="password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" style={inputStyle} />
            </div>

            <div style={{ textAlign: 'right', marginTop: -7 }}>
              <Link href="/student/forgot-password" style={{ color: '#087f7b', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 9, padding: 14, background: '#102d49', color: '#fff', fontWeight: 750, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Signing in…' : 'Student Login'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#647b91', margin: '22px 0 0', fontSize: 14 }}>
            New to EduAxis India? <Link href="/student/register" style={{ color: '#087f7b', fontWeight: 700 }}>Create an account</Link>
          </p>
        </section>

        <p style={{ textAlign: 'center', color: '#8293a2', fontSize: 12, marginTop: 20 }}>
          © {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.
        </p>
      </div>
    </main>
  );
}
