
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AuthorRegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [designation, setDesignation] = useState('');
  const [biography, setBiography] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage('');
    setError('');

    if (!supabase) {
      setError('Registration service is temporarily unavailable.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            account_type: 'author',
            designation: designation.trim(),
            biography: biography.trim(),
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data.user) {
        throw new Error('Registration could not be completed. Please try again.');
      }

      if (data.session) {
        const { error: profileError } = await supabase
          .from('author_profiles')
          .insert({
            user_id: data.user.id,
            full_name: fullName.trim(),
            designation: designation.trim() || null,
            biography: biography.trim() || null,
            status: 'pending',
          });

        if (profileError) {
          throw profileError;
        }

        setMessage(
          'Your author application has been submitted successfully. It is now awaiting admin approval.'
        );
      } else {
        setMessage(
          'Your account has been created. Please check your email and confirm your email address. After confirmation, sign in to complete your author application.'
        );
      }

      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDesignation('');
      setBiography('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authorPage">
      <div className="authorCard">
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
          <span className="eyebrow">BECOME A CONTRIBUTOR</span>
          <h1>Write for EduAxis</h1>
          <p>
            Share your knowledge, ideas and experience.
            Help learners discover something valuable.
          </p>
        </div>

        {message && (
          <div className="successMessage">
            {message}
          </div>
        )}

        {error && (
          <div className="errorMessage">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>Full Name *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            required
          />

          <label>Email Address *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
          />

          <label>Professional Designation</label>
          <input
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Teacher, Researcher, Student"
          />

          <label>Short Biography</label>
          <textarea
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            placeholder="Tell us briefly about yourself and your areas of interest."
            rows={4}
          />

          <label>Create Password *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
            required
          />

          <label>Confirm Password *</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Enter password again"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting Application...' : 'Register as an Author →'}
          </button>
        </form>

        <div className="approvalNote">
          <b>What happens next?</b>
          <p>
            Your application will be reviewed by the EduAxis India
            administration team. You can submit articles after your
            author account is approved.
          </p>
        </div>

        <p className="loginText">
          Already registered? <Link href="/author/login">Author Login</Link>
        </p>
      </div>

      <style jsx>{`
        .authorPage {
          min-height: 100vh;
          background: #f3f7f8;
          padding: 45px 16px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          color: #172b3d;
        }

        .authorCard {
          width: 100%;
          max-width: 620px;
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
          gap: 10px;
        }

        label {
          font-size: 13px;
          font-weight: 600;
          margin-top: 9px;
          color: #294357;
        }

        input, textarea {
          width: 100%;
          border: 1px solid #dce5e9;
          border-radius: 8px;
          padding: 13px 14px;
          font: inherit;
          font-size: 14px;
          outline: none;
          background: white;
          color: #172b3d;
        }

        input:focus, textarea:focus {
          border-color: #18a5a0;
          box-shadow: 0 0 0 3px #18a5a015;
        }

        textarea {
          resize: vertical;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 15px;
          margin-top: 16px;
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

        .approvalNote {
          background: #f3f8f8;
          border-radius: 9px;
          padding: 17px;
          margin-top: 25px;
          font-size: 13px;
          line-height: 1.7;
        }

        .approvalNote b {
          color: #102b46;
        }

        .approvalNote p {
          color: #657789;
          margin: 6px 0 0;
        }

        .loginText {
          text-align: center;
          color: #657789;
          font-size: 13px;
          margin-top: 25px;
        }

        .loginText a {
          color: #18a5a0;
          font-weight: 700;
          text-decoration: none;
        }

        @media (max-width: 600px) {
          .authorCard {
            padding: 23px 18px;
          }

          h1 {
            font-size: 27px;
          }
        }
      `}</style>
    </main>
  );
}
