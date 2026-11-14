'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Counts = {
  materials: number;
  jobs: number;
  courses: number;
  tests: number;
  news: number;
  authors: number;
  submissions: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const [counts, setCounts] = useState<Counts>({
    materials: 0,
    jobs: 0,
    courses: 0,
    tests: 0,
    news: 0,
    authors: 0,
    submissions: 0,
  });

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!supabase) {
        router.replace('/admin/login');
        return;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace('/admin/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin') {
        await supabase.auth.signOut();
        router.replace('/admin/login');
        return;
      }

      const [
        m,
        j,
        c,
        t,
        n,
        a,
        s,
      ] = await Promise.all([
        supabase.from('study_materials').select('*', { count: 'exact', head: true }),
        supabase.from('government_jobs').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('mock_tests').select('*', { count: 'exact', head: true }),
        supabase.from('education_news').select('*', { count: 'exact', head: true }),
        supabase.from('author_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('author_submissions').select('*', { count: 'exact', head: true }),
      ]);

      if (!active) return;

      if ([m.error, j.error, c.error, t.error, n.error, a.error, s.error].some(Boolean)) {
        setNotice(
          'Some dashboard statistics could not be loaded. Please check Supabase permissions.'
        );
      }

      setEmail(user.email || 'Administrator');

      setCounts({
        materials: m.count || 0,
        jobs: j.count || 0,
        courses: c.count || 0,
        tests: t.count || 0,
        news: n.count || 0,
        authors: a.count || 0,
        submissions: s.count || 0,
      });

      setLoading(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace('/admin/login');
    router.refresh();
  }

  if (loading) {
    return (
      <main className="admin-loading">
        Checking administrator access...
      </main>
    );
  }

  const cards = [
    ['📚', 'Study materials', counts.materials, 'PDFs and learning resources'],
    ['💼', 'Government jobs', counts.jobs, 'Recruitment notifications'],
    ['🎓', 'Online courses', counts.courses, 'Courses and lessons'],
    ['📝', 'Mock tests', counts.tests, 'Practice tests'],
    ['📰', 'Education news', counts.news, 'News and announcements'],
    ['✍️', 'Author applications', counts.authors, 'Registered contributors'],
    ['📖', 'Article submissions', counts.submissions, 'Articles awaiting review'],
  ];

  return (
    <main className="admin-shell">

      <aside className="admin-sidebar">

        <a href="/" className="admin-brand">
          <span className="admin-brand-mark">E</span>
          <span>
            EduAxis <b>India</b>
            <small>ADMINISTRATION</small>
          </span>
        </a>

        <div className="admin-side-label">WORKSPACE</div>

        <a
          className="admin-side-link active"
          href="/admin/dashboard"
        >
          ▦ &nbsp; Dashboard
        </a>

        <div className="admin-side-label">
          CONTENT MANAGEMENT
        </div>

        <a
          className="admin-side-link"
          href="/admin/study-materials"
        >
          ▤ &nbsp; Study Materials
        </a>

        <div className="admin-side-link muted">
          ▤ &nbsp; Government Jobs
          <small>Coming next</small>
        </div>

        <Link
          className="admin-side-link"
          href="/admin/courses"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '5px',
          }}
        >
          <span>🎓 &nbsp; Online Courses</span>
          <small style={{ marginLeft: '24px' }}>
            Manage courses →
          </small>
        </Link>

        <a
          className="admin-side-link"
          href="/admin/mock-tests"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '5px',
          }}
        >
          <span>▤ &nbsp; Mock Tests</span>
          <small style={{ marginLeft: '24px' }}>
            Manage tests →
          </small>
        </a>

        <div className="admin-side-link muted">
          ▤ &nbsp; Education News
          <small>Coming next</small>
        </div>

        <div className="admin-side-label">
          BLOG MANAGEMENT
        </div>

        <Link
          className="admin-side-link"
          href="/admin/author-management"
        >
          ✍️ &nbsp; Author Management
          <small style={{ marginLeft: '24px' }}>
            Approvals & articles →
          </small>
        </Link>

        <Link
          className="admin-side-link"
          href="/admin/blogs"
        >
          ▤ &nbsp; Blog Management
        </Link>

        <div className="admin-sidebar-bottom">
          <a href="/">← View public website</a>
        </div>

      </aside>

      <section className="admin-main">

        <header className="admin-topbar">

          <div>
            <div className="admin-kicker">
              EDUAXIS INDIA / ADMIN
            </div>
            <h1>Dashboard</h1>
          </div>

          <div className="admin-user">
            <span className="admin-avatar">A</span>

            <span>
              <b>Administrator</b>
              <small>{email}</small>
            </span>

            <button
              onClick={signOut}
              className="admin-logout"
            >
              Sign out
            </button>
          </div>

        </header>

        <div className="admin-welcome">

          <div>
            <h2>Welcome back!</h2>
            <p>
              Here is an overview of your EduAxis India platform.
            </p>
          </div>

          <span className="admin-secure">
            ✓ Secure admin session
          </span>

        </div>

        {notice && (
          <div className="admin-notice">
            {notice}
          </div>
        )}

        <div className="admin-stats">

          {cards.map(([icon, label, count, detail]) => (
            <article
              className="admin-stat"
              key={String(label)}
            >
              <div className="admin-stat-top">
                <span>{icon}</span>
                <small>ALL RECORDS</small>
              </div>

              <strong>{count}</strong>
              <b>{label}</b>
              <p>{detail}</p>
            </article>
          ))}

        </div>

        <section className="admin-next">

          <div>
            <div className="admin-kicker">
              CONTENT MANAGEMENT
            </div>

            <h2>Manage your educational content</h2>

            <p>
              Manage Study Materials, Online Courses, Mock Tests,
              Government Jobs and educational content from your
              administrator account. You can also manage author
              applications and article submissions.
            </p>
          </div>

          <div className="admin-next-badge">
            AVAILABLE TOOLS
            <br />
            <b>COURSES, STUDY MATERIALS, MOCK TESTS & BLOGS</b>
          </div>

        </section>

        <footer className="admin-footer">
          EduAxis India · Learn. Prepare. Progress.
        </footer>

      </section>

    </main>
  );
}
