'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';
import AdminSidebar from '@/components/admin/AdminSidebar';

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type BlogAuthor = {
  id: string;
  full_name: string | null;
  email: string | null;
  author_status: string | null;
};

type NotificationType =
  | 'announcement'
  | 'course'
  | 'mock_test'
  | 'study_material'
  | 'career_update'
  | 'account';

const notificationCategories: { value: NotificationType; label: string }[] = [
  { value: 'announcement', label: 'General announcement' },
  { value: 'course', label: 'Course update' },
  { value: 'mock_test', label: 'Mock test update' },
  { value: 'study_material', label: 'Study material' },
  { value: 'career_update', label: 'Career update' },
  { value: 'account', label: 'Account notice' },
];

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [blogAuthors, setBlogAuthors] = useState<BlogAuthor[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<'students' | 'authors' | 'both'>('students');
  const [recipientMode, setRecipientMode] = useState<'all' | 'selected'>('all');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationType>('announcement');
  const [linkUrl, setLinkUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function initialise() {
      if (!supabase) {
        router.replace('/admin/login');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace('/admin/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin') {
        router.replace('/student/dashboard');
        return;
      }

      const [studentResult, authorProfilesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'student')
          .order('full_name', { ascending: true }),
        supabase
          .from('author_profiles')
          .select('user_id, full_name, status')
          .not('user_id', 'is', null)
          .order('full_name', { ascending: true }),
      ]);

      if (studentResult.error) {
        if (active) setErrorMessage('Student list could not be loaded: ' + studentResult.error.message);
      }

      if (authorProfilesResult.error) {
        if (active) setErrorMessage('Blog author list could not be loaded: ' + authorProfilesResult.error.message);
      }

      const authorRows = (authorProfilesResult.data || []) as {
        user_id: string;
        full_name: string | null;
        status: string | null;
      }[];

      const authorUserIds = Array.from(new Set(authorRows.map(row => row.user_id).filter(Boolean)));
      const authorProfileById = new Map<string, Student>();

      if (authorUserIds.length) {
        const { data: authorAccounts, error: authorAccountsError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', authorUserIds);

        if (authorAccountsError) {
          if (active) setErrorMessage('Blog author account details could not be loaded: ' + authorAccountsError.message);
        } else {
          (authorAccounts || []).forEach(account => authorProfileById.set(account.id, account as Student));
        }
      }

      const loadedAuthors: BlogAuthor[] = authorRows.map(author => {
        const account = authorProfileById.get(author.user_id);
        return {
          id: author.user_id,
          full_name: author.full_name || account?.full_name || 'Blog Author',
          email: account?.email || null,
          author_status: author.status,
        };
      });

      // Accounts linked to an author profile are listed in the Blog Authors
      // section, not duplicated in the ordinary Students list.
      const authorIdSet = new Set(authorUserIds);
      const loadedStudents = ((studentResult.data || []) as Student[])
        .filter(student => !authorIdSet.has(student.id));

      if (!active) return;
      setStudents(loadedStudents);
      setBlogAuthors(loadedAuthors);
      setLoading(false);
    }

    initialise();
    return () => {
      active = false;
    };
  }, [router]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(student =>
      (student.full_name || '').toLowerCase().includes(term) ||
      (student.email || '').toLowerCase().includes(term)
    );
  }, [students, search]);

  const filteredAuthors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return blogAuthors;
    return blogAuthors.filter(author =>
      (author.full_name || '').toLowerCase().includes(term) ||
      (author.email || '').toLowerCase().includes(term)
    );
  }, [blogAuthors, search]);

  function toggleStudent(id: string) {
    setSelectedStudentIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  }

  function toggleAuthor(id: string) {
    setSelectedAuthorIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  }

  async function sendNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || cleanTitle.length > 180) {
      setErrorMessage('Enter a title between 1 and 180 characters.');
      return;
    }
    if (!cleanMessage || cleanMessage.length > 4000) {
      setErrorMessage('Enter a message between 1 and 4,000 characters.');
      return;
    }
    if (linkUrl.trim()) {
      try {
        const parsed = new URL(linkUrl.trim(), window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid URL');
      } catch {
        setErrorMessage('Enter a valid http(s) link, or leave the link field empty.');
        return;
      }
    }

    const useStudents = audience === 'students' || audience === 'both';
    const useAuthors = audience === 'authors' || audience === 'both';

    const recipientIds = [
      ...(useStudents
        ? recipientMode === 'all' ? students.map(student => student.id) : selectedStudentIds
        : []),
      ...(useAuthors
        ? recipientMode === 'all' ? blogAuthors.map(author => author.id) : selectedAuthorIds
        : []),
    ];
    // A user linked to both roles can never receive the same notice twice.
    const recipients = Array.from(new Set(recipientIds));

    if (!recipients.length) {
      setErrorMessage('Select at least one student or blog author to receive this notification.');
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setErrorMessage('Your administrator session has expired. Please sign in again.');
      router.replace('/admin/login');
      return;
    }

    setSending(true);
    setErrorMessage('');
    setNotice('');

    const rows = recipients.map(studentId => ({
      student_id: studentId,
      title: cleanTitle,
      message: cleanMessage,
      notification_type: category,
      link_url: linkUrl.trim() || null,
      created_by: authData.user.id,
    }));

    let sent = 0;
    for (let start = 0; start < rows.length; start += 500) {
      const { error } = await supabase
        .from('student_notifications')
        .insert(rows.slice(start, start + 500));

      if (error) {
        setErrorMessage(
          sent > 0
            ? 'The announcement was delivered to ' + sent + ' student(s), but a later batch failed: ' + error.message
            : 'The announcement could not be sent: ' + error.message
        );
        break;
      }
      sent += Math.min(500, rows.length - start);
    }

    if (sent === rows.length) {
      setNotice('Notification sent successfully to ' + sent + ' student(s).');
      setTitle('');
      setMessage('');
      setLinkUrl('');
      setSelectedStudentIds([]);
      setSelectedAuthorIds([]);
      setRecipientMode('all');
      setAudience('students');
    }

    setSending(false);
  }

  if (loading) {
    return <main className="admin-loading">Checking administrator access...</main>;
  }

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / STUDENT MANAGEMENT</div>
            <h1>Student Notifications</h1>
          </div>
          <div className="admin-user">
            <span className="admin-avatar">✉</span>
            <span><b>Administrator</b><small>Announcement centre</small></span>
          </div>
        </header>

        <div className="admin-welcome">
          <div>
            <h2>Send a platform update</h2>
            <p>Share important announcements with every student or a selected group.</p>
          </div>
          <span className="admin-secure">
            {students.length} student(s) · {blogAuthors.length} blog author(s)
          </span>
        </div>

        {notice && <div className="admin-notice admin-notification-success" role="status">{notice}</div>}
        {errorMessage && <div className="admin-notification-error" role="alert">{errorMessage}</div>}

        <div className="admin-notification-layout">
          <form className="admin-notification-form" onSubmit={sendNotification}>
            <div className="admin-notification-field">
              <label htmlFor="notification-title">Notification title</label>
              <input
                id="notification-title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                maxLength={180}
                required
                placeholder="e.g. New mock test is available"
              />
              <small>{title.length}/180 characters</small>
            </div>

            <div className="admin-notification-field">
              <label htmlFor="notification-message">Message</label>
              <textarea
                id="notification-message"
                value={message}
                onChange={event => setMessage(event.target.value)}
                maxLength={4000}
                rows={6}
                required
                placeholder="Write the details students need to know..."
              />
              <small>{message.length}/4,000 characters</small>
            </div>

            <div className="admin-notification-field">
              <label htmlFor="notification-category">Notification category</label>
              <select
                id="notification-category"
                value={category}
                onChange={event => setCategory(event.target.value as NotificationType)}
              >
                {notificationCategories.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="admin-notification-field">
              <label htmlFor="notification-link">Related link (optional)</label>
              <input
                id="notification-link"
                value={linkUrl}
                onChange={event => setLinkUrl(event.target.value)}
                placeholder="/mock-tests or https://..."
              />
            </div>

            <div className="admin-notification-actions">
              <button className="admin-primary" type="submit" disabled={sending || students.length === 0}>
                {sending ? 'Sending notification...' : 'Send notification'}
              </button>
              <span>Each recipient receives a private notification in their dashboard.</span>
            </div>
          </form>

          <aside className="admin-notification-recipients">
            <h2>Recipients</h2>
            <p>Choose the account group first. Student accounts and blog-author accounts are shown separately.</p>

            <div className="admin-notification-group-options">
              <label className="admin-notification-radio">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === 'students'}
                  onChange={() => setAudience('students')}
                />
                <span><b>1. Students</b><small>{students.length} student account(s)</small></span>
              </label>

              <label className="admin-notification-radio">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === 'authors'}
                  onChange={() => setAudience('authors')}
                />
                <span><b>2. Blog Authors</b><small>{blogAuthors.length} author account(s)</small></span>
              </label>

              <label className="admin-notification-radio">
                <input
                  type="radio"
                  name="audience"
                  checked={audience === 'both'}
                  onChange={() => setAudience('both')}
                />
                <span><b>Both groups</b><small>Send to students and blog authors (without duplicate accounts)</small></span>
              </label>
            </div>

            <div className="admin-notification-recipient-mode">
              <strong>Delivery selection</strong>
              <label className="admin-notification-radio">
                <input
                  type="radio"
                  name="recipient-mode"
                  checked={recipientMode === 'all'}
                  onChange={() => setRecipientMode('all')}
                />
                <span><b>All in chosen group(s)</b><small>
                  {(audience === 'students' || audience === 'both' ? students.length : 0) +
                    (audience === 'authors' || audience === 'both' ? blogAuthors.length : 0)} recipient(s)
                </small></span>
              </label>
              <label className="admin-notification-radio">
                <input
                  type="radio"
                  name="recipient-mode"
                  checked={recipientMode === 'selected'}
                  onChange={() => setRecipientMode('selected')}
                />
                <span><b>Select specific people</b><small>
                  {(audience === 'students' || audience === 'both' ? selectedStudentIds.length : 0) +
                    (audience === 'authors' || audience === 'both' ? selectedAuthorIds.length : 0)} selected
                </small></span>
              </label>
            </div>

            {recipientMode === 'selected' && (
              <>
                <input
                  className="admin-notification-search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search recipient name or email"
                />

                {(audience === 'students' || audience === 'both') && (
                  <section className="admin-notification-group">
                    <div className="admin-notification-group-heading">
                      <h3>1. Students</h3>
                      <span>{selectedStudentIds.length} selected</span>
                    </div>
                    <div className="admin-notification-student-list">
                      {filteredStudents.map(student => (
                        <label key={student.id} className="admin-notification-student">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(student.id)}
                            onChange={() => toggleStudent(student.id)}
                          />
                          <span>
                            <b>{student.full_name || 'Student'}</b>
                            <small>{student.email || 'Email not available'}</small>
                          </span>
                        </label>
                      ))}
                      {filteredStudents.length === 0 && <p>No student accounts match this search.</p>}
                    </div>
                  </section>
                )}

                {(audience === 'authors' || audience === 'both') && (
                  <section className="admin-notification-group">
                    <div className="admin-notification-group-heading">
                      <h3>2. Blog Authors</h3>
                      <span>{selectedAuthorIds.length} selected</span>
                    </div>
                    <div className="admin-notification-student-list">
                      {filteredAuthors.map(author => (
                        <label key={author.id} className="admin-notification-student">
                          <input
                            type="checkbox"
                            checked={selectedAuthorIds.includes(author.id)}
                            onChange={() => toggleAuthor(author.id)}
                          />
                          <span>
                            <b>{author.full_name || 'Blog Author'}</b>
                            <small>{author.email || 'Email not available'} · {author.author_status || 'Author account'}</small>
                          </span>
                        </label>
                      ))}
                      {filteredAuthors.length === 0 && <p>No blog-author accounts match this search.</p>}
                    </div>
                  </section>
                )}
              </>
            )}
          </aside>
        </div>

        <footer className="admin-footer">EduAxis India · Learn. Prepare. Progress.</footer>
      </section>

      <style jsx>{`
        .admin-notification-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);gap:18px;align-items:start}
        .admin-notification-form,.admin-notification-recipients{background:#fff;border:1px solid #e2eaee;border-radius:13px;padding:22px}
        .admin-notification-field{display:flex;flex-direction:column;gap:7px;margin-bottom:17px}
        .admin-notification-field label,.admin-notification-recipients h2{font-size:13px;font-weight:800;color:#284257}
        .admin-notification-field input,.admin-notification-field textarea,.admin-notification-field select,.admin-notification-search{width:100%;box-sizing:border-box;border:1px solid #d8e3e7;border-radius:8px;padding:11px 12px;font:inherit;font-size:13px;color:#20384b;background:#fff}
        .admin-notification-field textarea{resize:vertical;line-height:1.6}
        .admin-notification-field small{color:#82929c;font-size:10px}
        .admin-notification-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
        .admin-notification-actions .admin-primary{margin:0;cursor:pointer}
        .admin-notification-actions .admin-primary:disabled{opacity:.6;cursor:wait}
        .admin-notification-actions span{color:#82929c;font-size:10px;line-height:1.5}
        .admin-notification-recipients h2{margin:0 0 7px;font-size:16px;color:#102b46}
        .admin-notification-recipients>p{margin:0 0 16px;color:#718392;font-size:11px;line-height:1.6}
        .admin-notification-radio{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e4ecef;border-radius:8px;margin-bottom:9px;cursor:pointer}
        .admin-notification-group-options{padding-bottom:12px;border-bottom:1px solid #edf1f2;margin-bottom:15px}
        .admin-notification-recipient-mode>strong{display:block;margin:0 0 9px;color:#284257;font-size:12px}
        .admin-notification-group{margin-top:16px;border-top:1px solid #e4ecef;padding-top:13px}
        .admin-notification-group-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
        .admin-notification-group-heading h3{margin:0;color:#102b46;font-size:13px}
        .admin-notification-group-heading span{color:#129b98;font-size:10px;font-weight:800}
        .admin-notification-radio input,.admin-notification-student input{accent-color:#129b98}
        .admin-notification-radio span,.admin-notification-radio small,.admin-notification-student span,.admin-notification-student small{display:block}
        .admin-notification-radio b,.admin-notification-student b{font-size:12px;color:#29475c}
        .admin-notification-radio small,.admin-notification-student small{margin-top:3px;color:#82929c;font-size:10px;overflow-wrap:anywhere}
        .admin-notification-search{margin:8px 0}
        .admin-notification-student-list{max-height:330px;overflow:auto;border-top:1px solid #edf1f2}
        .admin-notification-student{display:flex;align-items:center;gap:9px;padding:10px 2px;border-bottom:1px solid #edf1f2;cursor:pointer}
        .admin-notification-error{margin:0 0 16px;padding:12px 14px;border:1px solid #efcaca;border-radius:8px;background:#fff2f2;color:#a32c2c;font-size:12px;line-height:1.5}
        .admin-notification-success{margin-bottom:16px}
        @media(max-width:950px){.admin-notification-layout{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
