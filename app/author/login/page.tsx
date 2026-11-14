
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthorLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (!supabase) {
      setError('Login service is temporarily unavailable.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) throw loginError;

      const user = data.user;

      if (!user) {
        throw new Error('Unable to verify your account.');
      }

      if (user.user_metadata?.account_type !== 'author') {
        await supabase.auth.signOut();
        throw new Error(
          'This login is for registered authors. Please use the correct account.'
        );
      }

      let { data: profile, error: profileError } = await supabase
        .from('author_profiles')
        .select('id, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Complete the author application after email confirmation.
      if (!profile) {
        const metadata = user.user_metadata || {};

        const { error: insertError } = await supabase
          .from('author_profiles')
          .insert({
            user_id: user.id,
            full_name: metadata.full_name || user.email || 'Author',
            designation: metadata.designation || null,
            biography: metadata.biography || null,
            status: 'pending',
          });

        if (insertError) throw insertError;

        const { data: newProfile, error: newProfileError } =
          await supabase
            .from('author_profiles')
            .select('id, status')
            .eq('user_id', user.id)
            .single();

        if (newProfileError) throw newProfileError;

        profile = newProfile;
      }

      if (profile.status === 'approved') {
        router.push('/author/dashboard');
        return;
      }

      if (profile.status === 'pending') {
        setMessage(
          'Your author application is awaiting approval. You will be able to access your author dashboard after approval.'
        );
        return;
      }

      if (profile.status === 'rejected') {
        setMessage(
          'Your author application has not been approved. Please contact EduAxis India administration for further information.'
        );
        return;
      }

      setMessage('Your author account status could not be determined.');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authorLoginPage">
      <div className="loginCard">
        <Link href="/blogs" className="backLink">
          ← Back to Educational Blogs
        </Link>

        <div className="brand">
          <span className="brandIcon">E</span>
          <span>
            EduAxis <b>India</b>
            <small>LEARN. PREPARE. PROGRESS.</small>
          </span>
        </div>

        <div className="heading">
          <span className="eyebrow">CONTRIBUTOR PORTAL</span>
          <h1>Author Login</h1>
          <p>
            Sign in to access your EduAxis India author account.
          </p>
        </div>

        {message && <div className="successMessage">{message}</div>}
        {error && <div className="errorMessage">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your registered email"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In →'}
          </button>
        </form>

        <p className="registerText">
          Not registered yet?{' '}
          <Link href="/author/register">Apply as an Author</Link>
        </p>

        <p className="studentText">
          Are you a student?{' '}
          <Link href="/student/login">Student Login</Link>
        </p>
      </div>

      <style jsx>{`
        .authorLoginPage {
          min-height: 100vh;
          background: #f3f7f8;
          padding: 45px 16px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          color: #172b3d;
        }

        .loginCard {
          width: 100%;
          max-width: 500px;
          background: #fff;
          border: 1px solid #e2eaed;
          border-radius: 16px;
          padding: 35px;
          box-shadow: 0 12px 40px #102b4610;
        }

        .backLink {
          color: #18a5a0;
          font-size: 13px;
          text-decoration: none;
          font-weight: 600;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 30px 0;
          color: #102b46;
          font-size: 21px;
          font-weight: 700;
        }

        .brandIcon {
          background: #102b46;
          color: white;
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 10px;
        }

        .brand small {
          display: block;
          font-size: 9px;
          letter-spacing: 1.2px;
          color: #18a5a0;
          margin-top: 4px;
        }

        .heading {
          margin-bottom: 25px;
        }

        .eyebrow {
          color: #18a5a0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        h1 {
          color: #102b46;
          font-size: 32px;
          margin: 10px 0;
        }

        .heading p {
          color: #657789;
          font-size: 14px;
          line-height: 1.7;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        label {
          font-size: 13px;
          font-weight: 600;
          color: #294357;
        }

        input {
          width: 100%;
          border: 1px solid #dce5e9;
          border-radius: 8px;
          padding: 13px 14px;
          font: inherit;
          font-size: 14px;
          outline: none;
          background: white;
          color: #172b3d;
          margin-top: -5px;
        }

        input:focus {
          border-color: #18a5a0;
          box-shadow: 0 0 0 3px #18a5a015;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 15px;
          margin-top: 12px;
          background: #102b46;
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .successMessage {
          padding: 14px;
          border-radius: 8px;
          background: #e8f7ef;
          color: #176b3b;
          font-size: 13px;
          line-height: 1.6;
          margin-bottom: 18px;
        }

        .errorMessage {
          padding: 14px;
          border-radius: 8px;
          background: #fff0ef;
          color: #a52c25;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .registerText,
        .studentText {
          text-align: center;
          color: #657789;
          font-size: 13px;
          margin-top: 22px;
        }

        .registerText a,
        .studentText a {
          color: #18a5a0;
          font-weight: 700;
          text-decoration: none;
        }

        @media (max-width: 600px) {
          .loginCard {
            padding: 25px 19px;
          }

          h1 {
            font-size: 27px;
          }
        }
      `}</style>
    </main>
  );
}
