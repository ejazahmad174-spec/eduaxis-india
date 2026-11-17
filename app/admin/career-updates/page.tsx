
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type CareerUpdate = {
  id: string;
  category: string;
  title: string;
  organization: string | null;
  exam_name: string | null;
  state: string | null;
  description: string | null;
  notice_date: string | null;
  event_date: string | null;
  last_date: string | null;
  official_url: string | null;
  download_url: string | null;
  status: string;
  created_at: string;
};

const categories = [
  { value: 'recruitment_notice', label: 'Recruitment Notices & Updates' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'result_answer_key', label: 'Results & Answer Keys' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'other_update', label: 'Other Updates' },
];

const emptyForm = {
  category: 'recruitment_notice',
  title: '',
  organization: '',
  exam_name: '',
  state: 'All India',
  description: '',
  notice_date: '',
  event_date: '',
  last_date: '',
  official_url: '',
  download_url: '',
  status: 'draft',
};

export default function CareerUpdatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updates, setUpdates] = useState<CareerUpdate[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      const client = supabase;

      if (!client) {
        router.replace('/admin/login');
        return;
      }

      const { data: { user }, error } = await client.auth.getUser();

      if (error || !user) {
        router.replace('/admin/login');
        return;
      }

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin') {
        await client.auth.signOut();
        router.replace('/admin/login');
        return;
      }

      await loadUpdates();

      if (active) setLoading(false);
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function loadUpdates() {
    const client = supabase;
    if (!client) return;

    const { data, error } = await client
      .from('career_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Could not load updates: ' + error.message);
      return;
    }

    setUpdates((data || []) as CareerUpdate[]);
  }

  function updateField(
    field: keyof typeof emptyForm,
    value: string
  ) {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editUpdate(item: CareerUpdate) {
    setForm({
      category: item.category,
      title: item.title || '',
      organization: item.organization || '',
      exam_name: item.exam_name || '',
      state: item.state || 'All India',
      description: item.description || '',
      notice_date: item.notice_date || '',
      event_date: item.event_date || '',
      last_date: item.last_date || '',
      official_url: item.official_url || '',
      download_url: item.download_url || '',
      status: item.status || 'draft',
    });

    setEditingId(item.id);
    setMessage('');
    setErrorMessage('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;
    if (!client) return;

    if (!form.title.trim()) {
      setErrorMessage('Please enter the title.');
      return;
    }

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    try {
      const { data: { user } } = await client.auth.getUser();

      const values = {
        category: form.category,
        title: form.title.trim(),
        organization: form.organization.trim() || null,
        exam_name: form.exam_name.trim() || null,
        state: form.state.trim() || 'All India',
        description: form.description.trim() || null,
        notice_date: form.notice_date || null,
        event_date: form.event_date || null,
        last_date: form.last_date || null,
        official_url: form.official_url.trim() || null,
        download_url: form.download_url.trim() || null,
        status: form.status,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await client
          .from('career_updates')
          .update(values)
          .eq('id', editingId);

        if (error) throw error;

        setMessage('Career update updated successfully.');
      } else {
        const { error } = await client
          .from('career_updates')
          .insert({
            ...values,
            created_by: user?.id || null,
          });

        if (error) throw error;

        setMessage('Career update added successfully.');
      }

      resetForm();
      await loadUpdates();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(item: CareerUpdate, status: string) {
    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('career_updates')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      setErrorMessage('Could not change status: ' + error.message);
    } else {
      setMessage('Status updated successfully.');
      await loadUpdates();
    }

    setBusy(false);
  }

  async function deleteUpdate(item: CareerUpdate) {
    if (!window.confirm(`Delete "${item.title}" permanently?`)) return;

    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('career_updates')
      .delete()
      .eq('id', item.id);

    if (error) {
      setErrorMessage('Could not delete update: ' + error.message);
    } else {
      setMessage('Career update deleted successfully.');

      if (editingId === item.id) resetForm();

      await loadUpdates();
    }

    setBusy(false);
  }

  function categoryLabel(value: string) {
    return categories.find(item => item.value === value)?.label || value;
  }

  const visibleUpdates = updates.filter(item =>
    filter === 'all' || item.category === filter
  );

  const inputStyle = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #d7e0e8',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600 as const,
    marginBottom: '7px',
    color: '#17324d',
    fontSize: '14px',
  };

  const buttonStyle = {
    border: 0,
    borderRadius: '7px',
    padding: '9px 13px',
    cursor: 'pointer',
    fontWeight: 600 as const,
    margin: '3px',
    fontSize: '13px',
  };

  if (loading) {
    return (
      <main className="admin-loading">
        Checking administrator access…
      </main>
    );
  }

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
        <a className="admin-side-link" href="/admin/dashboard">
          ▦ &nbsp; Dashboard
        </a>

        <div className="admin-side-label">CONTENT MANAGEMENT</div>
        <a className="admin-side-link" href="/admin/study-materials">
          ▤ &nbsp; Study Materials
        </a>
        <a className="admin-side-link" href="/admin/government-jobs">
          ▤ &nbsp; Government Jobs
        </a>
        <a className="admin-side-link" href="/admin/government-jobs/discoveries">
          ↳ &nbsp; Discovered Jobs
        </a>
        <a className="admin-side-link active" href="/admin/career-updates">
          ▤ &nbsp; Career Management
        </a>

        <div className="admin-side-label">OTHER</div>
        <a className="admin-side-link" href="/">
          ↗ &nbsp; View Website
        </a>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>Career Management</h1>
            <p>Manage recruitment notices, admit cards, results and syllabus.</p>
          </div>
        </header>

        <div className="admin-content">

          {message && (
            <div style={{
              padding: '12px 15px',
              background: '#e8f7ee',
              color: '#176b39',
              borderRadius: '8px',
              marginBottom: '15px',
            }}>
              {message}
            </div>
          )}

          {errorMessage && (
            <div style={{
              padding: '12px 15px',
              background: '#fff0f0',
              color: '#b42318',
              borderRadius: '8px',
              marginBottom: '15px',
            }}>
              {errorMessage}
            </div>
          )}

          <section style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            border: '1px solid #e5eaf0',
            marginBottom: '25px',
          }}>
            <h2 style={{ marginTop: 0, color: '#17324d' }}>
              {editingId ? 'Edit Career Update' : 'Add New Career Update'}
            </h2>

            <p style={{ color: '#64748b', fontSize: '13px' }}>
              Add verified information. New entries are saved as drafts by default.
            </p>

            <form onSubmit={saveUpdate}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '16px',
              }}>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select
                    style={inputStyle}
                    value={form.category}
                    onChange={e => updateField('category', e.target.value)}
                  >
                    {categories.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Title *</label>
                  <input
                    style={inputStyle}
                    value={form.title}
                    onChange={e => updateField('title', e.target.value)}
                    placeholder="Enter notice or update title"
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Organization / Department</label>
                  <input
                    style={inputStyle}
                    value={form.organization}
                    onChange={e => updateField('organization', e.target.value)}
                    placeholder="e.g. UPSC, BPSC, NTA"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Exam Name</label>
                  <input
                    style={inputStyle}
                    value={form.exam_name}
                    onChange={e => updateField('exam_name', e.target.value)}
                    placeholder="e.g. NEET UG, CTET, SSC CGL"
                  />
                </div>

                <div>
                  <label style={labelStyle}>State / Region</label>
                  <input
                    style={inputStyle}
                    value={form.state}
                    onChange={e => updateField('state', e.target.value)}
                    placeholder="All India / Bihar / Other State"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Notice Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.notice_date}
                    onChange={e => updateField('notice_date', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Exam / Event Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.event_date}
                    onChange={e => updateField('event_date', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Last Date (if applicable)</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.last_date}
                    onChange={e => updateField('last_date', e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Official Website URL</label>
                  <input
                    type="url"
                    style={inputStyle}
                    value={form.official_url}
                    onChange={e => updateField('official_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label style={labelStyle}>Download URL</label>
                  <input
                    type="url"
                    style={inputStyle}
                    value={form.download_url}
                    onChange={e => updateField('download_url', e.target.value)}
                    placeholder="PDF or official download link"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Publication Status</label>
                  <select
                    style={inputStyle}
                    value={form.status}
                    onChange={e => updateField('status', e.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>Description / Important Details</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }}
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Write important details, instructions, eligibility or updates..."
                />
              </div>

              <div style={{ marginTop: '18px' }}>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    ...buttonStyle,
                    background: '#126b45',
                    color: '#fff',
                    padding: '11px 20px',
                  }}
                >
                  {busy ? 'Please wait...' : editingId ? 'Update Entry' : 'Save Entry'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      ...buttonStyle,
                      background: '#e9eef4',
                      color: '#17324d',
                      padding: '11px 18px',
                    }}
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
            </form>
          </section>

          <section style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            border: '1px solid #e5eaf0',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '18px',
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#17324d' }}>
                  All Career Updates
                </h2>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: 0 }}>
                  Total entries: {updates.length}
                </p>
              </div>

              <select
                style={{ ...inputStyle, maxWidth: '260px' }}
                value={filter}
                onChange={e => setFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {visibleUpdates.length === 0 ? (
              <p style={{ color: '#64748b', padding: '20px 0' }}>
                No career updates found. Add your first entry using the form above.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {visibleUpdates.map(item => (
                  <article
                    key={item.id}
                    style={{
                      border: '1px solid #e5eaf0',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#126b45',
                          fontWeight: 700,
                          marginBottom: '7px',
                        }}>
                          {categoryLabel(item.category)}
                        </div>

                        <h3 style={{
                          margin: '0 0 8px',
                          color: '#17324d',
                          fontSize: '17px',
                        }}>
                          {item.title}
                        </h3>

                        <p style={{
                          margin: '4px 0',
                          color: '#64748b',
                          fontSize: '13px',
                        }}>
                          {item.organization || 'Organization not specified'}
                          {item.exam_name ? ` • ${item.exam_name}` : ''}
                          {item.state ? ` • ${item.state}` : ''}
                        </p>

                        <p style={{
                          margin: '7px 0',
                          fontSize: '12px',
                          color: '#64748b',
                        }}>
                          Status: <b>{item.status.toUpperCase()}</b>
                          {item.last_date ? ` • Last Date: ${item.last_date}` : ''}
                        </p>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                      }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => editUpdate(item)}
                          style={{ ...buttonStyle, background: '#e8f1ff', color: '#2457a6' }}
                        >
                          Edit
                        </button>

                        {item.status !== 'published' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(item, 'published')}
                            style={{ ...buttonStyle, background: '#e8f7ee', color: '#176b39' }}
                          >
                            Publish
                          </button>
                        )}

                        {item.status === 'published' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(item, 'draft')}
                            style={{ ...buttonStyle, background: '#fff4df', color: '#925d00' }}
                          >
                            Unpublish
                          </button>
                        )}

                        {item.status !== 'closed' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(item, 'closed')}
                            style={{ ...buttonStyle, background: '#f1f2f4', color: '#475569' }}
                          >
                            Close
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => deleteUpdate(item)}
                          style={{ ...buttonStyle, background: '#fff0f0', color: '#b42318' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
