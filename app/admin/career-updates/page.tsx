
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Job = {
  id: string;
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

  post_details: string | null;
  vacancy_details: string | null;
  age_limit_details: string | null;
  educational_qualification: string | null;
  eligibility_details: string | null;
  application_fee: string | null;
  application_start_date: string | null;
  important_dates: string | null;
  apply_url: string | null;
  admit_card_url: string | null;
  result_url: string | null;

  status: string;
  created_at: string;
};

const careerCategories = [
  { value: 'jobs', label: 'Latest Government Jobs' },
  { value: 'recruitment_notice', label: 'Recruitment Notices & Updates' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'result_answer_key', label: 'Results & Answer Keys' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'admission', label: 'Admission' },
  { value: 'other_update', label: 'Other Updates' },
];

const jobCategories = [
  'Bihar Government Jobs',
  'Central Government Jobs',
  'Teaching Jobs',
  'Banking Jobs',
  'Railway Jobs',
  'Defence Jobs',
  'Other State Government Jobs',
  'Other Government Jobs',
];

const emptyJob = {
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


const emptyUpdate = {
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

  post_details: '',
  vacancy_details: '',
  age_limit_details: '',
  educational_qualification: '',
  eligibility_details: '',
  application_fee: '',
  application_start_date: '',
  important_dates: '',
  apply_url: '',
  admit_card_url: '',
  result_url: '',

  status: 'draft',
};


type Section =
  | 'jobs'
  | 'recruitment_notice'
  | 'admit_card'
  | 'result_answer_key'
  | 'syllabus'
  | 'admission'
  | 'other_update';

const sections: { value: Section; label: string }[] = [
  { value: 'jobs', label: 'Latest Government Jobs' },
  { value: 'recruitment_notice', label: 'Recruitment Notices' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'result_answer_key', label: 'Results & Answer Keys' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'admission', label: 'Admission' },
  { value: 'other_update', label: 'Other Updates' },
];

export default function CareerManagementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [updates, setUpdates] = useState<CareerUpdate[]>([]);

  const [activeSection, setActiveSection] = useState<Section>('jobs');

  const [jobForm, setJobForm] = useState(emptyJob);
  const [updateForm, setUpdateForm] = useState(emptyUpdate);

  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);

  const [jobFilter, setJobFilter] = useState('all');
  const [updateFilter, setUpdateFilter] = useState('all');

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

      await Promise.all([loadJobs(), loadUpdates()]);

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
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Could not load government jobs: ' + error.message);
      return;
    }

    setJobs((data || []) as Job[]);
  }

  async function loadUpdates() {
    const client = supabase;
    if (!client) return;

    const { data, error } = await client
      .from('career_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Could not load career updates: ' + error.message);
      return;
    }

    setUpdates((data || []) as CareerUpdate[]);
  }

  function showMessage(text: string) {
    setMessage(text);
    setErrorMessage('');
  }

  function showError(text: string) {
    setErrorMessage(text);
    setMessage('');
  }

  function resetJobForm() {
    setJobForm(emptyJob);
    setEditingJobId(null);
  }

  function resetUpdateForm() {
    setUpdateForm(emptyUpdate);
    setEditingUpdateId(null);
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

  function editJob(job: Job) {
    setJobForm({
      title: job.title || '',
      organization: job.organization || '',
      postName: job.post_name || '',
      state: job.state || '',
      category: job.job_category || 'Other Government Jobs',
      vacancies: job.vacancies == null ? '' : String(job.vacancies),
      qualification: job.qualification || '',
      ageLimit: job.age_limit || '',
      applicationFee: job.application_fee || '',
      startDate: job.application_start_date || '',
      lastDate: job.last_date || '',
      notificationUrl: job.notification_url || '',
      applyUrl: job.apply_url || '',
      officialWebsite: job.official_website || '',
      status: job.status || 'draft',
    });

    setEditingJobId(job.id);
    setActiveSection('jobs');
    setMessage('');
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editUpdate(item: CareerUpdate) {
   
setUpdateForm({
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

  post_details: item.post_details || '',
  vacancy_details: item.vacancy_details || '',
  age_limit_details: item.age_limit_details || '',
  educational_qualification: item.educational_qualification || '',
  eligibility_details: item.eligibility_details || '',
  application_fee: item.application_fee || '',
  application_start_date: item.application_start_date || '',
  important_dates: item.important_dates || '',
  apply_url: item.apply_url || '',
  admit_card_url: item.admit_card_url || '',
  result_url: item.result_url || '',

  status: item.status || 'draft',
    });

    setEditingUpdateId(item.id);
    setActiveSection(item.category as Section);
    setMessage('');
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;
    if (!client) return;

    if (!jobForm.title.trim() || !jobForm.organization.trim()) {
      showError('Please enter the job title and recruiting organisation.');
      return;
    }

    if (
      ![
        jobForm.notificationUrl,
        jobForm.applyUrl,
        jobForm.officialWebsite,
      ].every(validOptionalUrl)
    ) {
      showError('Please enter valid official website links.');
      return;
    }

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();

      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const values = {
        title: jobForm.title.trim(),
        organization: jobForm.organization.trim(),
        post_name: jobForm.postName.trim() || null,
        state: jobForm.state.trim() || null,
        job_category: jobForm.category,
        vacancies: jobForm.vacancies.trim() || null,
        qualification: jobForm.qualification.trim() || null,
        age_limit: jobForm.ageLimit.trim() || null,
        application_fee: jobForm.applicationFee.trim() || null,
        application_start_date: jobForm.startDate || null,
        last_date: jobForm.lastDate || null,
        notification_url: jobForm.notificationUrl.trim() || null,
        apply_url: jobForm.applyUrl.trim() || null,
        official_website: jobForm.officialWebsite.trim() || null,
        last_verified_at: new Date().toISOString(),
        status: jobForm.status,
      };

      if (editingJobId) {
        const { error } = await client
          .from('government_jobs')
          .update(values)
          .eq('id', editingJobId);

        if (error) throw error;

        showMessage('Government job updated successfully.');
      } else {
        const { error } = await client
          .from('government_jobs')
          .insert({
            ...values,
            created_by: user.id,
          });

        if (error) throw error;

        showMessage('Government job added successfully.');
      }

      resetJobForm();
      await loadJobs();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving the job.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = supabase;
    if (!client) return;

    if (!updateForm.title.trim()) {
      showError('Please enter the title.');
      return;
    }

    if (
  ![
    updateForm.official_url,
    updateForm.download_url,
    updateForm.apply_url,
    updateForm.admit_card_url,
    updateForm.result_url,
  ].every(validOptionalUrl)
) {
  showError('Please enter valid website links.');
  return;
}

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    try {
      const { data: { user } } = await client.auth.getUser();

      
const values = {
  category: updateForm.category,
  title: updateForm.title.trim(),
  organization: updateForm.organization.trim() || null,
  exam_name: updateForm.exam_name.trim() || null,
  state: updateForm.state.trim() || 'All India',
  description: updateForm.description.trim() || null,
  notice_date: updateForm.notice_date || null,
  event_date: updateForm.event_date || null,
  last_date: updateForm.last_date || null,
  official_url: updateForm.official_url.trim() || null,
  download_url: updateForm.download_url.trim() || null,

  post_details: updateForm.post_details.trim() || null,
  vacancy_details: updateForm.vacancy_details.trim() || null,
  age_limit_details: updateForm.age_limit_details.trim() || null,
  educational_qualification: updateForm.educational_qualification.trim() || null,
  eligibility_details: updateForm.eligibility_details.trim() || null,
  application_fee: updateForm.application_fee.trim() || null,
  application_start_date: updateForm.application_start_date || null,
  important_dates: updateForm.important_dates.trim() || null,
  apply_url: updateForm.apply_url.trim() || null,
  admit_card_url: updateForm.admit_card_url.trim() || null,
  result_url: updateForm.result_url.trim() || null,

  status: updateForm.status,
  updated_at: new Date().toISOString(),
};


      if (editingUpdateId) {
        const { error } = await client
          .from('career_updates')
          .update(values)
          .eq('id', editingUpdateId);

        if (error) throw error;

        showMessage('Career update updated successfully.');
      } else {
        const { error } = await client
          .from('career_updates')
          .insert({
            ...values,
            created_by: user?.id || null,
          });

        if (error) throw error;

        showMessage('Career update added successfully.');
      }

      resetUpdateForm();
      await loadUpdates();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving the update.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeJobStatus(job: Job, status: string) {
    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('government_jobs')
      .update({
        status,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) {
      showError('Could not update job status: ' + error.message);
    } else {
      showMessage('Government job status updated successfully.');
      await loadJobs();
    }

    setBusy(false);
  }

  async function changeUpdateStatus(item: CareerUpdate, status: string) {
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
      showError('Could not update career update status: ' + error.message);
    } else {
      showMessage('Career update status changed successfully.');
      await loadUpdates();
    }

    setBusy(false);
  }

  async function deleteJob(job: Job) {
    if (!window.confirm(`Delete "${job.title}" permanently?`)) return;

    const client = supabase;
    if (!client) return;

    setBusy(true);

    const { error } = await client
      .from('government_jobs')
      .delete()
      .eq('id', job.id);

    if (error) {
      showError('Could not delete job: ' + error.message);
    } else {
      showMessage('Government job deleted successfully.');
      if (editingJobId === job.id) resetJobForm();
      await loadJobs();
    }

    setBusy(false);
  }

  async function deleteUpdate(item: CareerUpdate) {
    if (!window.confirm(`Delete "${item.title}" permanently?`)) return;

    const client = supabase;
    if (!client) return;

    setBusy(true);

    const { error } = await client
      .from('career_updates')
      .delete()
      .eq('id', item.id);

    if (error) {
      showError('Could not delete update: ' + error.message);
    } else {
      showMessage('Career update deleted successfully.');
      if (editingUpdateId === item.id) resetUpdateForm();
      await loadUpdates();
    }

    setBusy(false);
  }

  function updateCategoryLabel(value: string) {
    return careerCategories.find(item => item.value === value)?.label || value;
  }

  const visibleJobs = jobs.filter(job =>
    jobFilter === 'all' || job.status === jobFilter
  );

  const visibleUpdates = updates.filter(item =>
    (updateFilter === 'all' || item.category === updateFilter)
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

  const isJobSection = activeSection === 'jobs';

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
        <a className="admin-side-link active" href="/admin/career-updates">
          ▤ &nbsp; Government Jobs & Updates
        </a>
        <a className="admin-side-link" href="/admin/government-jobs/discoveries">
          ↳ &nbsp; Discovered Jobs
        </a>

        <div className="admin-side-label">OTHER</div>
        <a className="admin-side-link" href="/">
          ↗ &nbsp; View Website
        </a>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN</div>
            <h1>Career Management</h1>
            <p>Manage all government jobs and examination updates in one place.</p>
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

          {/* Main section navigation */}
          <section style={{
            background: '#fff',
            padding: '18px',
            borderRadius: '12px',
            border: '1px solid #e5eaf0',
            marginBottom: '22px',
          }}>
            <h2 style={{ marginTop: 0, color: '#17324d' }}>
              Manage Career Categories
            </h2>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '9px',
            }}>
              {sections.map(section => (
                <button
                  key={section.value}
                  type="button"
                  onClick={() => {
                    setActiveSection(section.value);
                    setMessage('');
                    setErrorMessage('');
                  }}
                  style={{
                    border: activeSection === section.value
                      ? '1px solid #126b45'
                      : '1px solid #dce5ed',
                    background: activeSection === section.value
                      ? '#126b45'
                      : '#fff',
                    color: activeSection === section.value
                      ? '#fff'
                      : '#29435b',
                    borderRadius: '7px',
                    padding: '10px 13px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <p style={{
              color: '#64748b',
              fontSize: '12px',
              marginBottom: 0,
            }}>
              Government Jobs use the detailed recruitment form.
              Other categories use the career update form.
            </p>
          </section>

          {/* Government Jobs form */}
          {isJobSection && (
            <>
              <section style={{
                background: '#fff',
                padding: '22px',
                borderRadius: '12px',
                border: '1px solid #e5eaf0',
                marginBottom: '25px',
              }}>
                <h2 style={{ marginTop: 0, color: '#17324d' }}>
                  {editingJobId ? 'Edit Government Job' : 'Add a Government Job'}
                </h2>

                <p style={{ color: '#64748b', fontSize: '13px' }}>
                  Add verified recruitment information. New entries are saved as drafts by default.
                </p>

                <form onSubmit={saveJob}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: '16px',
                  }}>
                    <div>
                      <label style={labelStyle}>Job Title *</label>
                      <input style={inputStyle} required value={jobForm.title}
                        onChange={e => setJobForm({ ...jobForm, title: e.target.value })}
                        placeholder="e.g. BPSC Teacher Recruitment" />
                    </div>

                    <div>
                      <label style={labelStyle}>Recruiting Organisation *</label>
                      <input style={inputStyle} required value={jobForm.organization}
                        onChange={e => setJobForm({ ...jobForm, organization: e.target.value })}
                        placeholder="e.g. Bihar Public Service Commission" />
                    </div>

                    <div>
                      <label style={labelStyle}>Post Name</label>
                      <input style={inputStyle} value={jobForm.postName}
                        onChange={e => setJobForm({ ...jobForm, postName: e.target.value })}
                        placeholder="e.g. School Teacher" />
                    </div>

                    <div>
                      <label style={labelStyle}>Job Category *</label>
                      <select style={inputStyle} value={jobForm.category}
                        onChange={e => setJobForm({ ...jobForm, category: e.target.value })}>
                        {jobCategories.map(item => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>State / Jurisdiction</label>
                      <input style={inputStyle} value={jobForm.state}
                        onChange={e => setJobForm({ ...jobForm, state: e.target.value })}
                        placeholder="Bihar / All India / Uttar Pradesh" />
                    </div>

                    <div>
                      <label style={labelStyle}>Total Vacancies</label>
                      <input style={inputStyle} value={jobForm.vacancies}
                        onChange={e => setJobForm({ ...jobForm, vacancies: e.target.value })}
                        placeholder="e.g. 2500 or As per notification" />
                    </div>

                    <div>
                      <label style={labelStyle}>Age Limit</label>
                      <input style={inputStyle} value={jobForm.ageLimit}
                        onChange={e => setJobForm({ ...jobForm, ageLimit: e.target.value })}
                        placeholder="e.g. 18–37 years" />
                    </div>

                    <div>
                      <label style={labelStyle}>Application Fee</label>
                      <input style={inputStyle} value={jobForm.applicationFee}
                        onChange={e => setJobForm({ ...jobForm, applicationFee: e.target.value })}
                        placeholder="e.g. ₹100; category-wise fee" />
                    </div>

                    <div>
                      <label style={labelStyle}>Application Start Date</label>
                      <input type="date" style={inputStyle} value={jobForm.startDate}
                        onChange={e => setJobForm({ ...jobForm, startDate: e.target.value })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Last Date to Apply</label>
                      <input type="date" style={inputStyle} value={jobForm.lastDate}
                        onChange={e => setJobForm({ ...jobForm, lastDate: e.target.value })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Official Notification URL</label>
                      <input type="url" style={inputStyle} value={jobForm.notificationUrl}
                        onChange={e => setJobForm({ ...jobForm, notificationUrl: e.target.value })}
                        placeholder="https://..." />
                    </div>

                    <div>
                      <label style={labelStyle}>Official Application URL</label>
                      <input type="url" style={inputStyle} value={jobForm.applyUrl}
                        onChange={e => setJobForm({ ...jobForm, applyUrl: e.target.value })}
                        placeholder="https://..." />
                    </div>

                    <div>
                      <label style={labelStyle}>Official Organisation Website</label>
                      <input type="url" style={inputStyle} value={jobForm.officialWebsite}
                        onChange={e => setJobForm({ ...jobForm, officialWebsite: e.target.value })}
                        placeholder="https://..." />
                    </div>

                    <div>
                      <label style={labelStyle}>Publication Status</label>
                      <select style={inputStyle} value={jobForm.status}
                        onChange={e => setJobForm({ ...jobForm, status: e.target.value })}>
                        <option value="draft">Save as Draft</option>
                        <option value="published">Publish</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <label style={labelStyle}>Educational Qualification</label>
                    <textarea style={{ ...inputStyle, minHeight: '85px' }}
                      value={jobForm.qualification}
                      onChange={e => setJobForm({ ...jobForm, qualification: e.target.value })}
                      placeholder="Mention qualification exactly as stated in the official notification." />
                  </div>

                  <div style={{ marginTop: '18px' }}>
                    <button type="submit" disabled={busy} style={{
                      ...buttonStyle,
                      background: '#126b45',
                      color: '#fff',
                      padding: '12px 20px',
                    }}>
                      {busy ? 'Please wait...' : editingJobId ? 'Save Changes' : 'Save Government Job'}
                    </button>

                    {editingJobId && (
                      <button type="button" onClick={resetJobForm} style={{
                        ...buttonStyle,
                        background: '#e9eef4',
                        color: '#17324d',
                        padding: '12px 18px',
                      }}>
                        Cancel Editing
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Government Jobs list */}
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
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <h2 style={{ marginTop: 0, color: '#17324d' }}>
                      Government Job Notifications
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '13px' }}>
                      Total jobs: {jobs.length}
                    </p>
                  </div>

                  <select style={{ ...inputStyle, maxWidth: '220px' }}
                    value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {visibleJobs.length === 0 ? (
                  <p style={{ color: '#64748b', padding: '15px 0' }}>
                    No government jobs found. Add your first verified vacancy using the form above.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '14px' }}>
                    {visibleJobs.map(job => (
                      <article key={job.id} style={{
                        border: '1px solid #e5eaf0',
                        borderRadius: '10px',
                        padding: '16px',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}>
                          <div style={{ flex: 1, minWidth: '220px' }}>
                            <div style={{
                              color: '#126b45',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}>
                              {job.job_category || 'Government Jobs'}
                            </div>

                            <h3 style={{
                              color: '#17324d',
                              margin: '7px 0',
                              fontSize: '17px',
                            }}>
                              {job.title}
                            </h3>

                            <p style={{
                              margin: '5px 0',
                              color: '#64748b',
                              fontSize: '13px',
                            }}>
                              {job.organization || 'Organisation not specified'}
                              {job.post_name ? ` • ${job.post_name}` : ''}
                              {job.state ? ` • ${job.state}` : ''}
                            </p>

                            <p style={{
                              margin: '7px 0',
                              fontSize: '12px',
                              color: '#64748b',
                            }}>
                              Status: <b>{job.status.toUpperCase()}</b>
                              {job.last_date ? ` • Last date: ${job.last_date}` : ''}
                            </p>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <button type="button" disabled={busy}
                              onClick={() => editJob(job)}
                              style={{ ...buttonStyle, background: '#e8f1ff', color: '#2457a6' }}>
                              Edit
                            </button>

                            {job.status !== 'published' && (
                              <button type="button" disabled={busy}
                                onClick={() => changeJobStatus(job, 'published')}
                                style={{ ...buttonStyle, background: '#e8f7ee', color: '#176b39' }}>
                                Publish
                              </button>
                            )}

                            {job.status === 'published' && (
                              <button type="button" disabled={busy}
                                onClick={() => changeJobStatus(job, 'draft')}
                                style={{ ...buttonStyle, background: '#fff4df', color: '#925d00' }}>
                                Unpublish
                              </button>
                            )}

                            {job.status !== 'closed' && (
                              <button type="button" disabled={busy}
                                onClick={() => changeJobStatus(job, 'closed')}
                                style={{ ...buttonStyle, background: '#f1f2f4', color: '#475569' }}>
                                Close
                              </button>
                            )}

                            <button type="button" disabled={busy}
                              onClick={() => deleteJob(job)}
                              style={{ ...buttonStyle, background: '#fff0f0', color: '#b42318' }}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Other five category forms */}
          {!isJobSection && (
            <>
              <section style={{
                background: '#fff',
                padding: '22px',
                borderRadius: '12px',
                border: '1px solid #e5eaf0',
                marginBottom: '25px',
              }}>
                <h2 style={{ marginTop: 0, color: '#17324d' }}>
                  {editingUpdateId ? 'Edit Career Update' : 'Add New Career Update'}
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
                      <select style={inputStyle} value={updateForm.category}
                        onChange={e => setUpdateForm({ ...updateForm, category: e.target.value })}>
                        {careerCategories.map(item => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Title *</label>
                      <input style={inputStyle} required value={updateForm.title}
                        onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })}
                        placeholder="Enter notice or update title" />
                    </div>

                    <div>
                      <label style={labelStyle}>Organization / Department</label>
                      <input style={inputStyle} value={updateForm.organization}
                        onChange={e => setUpdateForm({ ...updateForm, organization: e.target.value })}
                        placeholder="e.g. UPSC, BPSC, NTA" />
                    </div>

                    <div>
                      <label style={labelStyle}>Exam Name</label>
                      <input style={inputStyle} value={updateForm.exam_name}
                        onChange={e => setUpdateForm({ ...updateForm, exam_name: e.target.value })}
                        placeholder="e.g. NEET UG, CTET, SSC CGL" />
                    </div>

                    <div>
                      <label style={labelStyle}>State / Region</label>
                      <input style={inputStyle} value={updateForm.state}
                        onChange={e => setUpdateForm({ ...updateForm, state: e.target.value })}
                        placeholder="All India / Bihar / Other State" />
                    </div>

                    <div>
                      <label style={labelStyle}>Notice Date</label>
                      <input type="date" style={inputStyle} value={updateForm.notice_date}
                        onChange={e => setUpdateForm({ ...updateForm, notice_date: e.target.value })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Exam / Event Date</label>
                      <input type="date" style={inputStyle} value={updateForm.event_date}
                        onChange={e => setUpdateForm({ ...updateForm, event_date: e.target.value })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Last Date (if applicable)</label>
                      <input type="date" style={inputStyle} value={updateForm.last_date}
                        onChange={e => setUpdateForm({ ...updateForm, last_date: e.target.value })} />
                    </div>

                    <div>
                      <label style={labelStyle}>Official Website URL</label>
                      <input type="url" style={inputStyle} value={updateForm.official_url}
                        onChange={e => setUpdateForm({ ...updateForm, official_url: e.target.value })}
                        placeholder="https://..." />
                    </div>

                    <div>
                      <label style={labelStyle}>Download URL</label>
                      <input type="url" style={inputStyle} value={updateForm.download_url}
                        onChange={e => setUpdateForm({ ...updateForm, download_url: e.target.value })}
                        placeholder="PDF or official download link" />
                    </div>

                    <div>
                      <label style={labelStyle}>Publication Status</label>
                      <select style={inputStyle} value={updateForm.status}
                        onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
<div style={{
  marginTop: '20px',
  padding: '16px',
  border: '1px solid #dbe4ed',
  borderRadius: '10px',
}}>
  <h3 style={{ color: '#17324d', marginTop: 0 }}>
    Additional Details (Fill as Applicable)
  </h3>

  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '16px',
  }}>
    <div>
      <label style={labelStyle}>Post Details</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.post_details}
        onChange={e => setUpdateForm({ ...updateForm, post_details: e.target.value })}
        placeholder="Post names, number of posts, etc." />
    </div>

    <div>
      <label style={labelStyle}>Vacancy Details</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.vacancy_details}
        onChange={e => setUpdateForm({ ...updateForm, vacancy_details: e.target.value })}
        placeholder="Total vacancies, UR, EWS, OBC, SC, ST, etc." />
    </div>

    <div>
      <label style={labelStyle}>Age Limit Details</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.age_limit_details}
        onChange={e => setUpdateForm({ ...updateForm, age_limit_details: e.target.value })}
        placeholder="Minimum/maximum age and category-wise relaxation" />
    </div>

    <div>
      <label style={labelStyle}>Educational Qualification</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.educational_qualification}
        onChange={e => setUpdateForm({ ...updateForm, educational_qualification: e.target.value })}
        placeholder="Required educational qualifications" />
    </div>

    <div>
      <label style={labelStyle}>Eligibility Details</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.eligibility_details}
        onChange={e => setUpdateForm({ ...updateForm, eligibility_details: e.target.value })}
        placeholder="Other eligibility conditions" />
    </div>

    <div>
      <label style={labelStyle}>Application Fee</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.application_fee}
        onChange={e => setUpdateForm({ ...updateForm, application_fee: e.target.value })}
        placeholder="General, OBC, SC/ST, Female, etc." />
    </div>

    <div>
      <label style={labelStyle}>Application Start Date</label>
      <input type="date" style={inputStyle}
        value={updateForm.application_start_date}
        onChange={e => setUpdateForm({ ...updateForm, application_start_date: e.target.value })} />
    </div>

    <div>
      <label style={labelStyle}>Important Dates</label>
      <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
        value={updateForm.important_dates}
        onChange={e => setUpdateForm({ ...updateForm, important_dates: e.target.value })}
        placeholder="Application, fee payment, exam, correction dates, etc." />
    </div>

    <div>
      <label style={labelStyle}>Apply Online URL</label>
      <input type="url" style={inputStyle}
        value={updateForm.apply_url}
        onChange={e => setUpdateForm({ ...updateForm, apply_url: e.target.value })}
        placeholder="https://..." />
    </div>

    <div>
      <label style={labelStyle}>Admit Card URL</label>
      <input type="url" style={inputStyle}
        value={updateForm.admit_card_url}
        onChange={e => setUpdateForm({ ...updateForm, admit_card_url: e.target.value })}
        placeholder="https://..." />
    </div>

    <div>
      <label style={labelStyle}>Result / Answer Key URL</label>
      <input type="url" style={inputStyle}
        value={updateForm.result_url}
        onChange={e => setUpdateForm({ ...updateForm, result_url: e.target.value })}
        placeholder="https://..." />
    </div>
  </div>
</div>
                  <div style={{ marginTop: '16px' }}>
                    <label style={labelStyle}>Description / Important Details</label>
                    <textarea style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }}
                      value={updateForm.description}
                      onChange={e => setUpdateForm({ ...updateForm, description: e.target.value })}
                      placeholder="Write important details, instructions, eligibility or updates..." />
                  </div>

                  <div style={{ marginTop: '18px' }}>
                    <button type="submit" disabled={busy} style={{
                      ...buttonStyle,
                      background: '#126b45',
                      color: '#fff',
                      padding: '11px 20px',
                    }}>
                      {busy ? 'Please wait...' : editingUpdateId ? 'Update Entry' : 'Save Entry'}
                    </button>

                    {editingUpdateId && (
                      <button type="button" onClick={resetUpdateForm} style={{
                        ...buttonStyle,
                        background: '#e9eef4',
                        color: '#17324d',
                        padding: '11px 18px',
                      }}>
                        Cancel Editing
                      </button>
                    )}
                  </div>
                </form>
              </section>

              {/* Career update list */}
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
                      {sections.find(item => item.value === activeSection)?.label}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: 0 }}>
                      Total entries: {updates.filter(item => item.category === activeSection).length}
                    </p>
                  </div>

                  <select style={{ ...inputStyle, maxWidth: '240px' }}
                    value={updateFilter}
                    onChange={e => setUpdateFilter(e.target.value)}>
                    <option value="all">All Categories</option>
                    {careerCategories.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                {visibleUpdates.filter(item =>
                  item.category === activeSection ||
                  updateFilter === 'all'
                ).length === 0 ? (
                  <p style={{ color: '#64748b', padding: '20px 0' }}>
                    No entries found. Add your first entry using the form above.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '14px' }}>
                    {visibleUpdates
                      .filter(item =>
                        item.category === activeSection ||
                        updateFilter !== 'all'
                      )
                      .map(item => (
                        <article key={item.id} style={{
                          border: '1px solid #e5eaf0',
                          borderRadius: '10px',
                          padding: '16px',
                        }}>
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
                                {updateCategoryLabel(item.category)}
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
                              <button type="button" disabled={busy}
                                onClick={() => editUpdate(item)}
                                style={{ ...buttonStyle, background: '#e8f1ff', color: '#2457a6' }}>
                                Edit
                              </button>

                              {item.status !== 'published' && (
                                <button type="button" disabled={busy}
                                  onClick={() => changeUpdateStatus(item, 'published')}
                                  style={{ ...buttonStyle, background: '#e8f7ee', color: '#176b39' }}>
                                  Publish
                                </button>
                              )}

                              {item.status === 'published' && (
                                <button type="button" disabled={busy}
                                  onClick={() => changeUpdateStatus(item, 'draft')}
                                  style={{ ...buttonStyle, background: '#fff4df', color: '#925d00' }}>
                                  Unpublish
                                </button>
                              )}

                              {item.status !== 'closed' && (
                                <button type="button" disabled={busy}
                                  onClick={() => changeUpdateStatus(item, 'closed')}
                                  style={{ ...buttonStyle, background: '#f1f2f4', color: '#475569' }}>
                                  Close
                                </button>
                              )}

                              <button type="button" disabled={busy}
                                onClick={() => deleteUpdate(item)}
                                style={{ ...buttonStyle, background: '#fff0f0', color: '#b42318' }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </section>
            </>
          )}

          <div style={{
            marginTop: '20px',
            padding: '14px',
            background: '#edf4f8',
            borderRadius: '9px',
            color: '#526b80',
            fontSize: '12px',
            lineHeight: 1.7,
          }}>
            <strong>Administrator reminder:</strong> Verify every vacancy,
            notice, date and official link before publication. Draft entries
            are not displayed publicly.
          </div>
        </div>
      </section>
    </main>
  );
}
