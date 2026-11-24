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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

      const loadedStudents: Student[] = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'student')
          .order('full_name', { ascending: true })
          .range(start, start + 499);

        if (error) {
          if (active) setErrorMessage('Student list could not be loaded: ' + error.message);
          break;
        }

        const page = (data || []) as Student[];
        loadedStudents.push(...page);
        if (page.length < 500) break;
      }

      if (!active) return;
      setStudents(loadedStudents);
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

  function toggleStudent(id: string) {
    setSelectedIds(current =>
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

    const recipients = recipientMode === 'all'
      ? students.map(student => student.id)
      : selectedIds;

    if (!recipients.length) {
      setErrorMessage('Select at least one student to receive this notification.');
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
      setSelectedIds([]);
      setRecipientMode('all');
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
          <span className="admin-secure">{students.length} student account(s)</span>
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
            <p>Choose who should receive this announcement.</p>

            <label className="admin-notification-radio">
              <input
                type="radio"
                name="recipient-mode"
                checked={recipientMode === 'all'}
                onChange={() => setRecipientMode('all')}
              />
              <span><b>All students</b><small>{students.length} recipient(s)</small></span>
            </label>

            <label className="admin-notification-radio">
              <input
                type="radio"
                name="recipient-mode"
                checked={recipientMode === 'selected'}
                onChange={() => setRecipientMode('selected')}
              />
              <span><b>Selected students</b><small>{selectedIds.length} selected</small></span>
            </label>

            {recipientMode === 'selected' && (
              <>
                <input
                  className="admin-notification-search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search students"
                />
                <div className="admin-notification-student-list">
                  {filteredStudents.map(student => (
                    <label key={student.id} className="admin-notification-student">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                      />
                      <span>
                        <b>{student.full_name || 'Student'}</b>
                        <small>{student.email || student.id}</small>
                      </span>
                    </label>
                  ))}
                  {filteredStudents.length === 0 && <p>No matching students found.</p>}
                </div>
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
