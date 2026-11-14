'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  is_free: boolean | null;
  thumbnail_url: string | null;
  status: 'draft' | 'published';
  course_type: 'academic' | 'competitive' | 'skill';
  class_level: number | null;
  subject: string | null;
  created_at: string | null;
};

type BoardMapping = {
  id: string;
  course_id: string;
  board: 'BSEB' | 'CBSE';
  academic_session: string;
  is_active: boolean;
};

type FormState = {
  title: string;
  classLevel: string;
  subject: string;
  boards: string[];
  session: string;
  description: string;
  price: string;
  thumbnailUrl: string;
  status: 'draft' | 'published';
};

const emptyForm: FormState = {
  title: '',
  classLevel: '11',
  subject: 'Accountancy',
  boards: ['BSEB', 'CBSE'],
  session: '2026-27',
  description: '',
  price: '',
  thumbnailUrl: '',
  status: 'draft',
};

export default function AdminCoursesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mappings, setMappings] = useState<BoardMapping[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let active = true;

    async function initialise() {
      const client = supabase;
      if (!client) {
        router.replace('/admin/login');
        return;
      }

      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) {
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

      await loadData(active);
    }

    async function loadData(isActive: boolean) {
      const client = supabase;
      if (!client) return;

      const [courseResult, mappingResult] = await Promise.all([
        client.from('courses').select('*').order('created_at', { ascending: false }),
        client.from('course_board_mappings').select('*'),
      ]);

      if (!isActive) return;
      if (courseResult.error) {
        setErrorMessage(`Could not load courses: ${courseResult.error.message}`);
      } else {
        setCourses((courseResult.data || []) as Course[]);
      }
      if (mappingResult.error) {
        setErrorMessage((current) => current || `Could not load board mappings: ${mappingResult.error.message}`);
      } else {
        setMappings((mappingResult.data || []) as BoardMapping[]);
      }
      setLoading(false);
    }

    initialise();
    return () => { active = false; };
  }, [router]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleBoard(board: string) {
    setForm((current) => ({
      ...current,
      boards: current.boards.includes(board)
        ? current.boards.filter((item) => item !== board)
        : [...current.boards, board],
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setErrorMessage('');
  }

  function startEdit(course: Course) {
    const courseBoards = mappings
      .filter((mapping) => mapping.course_id === course.id && mapping.is_active)
      .map((mapping) => mapping.board);

    setEditingId(course.id);
    setForm({
      title: course.title || '',
      classLevel: String(course.class_level || 11),
      subject: course.subject || 'Accountancy',
      boards: courseBoards,
      session: mappings.find((mapping) => mapping.course_id === course.id)?.academic_session || '2026-27',
      description: course.description || '',
      price: course.price === null ? '' : String(course.price),
      thumbnailUrl: course.thumbnail_url || '',
      status: course.status || 'draft',
    });
    setNotice('Editing course. Make your changes and save.');
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('The database connection is unavailable.');
      return;
    }
    if (!form.title.trim()) {
      setErrorMessage('Please enter a course title.');
      return;
    }
    if (form.boards.length === 0) {
      setErrorMessage('Please select at least one board.');
      return;
    }
    if (form.price.trim() === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      setErrorMessage('Please enter a valid course price.');
      return;
    }

    setSaving(true);
    const client = supabase;
    const coursePayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: 'Commerce',
      price: Number(form.price),
      is_free: false,
      thumbnail_url: form.thumbnailUrl.trim() || null,
      status: form.status,
      course_type: 'academic',
      class_level: Number(form.classLevel),
      subject: form.subject,
    };

    let courseId = editingId;
    let courseError: { message: string } | null = null;

    if (editingId) {
      const result = await client.from('courses').update(coursePayload).eq('id', editingId);
      courseError = result.error;
    } else {
      const result = await client.from('courses').insert(coursePayload).select('id').single();
      courseError = result.error;
      if (!result.error && result.data) courseId = result.data.id;
    }

    if (courseError || !courseId) {
      setErrorMessage(courseError?.message || 'The course could not be saved.');
      setSaving(false);
      return;
    }

    const existingMappings = mappings.filter((mapping) => mapping.course_id === courseId);
    const mappingRows = form.boards.map((board) => ({
      course_id: courseId,
      board,
      academic_session: form.session,
      is_active: true,
    }));

    const { error: mappingError } = await client
      .from('course_board_mappings')
      .upsert(mappingRows, { onConflict: 'course_id,board,academic_session' });

    if (mappingError) {
      setErrorMessage(`The course was saved, but its board mapping could not be saved: ${mappingError.message}`);
      setSaving(false);
      await refreshData();
      return;
    }

    const mappingsToDeactivate = existingMappings.filter(
      (mapping) => !form.boards.includes(mapping.board) || mapping.academic_session !== form.session
    );
    for (const mapping of mappingsToDeactivate) {
      await client.from('course_board_mappings').update({ is_active: false }).eq('id', mapping.id);
    }

    setNotice(editingId ? 'Course updated successfully.' : 'Course created successfully.');
    resetForm();
    await refreshData();
    setSaving(false);
  }

  async function refreshData() {
    if (!supabase) return;
    const [courseResult, mappingResult] = await Promise.all([
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('course_board_mappings').select('*'),
    ]);
    if (!courseResult.error) setCourses((courseResult.data || []) as Course[]);
    if (!mappingResult.error) setMappings((mappingResult.data || []) as BoardMapping[]);
  }

  async function deleteCourse(course: Course) {
    if (!supabase) return;
    const confirmed = window.confirm(`Delete "${course.title}"? Its syllabus units, chapters and lessons will also be deleted.`);
    if (!confirmed) return;

    const { error } = await supabase.from('courses').delete().eq('id', course.id);
    if (error) {
      setErrorMessage(`Could not delete course: ${error.message}`);
      return;
    }
    if (editingId === course.id) resetForm();
    setNotice('Course deleted successfully.');
    setErrorMessage('');
    await refreshData();
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  const visibleCourses = courses.filter((course) => {
    if (filter === 'all') return true;
    return course.status === filter;
  });

  if (loading) {
    return <main className="admin-loading">Checking administrator access...</main>;
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span className="admin-brand-mark">E</span>
          <span>EduAxis <b>India</b><small>ADMINISTRATION</small></span>
        </a>
        <div className="admin-side-label">WORKSPACE</div>
        <Link className="admin-side-link" href="/admin/dashboard">▦ &nbsp; Dashboard</Link>
        <div className="admin-side-label">CONTENT MANAGEMENT</div>
        <Link className="admin-side-link" href="/admin/study-materials">▤ &nbsp; Study Materials</Link>
        <div className="admin-side-link muted">▤ &nbsp; Government Jobs<small>Coming next</small></div>
        <Link className="admin-side-link active" href="/admin/courses">🎓 &nbsp; Online Courses</Link>
        <Link className="admin-side-link" href="/admin/mock-tests">▤ &nbsp; Mock Tests</Link>
        <div className="admin-side-link muted">▤ &nbsp; Education News<small>Coming next</small></div>
        <div className="admin-side-label">BLOG MANAGEMENT</div>
        <Link className="admin-side-link" href="/admin/author-management">✍️ &nbsp; Author Management</Link>
        <Link className="admin-side-link" href="/admin/blogs">▤ &nbsp; Blog Management</Link>
        <div className="admin-sidebar-bottom"><a href="/">← View public website</a></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN</div>
            <h1>Course Management</h1>
          </div>
          <div className="admin-user">
            <span className="admin-avatar">A</span>
            <span><b>Administrator</b><small>Commerce Academy</small></span>
            <button onClick={signOut} className="admin-logout">Sign out</button>
          </div>
        </header>

        <div className="admin-welcome">
          <div>
            <h2>Manage Commerce Academy</h2>
            <p>Create Class 11 and 12 Commerce courses for BSEB and CBSE.</p>
          </div>
          <span className="admin-secure">✓ Secure admin area</span>
        </div>

        {notice && <div className="admin-notice">{notice}</div>}
        {errorMessage && <div className="admin-notice" style={{ borderLeft: '4px solid #c0392b' }}>{errorMessage}</div>}

        <section style={panelStyle}>
          <div style={sectionHeadingStyle}>
            <div>
              <div className="admin-kicker">COURSE BUILDER</div>
              <h2 style={{ margin: '5px 0 0', color: '#102b46' }}>{editingId ? 'Edit course' : 'Create a new course'}</h2>
            </div>
            {editingId && <button type="button" onClick={resetForm} style={secondaryButtonStyle}>Cancel editing</button>}
          </div>

          <form onSubmit={saveCourse}>
            <div style={formGridStyle}>
              <label style={labelStyle}>
                Course title *
                <input style={inputStyle} value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="e.g. Class 11 Accountancy – Complete Course" required />
              </label>
              <label style={labelStyle}>
                Class *
                <select style={inputStyle} value={form.classLevel} onChange={(e) => updateForm('classLevel', e.target.value)}>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
              </label>
              <label style={labelStyle}>
                Subject *
                <select style={inputStyle} value={form.subject} onChange={(e) => updateForm('subject', e.target.value)}>
                  <option>Accountancy</option>
                  <option>Business Studies</option>
                  <option>Economics</option>
                  <option>Entrepreneurship</option>
                </select>
              </label>
              <label style={labelStyle}>
                Academic session *
                <select style={inputStyle} value={form.session} onChange={(e) => updateForm('session', e.target.value)}>
                  <option value="2026-27">2026–27</option>
                  <option value="2027-28">2027–28</option>
                </select>
              </label>
              <label style={labelStyle}>
                Course price (₹) *
                <input style={inputStyle} type="number" min="0" step="1" value={form.price} onChange={(e) => updateForm('price', e.target.value)} placeholder="e.g. 999" required />
              </label>
              <label style={labelStyle}>
                Course status *
                <select style={inputStyle} value={form.status} onChange={(e) => updateForm('status', e.target.value as 'draft' | 'published')}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Course thumbnail URL (optional)
                <input style={inputStyle} type="url" value={form.thumbnailUrl} onChange={(e) => updateForm('thumbnailUrl', e.target.value)} placeholder="https://..." />
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Course description
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Describe what students will learn in this course." />
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ ...labelStyle, marginBottom: 10 }}>Available boards *</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {['BSEB', 'CBSE'].map((board) => (
                  <label key={board} style={boardChoiceStyle}>
                    <input type="checkbox" checked={form.boards.includes(board)} onChange={() => toggleBoard(board)} />
                    <span><b>{board}</b> {board === 'BSEB' ? 'Bihar Board' : 'Central Board'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                {saving ? 'Saving...' : editingId ? 'Update course' : 'Create course'}
              </button>
              <button type="button" onClick={resetForm} style={secondaryButtonStyle}>Clear form</button>
            </div>
          </form>
        </section>

        <section style={{ ...panelStyle, marginTop: 24 }}>
          <div style={sectionHeadingStyle}>
            <div>
              <div className="admin-kicker">COURSE LIBRARY</div>
              <h2 style={{ margin: '5px 0 0', color: '#102b46' }}>Your courses ({courses.length})</h2>
            </div>
            <select aria-label="Filter courses" style={{ ...inputStyle, width: 'auto', minWidth: 145 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All courses</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </div>

          {visibleCourses.length === 0 ? (
            <div style={emptyStyle}>No courses found. Create your first Commerce course above.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {visibleCourses.map((course) => {
                const courseBoards = mappings
                  .filter((mapping) => mapping.course_id === course.id && mapping.is_active)
                  .map((mapping) => mapping.board);
                return (
                  <article key={course.id} style={courseCardStyle}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 7 }}>
                        <span style={statusPill(course.status)}>{course.status.toUpperCase()}</span>
                        <span style={neutralPillStyle}>Class {course.class_level || '—'}</span>
                        <span style={neutralPillStyle}>{course.subject || 'Subject not set'}</span>
                      </div>
                      <h3 style={{ margin: '0 0 6px', color: '#102b46', fontSize: 17 }}>{course.title}</h3>
                      <p style={{ margin: 0, color: '#657789', fontSize: 13 }}>{course.description || 'No description added.'}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                        {courseBoards.map((board) => <span key={board} style={neutralPillStyle}>{board}</span>)}
                        <span style={neutralPillStyle}>₹{Number(course.price || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => startEdit(course)} style={secondaryButtonStyle}>Edit</button>
                      <button type="button" onClick={() => deleteCourse(course)} style={deleteButtonStyle}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="admin-footer">EduAxis India · Learn. Prepare. Progress.</footer>
      </section>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#ffffff', border: '1px solid #e2eaed', borderRadius: 14,
  padding: 24, boxShadow: '0 5px 20px rgba(16,43,70,0.04)',
};
const sectionHeadingStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 15, flexWrap: 'wrap', marginBottom: 22,
};
const formGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16,
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 7, color: '#263b4d',
  fontSize: 13, fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #d7e1e6',
  borderRadius: 8, padding: '11px 12px', color: '#172b3d', background: '#fff',
  font: 'inherit', fontWeight: 400, minHeight: 43,
};
const primaryButtonStyle: React.CSSProperties = {
  border: 0, borderRadius: 8, padding: '12px 20px', background: '#102b46',
  color: '#fff', fontWeight: 700, cursor: 'pointer',
};
const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #d7e1e6', borderRadius: 8, padding: '10px 15px',
  background: '#fff', color: '#102b46', fontWeight: 700, cursor: 'pointer',
};
const deleteButtonStyle: React.CSSProperties = {
  border: '1px solid #f0caca', borderRadius: 8, padding: '10px 15px',
  background: '#fff7f7', color: '#a93232', fontWeight: 700, cursor: 'pointer',
};
const boardChoiceStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px',
  border: '1px solid #d7e1e6', borderRadius: 9, color: '#263b4d', fontSize: 14,
};
const emptyStyle: React.CSSProperties = {
  padding: 30, textAlign: 'center', color: '#657789', background: '#f7fafb', borderRadius: 10,
};
const courseCardStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18,
  flexWrap: 'wrap', border: '1px solid #e2eaed', borderRadius: 11, padding: 16,
};
const neutralPillStyle: React.CSSProperties = {
  display: 'inline-block', background: '#eef3f6', color: '#42586a',
  borderRadius: 20, padding: '5px 9px', fontSize: 11, fontWeight: 700,
};
function statusPill(status: string): React.CSSProperties {
  return {
    display: 'inline-block', background: status === 'published' ? '#e6f6ef' : '#fff4df',
    color: status === 'published' ? '#18794e' : '#946200',
    borderRadius: 20, padding: '5px 9px', fontSize: 11, fontWeight: 800,
  };
}
