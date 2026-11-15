
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Feedback = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  created_at: string;
};

type Filter = 'all' | 'new' | 'read' | 'resolved';

export default function AdminFeedbackPage() {
  const router = useRouter();

  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [updating, setUpdating] = useState('');

  useEffect(() => {
    let active = true;

    async function loadFeedback() {
      if (!supabase) {
        router.replace('/admin/login');
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
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

      const { data, error: fetchError } = await supabase
        .from('website_feedback')
        .select('id, name, email, subject, message, status, created_at')
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError('Unable to load feedback. Please refresh the page.');
      } else {
        setFeedback((data || []) as Feedback[]);
      }

      setLoading(false);
    }

    loadFeedback();

    return () => {
      active = false;
    };
  }, [router]);

  async function updateStatus(item: Feedback, status: Feedback['status']) {
    if (!supabase || updating) return;

    setUpdating(item.id);
    setError('');

    const { error: updateError } = await supabase
      .from('website_feedback')
      .update({ status })
      .eq('id', item.id);

    if (updateError) {
      setError('Could not update the feedback status. Please try again.');
    } else {
      setFeedback((previous) =>
        previous.map((entry) =>
          entry.id === item.id ? { ...entry, status } : entry
        )
      );

      setSelected((previous) =>
        previous?.id === item.id ? { ...previous, status } : previous
      );
    }

    setUpdating('');
  }

  const filteredFeedback = useMemo(() => {
    return feedback.filter((item) => {
      const matchesFilter =
        filter === 'all' || item.status === filter;

      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [feedback, filter, search]);

  const counts = {
    all: feedback.length,
    new: feedback.filter((item) => item.status === 'new').length,
    read: feedback.filter((item) => item.status === 'read').length,
    resolved: feedback.filter((item) => item.status === 'resolved').length,
  };

  function formatDate(date: string) {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const statusStyle: Record<string, React.CSSProperties> = {
    new: {
      background: '#fff4df',
      color: '#a16207',
    },
    read: {
      background: '#e8f1ff',
      color: '#1d4ed8',
    },
    resolved: {
      background: '#e7f8ef',
      color: '#15803d',
    },
  };

  if (loading) {
    return (
      <main className="admin-loading">
        Checking administrator access...
      </main>
    );
  }

  return (
    <main
      className="admin-shell"
      style={{ minHeight: '100vh' }}
    >
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span className="admin-brand-mark">E</span>
          <span>
            EduAxis <b>India</b>
            <small>ADMINISTRATION</small>
          </span>
        </a>

        <div className="admin-side-label">WORKSPACE</div>

        <Link className="admin-side-link" href="/admin/dashboard">
          ▦ &nbsp; Dashboard
        </Link>

        <div className="admin-side-label">CONTENT MANAGEMENT</div>

        <Link className="admin-side-link" href="/admin/study-materials">
          ▤ &nbsp; Study Materials
        </Link>

        <Link className="admin-side-link" href="/admin/courses">
          🎓 &nbsp; Online Courses
        </Link>

        <Link className="admin-side-link" href="/admin/mock-tests">
          ▤ &nbsp; Mock Tests
        </Link>

        <div className="admin-side-label">BLOG MANAGEMENT</div>

        <Link className="admin-side-link" href="/admin/author-management">
          ✍️ &nbsp; Author Management
        </Link>

        <Link className="admin-side-link" href="/admin/blogs">
          ▤ &nbsp; Blog Management
        </Link>

        <div className="admin-side-label">COMMUNICATION</div>

        <Link
          className="admin-side-link active"
          href="/admin/feedback"
        >
          ✉️ &nbsp; Website Feedback
        </Link>

        <div className="admin-sidebar-bottom">
          <a href="/">← View public website</a>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN</div>
            <h1>Feedback Inbox</h1>
          </div>

          <Link
            href="/admin/dashboard"
            style={{
              color: '#0f766e',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            ← Dashboard
          </Link>
        </header>

        <div className="admin-welcome">
          <div>
            <h2>Website Feedback</h2>
            <p>
              Read and manage messages submitted by website visitors.
            </p>
          </div>

          <span className="admin-secure">
            ✓ Secure admin access
          </span>
        </div>

        {error && (
          <div className="admin-notice">{error}</div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: 14,
            margin: '25px 0',
          }}
        >
          {[
            ['All messages', counts.all, '#334155'],
            ['New', counts.new, '#a16207'],
            ['Read', counts.read, '#1d4ed8'],
            ['Resolved', counts.resolved, '#15803d'],
          ].map(([label, count, color]) => (
            <div
              key={String(label)}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ color: '#64748b', fontSize: 13 }}>
                {label}
              </div>
              <strong
                style={{
                  display: 'block',
                  fontSize: 30,
                  color: String(color),
                  marginTop: 8,
                }}
              >
                {count}
              </strong>
            </div>
          ))}
        </div>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Messages</h2>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, subject or message..."
            style={{
              width: '100%',
              padding: 13,
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              marginBottom: 16,
              boxSizing: 'border-box',
              fontSize: 14,
            }}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {(['all', 'new', 'read', 'resolved'] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                style={{
                  padding: '9px 15px',
                  borderRadius: 20,
                  border: '1px solid #cbd5e1',
                  background: filter === item ? '#0f766e' : '#fff',
                  color: filter === item ? '#fff' : '#334155',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {item} ({counts[item]})
              </button>
            ))}
          </div>

          {filteredFeedback.length === 0 ? (
            <p style={{ color: '#64748b', padding: '25px 0' }}>
              No feedback messages found.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 650,
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Sender', 'Subject', 'Date', 'Status', 'Action'].map(
                      (heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: 12,
                            borderBottom: '1px solid #e2e8f0',
                            fontSize: 13,
                          }}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredFeedback.map((item) => (
                    <tr key={item.id}>
                      <td
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <strong>{item.name}</strong>
                        <div
                          style={{
                            color: '#64748b',
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {item.email}
                        </div>
                      </td>

                      <td
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        {item.subject}
                      </td>

                      <td
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #e2e8f0',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(item.created_at)}
                      </td>

                      <td
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <span
                          style={{
                            ...statusStyle[item.status],
                            padding: '5px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <button
                          onClick={() => setSelected(item)}
                          style={{
                            border: 'none',
                            background: '#e6f4f1',
                            color: '#0f766e',
                            padding: '8px 12px',
                            borderRadius: 7,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          View message
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="admin-footer">
          EduAxis India · Learn. Prepare. Progress.
        </footer>
      </section>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 25,
              width: '100%',
              maxWidth: 560,
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 15,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Feedback Details</h2>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 24,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <p><strong>Name:</strong> {selected.name}</p>
            <p><strong>Email:</strong> {selected.email}</p>
            <p><strong>Subject:</strong> {selected.subject}</p>
            <p>
              <strong>Date:</strong> {formatDate(selected.created_at)}
            </p>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: 9,
                padding: 16,
                margin: '18px 0',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                lineHeight: 1.7,
              }}
            >
              {selected.message}
            </div>

            <p>
              <strong>Status:</strong>{' '}
              <span style={{ textTransform: 'capitalize' }}>
                {selected.status}
              </span>
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                disabled={!!updating || selected.status === 'read'}
                onClick={() => updateStatus(selected, 'read')}
                style={{
                  padding: '11px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: selected.status === 'read' ? 0.5 : 1,
                }}
              >
                Mark as Read
              </button>

              <button
                disabled={!!updating || selected.status === 'resolved'}
                onClick={() => updateStatus(selected, 'resolved')}
                style={{
                  padding: '11px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#15803d',
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: selected.status === 'resolved' ? 0.5 : 1,
                }}
              >
                Mark as Resolved
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
