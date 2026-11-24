'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const studentLinks = [
  { label: 'Dashboard', href: '/student/dashboard' },
  { label: 'Study Materials', href: '/study-materials' },
  { label: 'Courses', href: '/courses' },
  { label: 'Mock Tests', href: '/mock-tests' },
  { label: 'Government Jobs & Updates', href: '/career-updates' },
];

export default function StudentNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [shortName, setShortName] = useState('Student');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadName() {
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user || !active) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', authData.user.id)
        .maybeSingle();
      if (!active) return;
      const name = data?.full_name || authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'Student';
      setShortName(String(name).trim().split(/\s+/)[0] || 'Student');
    }
    loadName();
    return () => { active = false; };
  }, []);

  async function handleSignOut() {
    if (!window.confirm('Are you sure you want to log out?')) return;
    if (!supabase) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert('We could not sign you out. Please try again.');
      setSigningOut(false);
      return;
    }
    router.replace('/student/login');
    router.refresh();
  }

  return (
    <header className="student-shell-header">
      <div className="student-shell-inner">
        <div className="student-shell-brand">
          <div>
            <Link href="/student/dashboard" className="student-shell-brand-name">EduAxis <span>India</span></Link>
            <div className="student-shell-greeting">Hello, {shortName}</div>
          </div>
        </div>
        <nav className="student-shell-links" aria-label="Student navigation">
          {studentLinks.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={pathname === item.href ? 'active' : ''}>{item.label}</Link>
          ))}
          <Link href="/student/profile" aria-current={pathname === '/student/profile' ? 'page' : undefined} className={pathname === '/student/profile' ? 'active' : ''}>My Profile</Link>
        </nav>
        <button type="button" className="student-shell-logout" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Logout'}
        </button>
      </div>
      <style jsx>{`
        .student-shell-header { background:#102b46; color:#fff; padding:12px 4%; box-shadow:0 3px 14px rgba(16,43,70,.12); }
        .student-shell-inner { max-width:1240px; margin:auto; display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; }
        .student-shell-brand { display:flex; align-items:center; gap:10px; min-width:190px; }
        .student-shell-logo { width:42px; height:42px; display:grid; place-items:center; border-radius:11px; background:#129b98; color:#fff; font-size:23px; font-weight:850; text-decoration:none; }
        .student-shell-brand-name { color:#fff; font-size:19px; font-weight:850; text-decoration:none; }
        .student-shell-brand-name span { color:#55d2c6; }
        .student-shell-greeting { color:#c8d8e4; font-size:12px; margin-top:2px; }
        .student-shell-links { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; }
        .student-shell-links a { color:#e8f1f6; text-decoration:none; font-size:13px; font-weight:650; padding:10px 12px; border-radius:7px; white-space:nowrap; }
        .student-shell-links a:hover,.student-shell-links a.active { background:rgba(255,255,255,.14); color:#fff; }
        
        .student-shell-logout { border:1px solid rgba(255,255,255,.55); background:#fff; color:#102b46; border-radius:8px; padding:9px 13px; font-size:13px; font-weight:750; cursor:pointer; }
        .student-shell-logout:disabled { opacity:.65; cursor:wait; }
        @media(max-width:760px) { .student-shell-inner { align-items:flex-start; } .student-shell-links { order:3; width:100%; justify-content:flex-start; } .student-shell-links a { padding:8px; } .student-shell-logout { margin-left:auto; } }
      `}</style>
    </header>
  );
}
