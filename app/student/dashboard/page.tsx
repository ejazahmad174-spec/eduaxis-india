'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type StudentProfile = {
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadStudent() {
      if (!supabase) {
        if (active) {
          setErrorMessage('The student service is not configured. Please try again later.');
          setLoading(false);
        }
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace('/student/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', authData.user.id)
        .single();

      if (!active) return;

      if (profileError) {
        setErrorMessage('We could not load your profile. Please refresh the page or sign in again.');
        setLoading(false);
        return;
      }

      if (profileData.role === 'admin') {
        router.replace('/admin/dashboard');
        return;
      }

      setProfile({
        full_name: profileData.full_name || authData.user.user_metadata?.full_name || 'Student',
        email: profileData.email || authData.user.email || '',
        role: profileData.role || 'student',
      });
      setLoading(false);
    }

    loadStudent();
    return () => { active = false; };
  }, [router]);

  async function handleSignOut() {
    if (!supabase) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage('We could not sign you out. Please try again.');
      setSigningOut(false);
      return;
    }

    router.replace('/student/login');
    router.refresh();
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f7fa', color: '#102d49' }}>
        <p>Loading your student dashboard…</p>
      </main>
    );
  }

  if (errorMessage && !profile) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f7fa', padding: 20 }}>
        <section style={{ maxWidth: 480, background: '#fff', padding: 28, borderRadius: 16, color: '#102d49' }}>
          <h1>Student Dashboard</h1>
          <p style={{ color: '#bd2525' }}>{errorMessage}</p>
          <Link href="/student/login" style={{ color: '#087f7b', fontWeight: 700 }}>Return to Student Login</Link>
        </section>
      </main>
    );
  }

  const shortcuts = [
    { title: 'My Profile', description: 'View and update your name, mobile number, state, district and password.', href: '/student/profile', label: 'Manage my profile' },
    { title: 'Study Materials', description: 'Explore free and premium study resources.', href: '/study-materials', label: 'Explore materials' },
    { title: 'Online Courses', description: 'Discover learning courses on EduAxis India.', href: '/courses', label: 'View courses' },
    { title: 'Mock Tests', description: 'Prepare with exam-oriented practice tests.', href: '/mock-tests', label: 'View mock tests' },
    { title: 'Latest Government Jobs', description: 'Find government job notifications and official links.', href: '/government-jobs', label: 'View job updates' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f7fa', color: '#102d49' }}>
      <header style={{ background: '#102d49', color: '#fff', padding: '17px 22px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 21 }}>
            EduAxis <span style={{ color: '#55d2c6' }}>India</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/student/profile" style={{ color: '#fff', border: '1px solid rgba(255,255,255,.55)', textDecoration: 'none', borderRadius: 8, padding: '9px 13px', fontWeight: 700, fontSize: 14 }}>
              My Profile
            </Link>
            <button onClick={handleSignOut} disabled={signingOut} style={{ background: '#fff', color: '#102d49', border: 0, borderRadius: 8, padding: '10px 15px', fontWeight: 750, cursor: signingOut ? 'wait' : 'pointer' }}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '38px 20px 55px' }}>
        <section style={{ background: '#fff', border: '1px solid #dce5ec', borderRadius: 16, padding: 28, boxShadow: '0 8px 30px rgba(16,45,73,.05)' }}>
          <div style={{ color: '#0b918d', fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>STUDENT DASHBOARD</div>
          <h1 style={{ fontSize: 30, margin: '10px 0 8px' }}>Welcome, {profile?.full_name || 'Student'}!</h1>
          <p style={{ color: '#647b91', lineHeight: 1.6, margin: 0 }}>Your learning journey continues here. Choose a section below to get started.</p>
          {errorMessage && <p role="alert" style={{ color: '#bd2525', marginBottom: 0 }}>{errorMessage}</p>}
          <div style={{ marginTop: 22, padding: 16, borderRadius: 11, background: '#f3f7fa' }}>
            <div style={{ fontWeight: 750, marginBottom: 6 }}>Account details</div>
            <div style={{ color: '#647b91', fontSize: 14 }}>Name: {profile?.full_name || 'Student'}</div>
            <div style={{ color: '#647b91', fontSize: 14, marginTop: 4 }}>Email: {profile?.email}</div>
            <div style={{ marginTop: 12 }}>
              <Link href="/student/profile" style={{ color: '#087f7b', fontWeight: 750, textDecoration: 'none', fontSize: 14 }}>View or edit your profile →</Link>
            </div>
          </div>
        </section>

        <h2 style={{ fontSize: 22, margin: '32px 0 16px' }}>Explore EduAxis India</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {shortcuts.map(item => (
            <section key={item.title} style={{ background: '#fff', border: '1px solid #dce5ec', borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontSize: 18, margin: '0 0 9px' }}>{item.title}</h3>
              <p style={{ color: '#647b91', lineHeight: 1.6, minHeight: 48, margin: '0 0 16px', fontSize: 14 }}>{item.description}</p>
              <Link href={item.href} style={{ color: '#087f7b', fontWeight: 750, textDecoration: 'none', fontSize: 14 }}>{item.label} →</Link>
            </section>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: '#8293a2', fontSize: 12, marginTop: 35 }}>
          © {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.
        </p>
      </div>
    </main>
  );
}
