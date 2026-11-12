'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Profile = {
  full_name: string;
  email: string;
  phone: string;
  state: string;
  district: string;
};

export default function StudentProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    email: '',
    phone: '',
    state: '',
    district: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!supabase) {
        if (active) {
          setErrorMessage('The profile service is not configured. Please try again later.');
          setLoading(false);
        }
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace('/student/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, phone, state, district, role')
        .eq('id', authData.user.id)
        .single();

      if (!active) return;

      if (error) {
        setErrorMessage('We could not load your profile. Please refresh the page.');
        setLoading(false);
        return;
      }

      if (data.role === 'admin') {
        router.replace('/admin/dashboard');
        return;
      }

      setProfile({
        full_name: data.full_name || '',
        email: data.email || authData.user.email || '',
        phone: data.phone || '',
        state: data.state || '',
        district: data.district || '',
      });
      setLoading(false);
    }

    loadProfile();
    return () => { active = false; };
  }, [router]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('The profile service is not configured.');
      return;
    }

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim(),
          state: profile.state.trim(),
          district: profile.district.trim(),
        })
        .eq('id', authData.user.id);

      if (error) throw error;
      setMessage('Your profile has been updated successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('The password service is not configured.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Your new password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage('Your password has been changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not change your password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #d7e0e8',
    borderRadius: 9,
    fontSize: 15,
    boxSizing: 'border-box' as const,
    background: '#fff',
  };

  if (loading) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f7fa', color: '#102d49' }}>Loading your profile…</main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f7fa', color: '#102d49' }}>
      <header style={{ background: '#102d49', color: '#fff', padding: '17px 22px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <Link href="/student/dashboard" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 21 }}>
            EduAxis <span style={{ color: '#55d2c6' }}>India</span>
          </Link>
          <Link href="/student/dashboard" style={{ color: '#102d49', background: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 750, fontSize: 14 }}>Back to Dashboard</Link>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '35px 20px 55px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ color: '#0b918d', fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>STUDENT ACCOUNT</div>
          <h1 style={{ fontSize: 30, margin: '8px 0' }}>My Profile</h1>
          <p style={{ color: '#647b91', margin: 0, lineHeight: 1.6 }}>View and update your personal information and account password.</p>
        </div>

        {message && <div role="status" style={{ padding: 13, borderRadius: 9, background: '#e5f8ef', color: '#087443', marginBottom: 18, lineHeight: 1.6 }}>{message}</div>}
        {errorMessage && <div role="alert" style={{ padding: 13, borderRadius: 9, background: '#fff0f0', color: '#bd2525', marginBottom: 18, lineHeight: 1.6 }}>{errorMessage}</div>}

        <section style={{ background: '#fff', border: '1px solid #dce5ec', borderRadius: 16, padding: 26, marginBottom: 20 }}>
          <h2 style={{ fontSize: 21, margin: '0 0 20px' }}>Personal Information</h2>
          <form onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 17 }}>
            <div>
              <label htmlFor="full-name" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Full name</label>
              <input id="full-name" required maxLength={100} value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Email address</label>
              <input id="email" type="email" value={profile.email} readOnly style={{ ...inputStyle, background: '#f3f7fa', color: '#647b91' }} />
              <small style={{ display: 'block', color: '#8293a2', marginTop: 5 }}>Email address cannot be changed here.</small>
            </div>
            <div>
              <label htmlFor="phone" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Mobile number</label>
              <input id="phone" type="tel" maxLength={20} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="Enter mobile number" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="state" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>State</label>
              <input id="state" maxLength={80} value={profile.state} onChange={e => setProfile({ ...profile, state: e.target.value })} placeholder="Enter state" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="district" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>District</label>
              <input id="district" maxLength={80} value={profile.district} onChange={e => setProfile({ ...profile, district: e.target.value })} placeholder="Enter district" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 9, padding: '13px 20px', background: '#102d49', color: '#fff', fontWeight: 750, fontSize: 15, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving profile…' : 'Save Profile'}</button>
            </div>
          </form>
        </section>

        <section style={{ background: '#fff', border: '1px solid #dce5ec', borderRadius: 16, padding: 26 }}>
          <h2 style={{ fontSize: 21, margin: '0 0 8px' }}>Change Password</h2>
          <p style={{ color: '#647b91', lineHeight: 1.6, margin: '0 0 20px' }}>Choose a new password with at least 8 characters.</p>
          <form onSubmit={handleChangePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 17 }}>
            <div>
              <label htmlFor="new-password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>New password</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="confirm-password" style={{ display: 'block', fontWeight: 650, marginBottom: 7 }}>Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={changingPassword} style={{ border: 0, borderRadius: 9, padding: '13px 20px', background: '#087f7b', color: '#fff', fontWeight: 750, fontSize: 15, cursor: changingPassword ? 'wait' : 'pointer' }}>{changingPassword ? 'Changing password…' : 'Change Password'}</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
