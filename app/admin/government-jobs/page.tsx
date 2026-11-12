'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Job = {
  id: number;
  title: string;
  organization: string | null;
  post_name: string | null;
  state: string | null;
  vacancies: string | number | null;
  qualification: string | null;
  application_fee: string | null;
  notification_url: string | null;
  apply_url: string | null;
  last_date: string | null;
  status: string;
  job_category: string | null;
  age_limit: string | null;
  application_start_date: string | null;
  official_website: string | null;
  last_verified_at: string | null;
  created_at: string;
};

const categories = [
  'Bihar Government Jobs',
  'Central Government Jobs',
  'Teaching Jobs',
  'Banking Jobs',
  'Railway Jobs',
  'Defence Jobs',
  'Other State Government Jobs',
  'Other Government Jobs',
];

const initialForm = {
  title: '',
  organization: '',
  postName: '',
  state: 'Bihar',
  category: 'Bihar Government Jobs',
  vacancies: '',
  qualification: '',
  ageLimit: '',
  applicationFee: '',
  startDate: '',
  lastDate: '',
  notificationUrl: '',
  applyUrl: '',
  officialWebsite: '',
  status: 'draft',
};

export default function GovernmentJobsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState(initialForm.title);
  const [organization, setOrganization] = useState(initialForm.organization);
  const [postName, setPostName] = useState(initialForm.postName);
  const [stateName, setStateName] = useState(initialForm.state);
  const [category, setCategory] = useState(initialForm.category);
  const [vacancies, setVacancies] = useState(initialForm.vacancies);
  const [qualification, setQualification] = useState(initialForm.qualification);
  const [ageLimit, setAgeLimit] = useState(initialForm.ageLimit);
  const [applicationFee, setApplicationFee] = useState(initialForm.applicationFee);
  const [startDate, setStartDate] = useState(initialForm.startDate);
  const [lastDate, setLastDate] = useState(initialForm.lastDate);
  const [notificationUrl, setNotificationUrl] = useState(initialForm.notificationUrl);
  const [applyUrl, setApplyUrl] = useState(initialForm.applyUrl);
  const [officialWebsite, setOfficialWebsite] = useState(initialForm.officialWebsite);
  const [status, setStatus] = useState(initialForm.status);

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

      await loadJobs();
      if (active) setLoading(false);
    }

    checkAdmin();
    return () => {
      active = false;
    };
  }, [router]);

  async function loadJobs() {
    const client = supabase;
    if (!client) return;

    const { data, error } = await client
      .from('government_jobs')
      .select('id,title,organization,post_name,state,vacancies,qualification,application_fee,notification_url,apply_url,last_date,status,job_category,age_limit,application_start_date,official_website,last_verified_at,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Could not load government jobs: ' + error.message);
      return;
    }

    setJobs((data || []) as Job[]);
  }

  function resetForm() {
    setTitle(initialForm.title);
    setOrganization(initialForm.organization);
    setPostName(initialForm.postName);
    setStateName(initialForm.state);
    setCategory(initialForm.category);
    setVacancies(initialForm.vacancies);
    setQualification(initialForm.qualification);
    setAgeLimit(initialForm.ageLimit);
    setApplicationFee(initialForm.applicationFee);
    setStartDate(initialForm.startDate);
    setLastDate(initialForm.lastDate);
    setNotificationUrl(initialForm.notificationUrl);
    setApplyUrl(initialForm.applyUrl);
    setOfficialWebsite(initialForm.officialWebsite);
    setStatus(initialForm.status);
    setEditingId(null);
  }

  function editJob(job: Job) {
    setMessage('');
    setErrorMessage('');
    setEditingId(job.id);
    setTitle(job.title || '');
    setOrganization(job.organization || '');
    setPostName(job.post_name || '');
    setStateName(job.state || '');
    setCategory(job.job_category || 'Other Government Jobs');
    setVacancies(job.vacancies == null ? '' : String(job.vacancies));
    setQualification(job.qualification || '');
    setAgeLimit(job.age_limit || '');
    setApplicationFee(job.application_fee || '');
    setStartDate(job.application_start_date || '');
    setLastDate(job.last_date || '');
    setNotificationUrl(job.notification_url || '');
    setApplyUrl(job.apply_url || '');
    setOfficialWebsite(job.official_website || '');
    setStatus(job.status || 'draft');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validOptionalUrl(value: string) {
    if (!value.trim()) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');

    const client = supabase;
    if (!client) {
      setErrorMessage('Supabase connection is not configured.');
      return;
    }

    if (!title.trim() || !organization.trim()) {
      setErrorMessage('Please enter the job title and recruiting organisation.');
      return;
    }

    if (![notificationUrl, applyUrl, officialWebsite].every(validOptionalUrl)) {
      setErrorMessage('Please enter valid website links beginning with https:// or http://.');
      return;
    }

    setBusy(true);

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const values = {
        title: title.trim(),
        organization: organization.trim(),
        post_name: postName.trim() || null,
        state: stateName.trim() || null,
        job_category: category,
        vacancies: vacancies.trim() || null,
        qualification: qualification.trim() || null,
        age_limit: ageLimit.trim() || null,
        application_fee: applicationFee.trim() || null,
        application_start_date: startDate || null,
        last_date: lastDate || null,
        notification_url: notificationUrl.trim() || null,
        apply_url: applyUrl.trim() || null,
        official_website: officialWebsite.trim() || null,
        last_verified_at: new Date().toISOString(),
        status,
      };

      if (editingId !== null) {
        const { error } = await client
          .from('government_jobs')
          .update(values)
          .eq('id', editingId);
        if (error) throw error;
        setMessage('Government job updated successfully.');
      } else {
        const { error } = await client
          .from('government_jobs')
          .insert({ ...values, created_by: user.id });
        if (error) throw error;
        setMessage('Government job added successfully.');
      }

      resetForm();
      await loadJobs();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong while saving.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(job: Job, nextStatus: string) {
    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('government_jobs')
      .update({ status: nextStatus, last_verified_at: new Date().toISOString() })
      .eq('id', job.id);

    if (error) {
      setErrorMessage('Could not update job status: ' + error.message);
    } else {
      setMessage(
        nextStatus === 'published' ? 'Job published successfully.' :
        nextStatus === 'closed' ? 'Job marked as closed.' :
        'Job moved to Draft.'
      );
      await loadJobs();
    }
    setBusy(false);
  }

  async function deleteJob(job: Job) {
    if (!window.confirm(`Delete "${job.title}" permanently?`)) return;

    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('government_jobs')
      .delete()
      .eq('id', job.id);

    if (error) {
      setErrorMessage('Could not delete this job: ' + error.message);
    } else {
      setMessage('Government job deleted successfully.');
      if (editingId === job.id) resetForm();
      await loadJobs();
    }
    setBusy(false);
  }

  if (loading) {
    return <main className="admin-loading">Checking administrator access…</main>;
  }

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '1px solid #d7e0e8',
    borderRadius: '8px',
    fontSize: '15px',
    background: '#fff',
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600 as const,
    marginBottom: '7px',
    color: '#17324d',
  };

  const actionStyle = {
    border: 0,
    borderRadius: 6,
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 600 as const,
    margin: '2px',
  };

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span className="admin-brand-mark">E</span>
          <span>EduAxis <b>India</b><small>ADMINISTRATION</small></span>
        </a>

        <div className="admin-side-label">WORKSPACE</div>
        <a className="admin-side-link" href="/admin/dashboard">▦ &nbsp; Dashboard</a>

        <div className="admin-side-label">CONTENT MANAGEMENT</div>
        <a className="admin-side-link" href="/admin/study-materials">▤ &nbsp; Study Materials</a>
        <a className="admin-side-link active" href="/admin/government-jobs">▤ &nbsp; Government Jobs</a>
        <a className="admin-side-link" href="/admin/dashboard">▤ &nbsp; Online Courses</a>
        <a className="admin-side-link" href="/admin/dashboard">▤ &nbsp; Mock Tests</a>
        <a className="admin-side-link" href="/admin/dashboard">▤ &nbsp; Education News</a>
        <div className="admin-sidebar-bottom">
          <a href="/">← View public website</a>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN</div>
            <h1>Government Jobs</h1>
          </div>
          <a className="admin-logout" href="/admin/dashboard">Back to Dashboard</a>
        </header>

        <div style={{ padding: '25px 0' }}>
          <h2>{editingId !== null ? 'Edit government job' : 'Add a government job'}</h2>
          <p style={{ color: '#647b91' }}>
            Add verified recruitment information and direct students to official notification and application websites.
          </p>

          {message && (
            <div style={{ padding: 12, margin: '15px 0', background: '#e5f8ef', color: '#087443', borderRadius: 8 }}>
              {message}
            </div>
          )}
          {errorMessage && (
            <div style={{ padding: 12, margin: '15px 0', background: '#fff0f0', color: '#bd2525', borderRadius: 8 }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{
            background: '#fff',
            border: '1px solid #dce5ec',
            borderRadius: 14,
            padding: 24,
            display: 'grid',
            gap: 18,
            maxWidth: 900,
          }}>
            <div>
              <label style={labelStyle} htmlFor="job-title">Job title *</label>
              <input id="job-title" style={inputStyle} required value={title}
                onChange={e => setTitle(e.target.value)} placeholder="e.g. BPSC Teacher Recruitment" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-organization">Recruiting organisation *</label>
              <input id="job-organization" style={inputStyle} required value={organization}
                onChange={e => setOrganization(e.target.value)} placeholder="e.g. Bihar Public Service Commission" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-post">Post name</label>
              <input id="job-post" style={inputStyle} value={postName}
                onChange={e => setPostName(e.target.value)} placeholder="e.g. School Teacher" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-category">Job category *</label>
              <select id="job-category" style={inputStyle} value={category}
                onChange={e => setCategory(e.target.value)}>
                {categories.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-state">State / jurisdiction</label>
              <input id="job-state" style={inputStyle} value={stateName}
                onChange={e => setStateName(e.target.value)} placeholder="e.g. Bihar, All India, Uttar Pradesh" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-vacancies">Total vacancies</label>
              <input id="job-vacancies" style={inputStyle} value={vacancies}
                onChange={e => setVacancies(e.target.value)} placeholder="e.g. 2500 or As per notification" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-qualification">Educational qualification</label>
              <textarea id="job-qualification" style={{ ...inputStyle, minHeight: 85 }}
                value={qualification} onChange={e => setQualification(e.target.value)}
                placeholder="Mention qualification exactly as stated in the official notification." />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-age">Age limit</label>
              <input id="job-age" style={inputStyle} value={ageLimit}
                onChange={e => setAgeLimit(e.target.value)} placeholder="e.g. 18–37 years; relaxations as per rules" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-fee">Application fee</label>
              <input id="job-fee" style={inputStyle} value={applicationFee}
                onChange={e => setApplicationFee(e.target.value)} placeholder="e.g. ₹100; category-wise fee as notified" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-start">Application start date</label>
              <input id="job-start" type="date" style={inputStyle} value={startDate}
                onChange={e => setStartDate(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-last">Last date to apply</label>
              <input id="job-last" type="date" style={inputStyle} value={lastDate}
                onChange={e => setLastDate(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-notification">Official notification URL</label>
              <input id="job-notification" type="url" style={inputStyle} value={notificationUrl}
                onChange={e => setNotificationUrl(e.target.value)} placeholder="https://official-government-site.gov.in/notification" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-apply">Official application URL</label>
              <input id="job-apply" type="url" style={inputStyle} value={applyUrl}
                onChange={e => setApplyUrl(e.target.value)} placeholder="https://official-application-portal.gov.in" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-website">Official organisation website</label>
              <input id="job-website" type="url" style={inputStyle} value={officialWebsite}
                onChange={e => setOfficialWebsite(e.target.value)} placeholder="https://official-organisation.gov.in" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="job-status">Publishing status</label>
              <select id="job-status" style={inputStyle} value={status}
                onChange={e => setStatus(e.target.value)}>
                <option value="draft">Save as Draft</option>
                <option value="published">Publish</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" disabled={busy} style={{
                background: '#102d49',
                color: '#fff',
                border: 0,
                padding: '15px 20px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
              }}>
                {busy ? 'Please wait…' : editingId !== null ? 'Save Changes' : 'Save Government Job'}
              </button>
              {editingId !== null && (
                <button type="button" disabled={busy} onClick={resetForm} style={{
                  background: '#e9eef3',
                  color: '#17324d',
                  border: 0,
                  padding: '15px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <section style={{ marginTop: 35, maxWidth: 1150 }}>
            <h2>Government job notifications</h2>
            {jobs.length === 0 ? (
              <p style={{ color: '#647b91' }}>No government jobs have been added yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dce5ec', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 950 }}>
                  <thead>
                    <tr>
                      {['Job title', 'Organisation', 'Category', 'Last date', 'Status', 'Actions'].map(item => (
                        <th key={item} style={{ padding: 12, borderBottom: '1px solid #dce5ec' }}>{item}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job.id}>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{job.title}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{job.organization || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{job.job_category || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{job.last_date || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{job.status}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5', whiteSpace: 'nowrap' }}>
                          <button type="button" disabled={busy} onClick={() => editJob(job)}
                            style={{ ...actionStyle, background: '#e8f1fb', color: '#174a7c' }}>Edit</button>
                          {job.status !== 'published' && (
                            <button type="button" disabled={busy} onClick={() => changeStatus(job, 'published')}
                              style={{ ...actionStyle, background: '#e5f8ef', color: '#087443' }}>Publish</button>
                          )}
                          {job.status === 'published' && (
                            <button type="button" disabled={busy} onClick={() => changeStatus(job, 'draft')}
                              style={{ ...actionStyle, background: '#fff3df', color: '#8a5700' }}>Unpublish</button>
                          )}
                          {job.status !== 'closed' && (
                            <button type="button" disabled={busy} onClick={() => changeStatus(job, 'closed')}
                              style={{ ...actionStyle, background: '#f0edf8', color: '#59428a' }}>Close</button>
                          )}
                          <button type="button" disabled={busy} onClick={() => deleteJob(job)}
                            style={{ ...actionStyle, background: '#fff0f0', color: '#bd2525' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
