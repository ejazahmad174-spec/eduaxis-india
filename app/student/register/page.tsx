'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('The registration service is not configured. Please try again later.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Please choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) throw error;

      if (data.session) {
        router.push('/student/dashboard');
        router.refresh();
      } else {
        setMessage('Your registration has been received. Please check your email for a confirmation link. After confirming your email, return to Student Login.');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Registration could not be completed. Please try again.');
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
          <h1 style={{ fontSize: 29, margin: '9px 0 8px' }}>Create your account</h1>
          <p style={{ color: '#647b91', lineHeight: 1.6, marginTop: 0 }}>Join EduAxis India to access learning resources and future student services.</p>

          {message && <div role="status" style={{ padding: 13, borderRadius: 9, background: '#e5f8ef', color: '#087443', margin: '18px 0', lineHeight: 1.6 }}>{message}</div>}
          {errorMessage && <div role="alert" style={{ padding: 13, borderRadius: 9, background: '#fff0f0', color: '#bd2525', margin: '18px 0', lineHeight: 1.6 }}>{errorMessage}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label htmlFor="full-name" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Full name</label>
              <input id="full-name" autoComplete="name" required maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Email address</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Password</label>
              <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="confirm-password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter the password again" style={inputStyle} />
            </div>
            <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 9, padding: 14, background: '#102d49', color: '#fff', fontWeight: 750, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Creating account…' : 'Create Student Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#647b91', margin: '22px 0 0', fontSize: 14 }}>
            Already registered? <Link href="/student/login" style={{ color: '#087f7b', fontWeight: 700 }}>Student Login</Link>
          </p>
        </section>

        <p style={{ textAlign: 'center', color: '#8293a2', fontSize: 12, marginTop: 20 }}>© {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.</p>
      </div>
    </main>
  );
}
