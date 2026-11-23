
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../../admin.css';

type NoticeCategory =
  | 'government_job'
  | 'recruitment_notice'
  | 'admit_card'
  | 'result_answer_key'
  | 'syllabus'
  | 'other_update';

type Discovery = {
  id: string;
  source_id: string;
  discovered_title: string;
  discovered_url: string;
  notice_category: NoticeCategory;
  status: 'new' | 'processing' | 'imported' | 'ignored' | 'error';
  imported_job_id: string | null;
  imported_update_id: string | null;
  discovered_at: string;
  processed_at: string | null;
  error_message: string | null;
  pdf_url: string | null;
  extracted_details: {
    job_title_candidates?: string[];
    department?: string | null;
    vacancies?: string | null;
    qualification?: string | null;
    age_limit?: string | null;
    application_fee?: string | null;
    application_start_date?: string | null;
    last_date?: string | null;
    examination_date?: string | null;
    apply_url?: string | null;
    source_pdf_url?: string;
    extraction_note?: string;
    extracted_text_excerpt?: string;
    pdf_pages?: number;
  } | null;
  extraction_status: string | null;
  extraction_error: string | null;
  extracted_at: string | null;
};

type JobSource = {
  id: string;
  source_name: string;
};

const statusFilters = [
  'all',
  'new',
  'processing',
  'imported',
  'ignored',
  'error',
];

const categoryFilters = [
  { value: 'all', label: 'All Categories' },
  { value: 'government_job', label: 'Government Jobs' },
  { value: 'recruitment_notice', label: 'Recruitment Notices & Updates' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'result_answer_key', label: 'Results & Answer Keys' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'other_update', label: 'Other Updates' },
];

const categoryLabels: Record<NoticeCategory, string> = {
  government_job: 'Government Jobs',
  recruitment_notice: 'Recruitment Notices & Updates',
  admit_card: 'Admit Cards',
  result_answer_key: 'Results & Answer Keys',
  syllabus: 'Syllabus',
  other_update: 'Other Updates',
};

const categoryColors: Record<
  NoticeCategory,
  { background: string; color: string }
> = {
  government_job: { background: '#e5f8ef', color: '#087443' },
  recruitment_notice: { background: '#e8f1fb', color: '#174a7c' },
  admit_card: { background: '#f0eaff', color: '#6336a5' },
  result_answer_key: { background: '#fff4df', color: '#98620a' },
  syllabus: { background: '#e8f1fb', color: '#174a7c' },
  other_update: { background: '#edf3f8', color: '#34536e' },
};

function formatDate(value: string | null) {
  if (!value) return 'Not recorded';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DiscoveredGovernmentJobsPage() {
  const router = useRouter();

  const [items, setItems] = useState<Discovery[]>([]);
  const [sources, setSources] = useState<JobSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [filter, setFilter] = useState('new');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [collectionResults, setCollectionResults] = useState<Array<{ source: string; pages_checked: number; found: number; pdfs_read: number; error?: string }>>([]);

  // Load existing discoveries and source names.
  const loadDiscoveries = useCallback(async () => {
    const client = supabase;

    if (!client) {
      setErrorMessage('Supabase connection is not configured.');
      setLoading(false);
      return;
    }

    const [discoveriesResult, sourcesResult] = await Promise.all([
      client
        .from('government_job_discoveries')
        .select(
          'id,source_id,discovered_title,discovered_url,notice_category,status,discovered_at,imported_job_id,imported_update_id,processed_at,error_message,pdf_url,extracted_details,extraction_status,extraction_error,extracted_at'
        )
        .order('discovered_at', { ascending: false }),

      client
        .from('government_job_sources')
        .select('id,source_name'),
    ]);

    if (discoveriesResult.error) {
      setErrorMessage(
        'Could not load discovered notices: ' +
          discoveriesResult.error.message
      );
    } else {
      setItems((discoveriesResult.data || []) as Discovery[]);
      setErrorMessage('');
    }

    if (!sourcesResult.error) {
      setSources((sourcesResult.data || []) as JobSource[]);
    }

    setLoading(false);
  }, []);

  // Run the collector manually using the logged-in administrator's token.
  async function runCollection() {
    const client = supabase;

    if (!client) {
      setErrorMessage('Supabase connection is not configured.');
      return;
    }

    setCollecting(true);
    setMessage('Collection is running. Please wait...');
    setErrorMessage('');
    setCollectionResults([]);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          'Your login session has expired. Please sign in again.'
        );
      }

      const response = await fetch('/api/jobs/collect', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Government job collection failed.'
        );
      }

      await loadDiscoveries();
      setCollectionResults(Array.isArray(result.results) ? result.results : []);

      setMessage(
        `Collection completed successfully. Sources checked: ${
          result.sources_checked ?? 0
        }. Candidate links found: ${
          result.candidate_links_found ?? 0
        }. PDFs processed: ${
          result.pdfs_processed ?? 0
        }. PDFs successfully read: ${
          result.pdfs_successfully_read ?? 0
        }.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'An unexpected collection error occurred.'
      );

      setMessage('');
    } finally {
      setCollecting(false);
    }
  }
  // Process one pending government notification PDF.
  async function processNextPdf() {
    const client = supabase;

    if (!client) {
      setErrorMessage('Supabase connection is not configured.');
      return;
    }

    setCollecting(true);
    setMessage('Processing one pending PDF. Please wait...');
    setErrorMessage('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          'Your login session has expired. Please sign in again.'
        );
      }

      const response = await fetch('/api/jobs/process-pdfs', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'PDF processing failed.'
        );
      }

      await loadDiscoveries();

      setMessage(
        result.message || 'PDF processing request completed.'
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'An unexpected PDF processing error occurred.'
      );

      setMessage('');
    } finally {
      setCollecting(false);
    }
  }
  // Verify administrator access before showing the dashboard.
  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      const client = supabase;

      if (!client) {
        router.replace('/admin/login');
        return;
      }

      const {
        data: { user },
        error,
      } = await client.auth.getUser();

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
        router.replace('/admin/login');
        return;
      }

      if (active) {
        await loadDiscoveries();
      }
    }

    void checkAdmin();

    return () => {
      active = false;
    };
  }, [router, loadDiscoveries]);

  // Get the official source name for a discovered notice.
  function getSourceName(sourceId: string): string {
    return (
      sources.find(source => source.id === sourceId)?.source_name ||
      'Official Government Source'
    );
  }

  // Update the review status of a discovered notice.
  async function updateStatus(
    item: Discovery,
    nextStatus: 'new' | 'ignored'
  ) {
    const client = supabase;
    if (!client) return;

    setBusyId(item.id);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('government_job_discoveries')
      .update({
        status: nextStatus,
        processed_at:
          nextStatus === 'ignored' ? new Date().toISOString() : null,
        error_message: null,
      })
      .eq('id', item.id);

    if (error) {
      setErrorMessage('Could not update notice status: ' + error.message);
    } else {
      setMessage(
        nextStatus === 'ignored'
          ? 'Notice marked as ignored.'
          : 'Notice restored to the new review queue.'
      );
      await loadDiscoveries();
    }

    setBusyId(null);
  }

  // Import a discovery into the correct destination after checking for duplicates.
  async function createDraftJob(item: Discovery) {
    const client = supabase;
    if (!client) return;

    setBusyId(item.id);
    setMessage('');
    setErrorMessage('');

    try {
      const details = item.extracted_details || {};

      function toISODate(value: string | null | undefined): string | null {
        if (!value) return null;
        const text = value.trim();
        if (!text) return null;

        const isoMatch = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

        const indianMatch = text.match(/^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})$/);
        if (indianMatch) {
          return `${indianMatch[3]}-${indianMatch[2].padStart(2, '0')}-${indianMatch[1].padStart(2, '0')}`;
        }

        const parsed = new Date(text);
        if (Number.isNaN(parsed.getTime())) return null;

        return [
          parsed.getFullYear(),
          String(parsed.getMonth() + 1).padStart(2, '0'),
          String(parsed.getDate()).padStart(2, '0'),
        ].join('-');
      }

      function toVacancyNumber(value: string | null | undefined): number | null {
        if (!value) return null;
        const match = value.replace(/,/g, '').match(/\\d+/);
        if (!match) return null;
        const number = Number(match[0]);
        return Number.isSafeInteger(number) ? number : null;
      }

      if (
        item.pdf_url &&
        (item.extraction_status !== 'completed' ||
          !details.extracted_text_excerpt?.trim())
      ) {
        throw new Error(
          'PDF extraction is incomplete or contains no readable text. Review this notice manually before importing.'
        );
      }

      const sourceName = getSourceName(item.source_id);
      const title =
        details.job_title_candidates?.find(value => value.trim()) ||
        item.discovered_title ||
        'Untitled career notice';

      const searchableText = `${title} ${item.discovered_title || ''} ${
        item.discovered_url || ''
      }`.toLowerCase();

      const isCancellation =
        /\\b(cancelled|canceled|cancellation|corrigendum|withdrawn|postponed|rescheduled|extension|revised)\\b/i.test(
          searchableText
        );
      const isAdmitCard =
        /\\b(admit card|hall ticket|call letter)\\b/i.test(searchableText);
      const isResult =
        /\\b(result|answer key|merit list|score card|scorecard)\\b/i.test(
          searchableText
        );
      const isSyllabus = /\\b(syllabus|exam pattern)\\b/i.test(searchableText);
      const isVacancy =
        item.notice_category === 'government_job' && !isCancellation;

      // Check whether this discovery has already been imported as a government job.
      const { data: existingJob, error: jobLookupError } = await client
        .from('government_jobs')
        .select('id')
        .eq('source_id', item.source_id)
        .eq('source_reference', item.discovered_url)
        .maybeSingle();

      if (jobLookupError) {
        throw new Error('Could not check existing jobs: ' + jobLookupError.message);
      }

      if (existingJob) {
        const { error } = await client
          .from('government_job_discoveries')
          .update({
            status: 'imported',
            imported_job_id: existingJob.id,
            imported_update_id: null,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', item.id);

        if (error) throw new Error(error.message);
        setMessage('This government job already exists. Its record has been linked.');
        await loadDiscoveries();
        return;
      }

      // Check whether this discovery already exists as a career update.
      const { data: existingUpdate, error: updateLookupError } = await client
        .from('career_updates')
        .select('id')
        .eq('official_url', item.discovered_url)
        .maybeSingle();

      if (updateLookupError) {
        throw new Error(
          'Could not check existing career updates: ' + updateLookupError.message
        );
      }

      if (existingUpdate) {
        const { error } = await client
          .from('government_job_discoveries')
          .update({
            status: 'imported',
            imported_job_id: null,
            imported_update_id: existingUpdate.id,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', item.id);

        if (error) throw new Error(error.message);
        setMessage('This career update already exists. Its record has been linked.');
        await loadDiscoveries();
        return;
      }

      if (isVacancy) {
        const { data: newJob, error: insertError } = await client
          .from('government_jobs')
          .insert({
            title,
            organization: details.department || sourceName,
            post_name: details.job_title_candidates?.[0] || title,
            vacancies: toVacancyNumber(details.vacancies),
            qualification: details.qualification || null,
            age_limit: details.age_limit || null,
            application_fee: details.application_fee || null,
            application_start_date: toISODate(details.application_start_date),
            last_date: toISODate(details.last_date),
            notification_url: item.pdf_url || item.discovered_url,
            apply_url: details.apply_url || null,
            official_website: (() => {
              try {
                return new URL(item.discovered_url).origin;
              } catch {
                return null;
              }
            })(),
            status: 'draft',
            source_id: item.source_id,
            source_reference: item.discovered_url,
            auto_collected: true,
          })
          .select('id')
          .single();

        if (insertError || !newJob) {
          throw new Error(
            'Could not create draft government job: ' +
              (insertError?.message || 'No record returned.')
          );
        }

        const { error: discoveryError } = await client
          .from('government_job_discoveries')
          .update({
            status: 'imported',
            imported_job_id: newJob.id,
            imported_update_id: null,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', item.id);

        if (discoveryError) {
          throw new Error(
            'Government job draft created, but discovery tracking failed: ' +
              discoveryError.message
          );
        }

        setMessage(
          'Draft government job created with extracted information. Verify all details before publishing.'
        );
      } else {
        let updateCategory:
          | 'recruitment_notice'
          | 'admit_card'
          | 'result_answer_key'
          | 'syllabus'
          | 'other_update' = 'other_update';

        if (isCancellation) {
          updateCategory = 'recruitment_notice';
        } else if (isAdmitCard || item.notice_category === 'admit_card') {
          updateCategory = 'admit_card';
        } else if (isResult || item.notice_category === 'result_answer_key') {
          updateCategory = 'result_answer_key';
        } else if (isSyllabus || item.notice_category === 'syllabus') {
          updateCategory = 'syllabus';
        } else if (item.notice_category === 'recruitment_notice') {
          updateCategory = 'recruitment_notice';
        }

        const extractedInformation = [
          details.department ? `Department: ${details.department}` : null,
          details.vacancies ? `Vacancies: ${details.vacancies}` : null,
          details.qualification
            ? `Educational Qualification: ${details.qualification}`
            : null,
          details.age_limit ? `Age Limit: ${details.age_limit}` : null,
          details.application_fee
            ? `Application Fee: ${details.application_fee}`
            : null,
          details.application_start_date
            ? `Application Start Date: ${details.application_start_date}`
            : null,
          details.last_date ? `Last Date to Apply: ${details.last_date}` : null,
          details.examination_date
            ? `Examination Date: ${details.examination_date}`
            : null,
          details.apply_url ? `Application Link: ${details.apply_url}` : null,
          details.extraction_note || null,
        ].filter((line): line is string => Boolean(line));

        const description = [
          'Automatically collected notice. Verify all details against the official source.',
          ...extractedInformation,
        ].join('\\n');

        const { data: newUpdate, error: insertError } = await client
          .from('career_updates')
          .insert({
            category: updateCategory,
            title,
            organization: details.department || sourceName,
            exam_name: null,
            state: 'All India',
            description,
            notice_date: toISODate(item.discovered_at),
            event_date: toISODate(details.examination_date),
            last_date: toISODate(details.last_date),
            official_url: item.discovered_url,
            download_url: item.pdf_url || null,
            status: 'draft',
          })
          .select('id')
          .single();

        if (insertError || !newUpdate) {
          throw new Error(
            'Could not create draft career update: ' +
              (insertError?.message || 'No record returned.')
          );
        }

        const { error: discoveryError } = await client
          .from('government_job_discoveries')
          .update({
            status: 'imported',
            imported_job_id: null,
            imported_update_id: newUpdate.id,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', item.id);

        if (discoveryError) {
          throw new Error(
            'Career update created, but discovery tracking failed: ' +
              discoveryError.message
          );
        }

        setMessage(
          'Draft career update created with extracted information. Verify its category and details before publishing.'
        );
      }

      await loadDiscoveries();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while creating the draft.'
      );
    } finally {
      setBusyId(null);
    }
  }

  // Change the category of a discovered notice.
  async function updateCategory(
    item: Discovery,
    nextCategory: NoticeCategory
  ) {
    const client = supabase;

    if (!client) return;

    setBusyId(item.id);
    setMessage('');
    setErrorMessage('');

    const { error } = await client
      .from('government_job_discoveries')
      .update({ notice_category: nextCategory })
      .eq('id', item.id);

    if (error) {
      setErrorMessage(
        'Could not update category: ' + error.message
      );
    } else {
      setMessage('Notice category updated successfully.');
      await loadDiscoveries();
    }

    setBusyId(null);
  }

  const visibleItems = items.filter(item => {
    const matchesStatus =
      filter === 'all' || item.status === filter;

    const matchesCategory =
      categoryFilter === 'all' ||
      item.notice_category === categoryFilter;

    return matchesStatus && matchesCategory;
  });

  const counts = {
    all: items.length,
    new: items.filter(item => item.status === 'new').length,
    processing: items.filter(item => item.status === 'processing').length,
    imported: items.filter(item => item.status === 'imported').length,
    ignored: items.filter(item => item.status === 'ignored').length,
    error: items.filter(item => item.status === 'error').length,
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

        <div className="admin-side-label">
          CONTENT MANAGEMENT
        </div>

        <a
          className="admin-side-link"
          href="/admin/study-materials"
        >
          ▤ &nbsp; Study Materials
        </a>

        <a
  className="admin-side-link"
  href="/admin/career-updates"
>
  💼 &nbsp; Jobs & Career Updates
</a>

        <a
          className="admin-side-link active"
          href="/admin/government-jobs/discoveries"
        >
          ↳ &nbsp; Discovered Jobs
        </a>

        <a className="admin-side-link" href="/admin/dashboard">
          ▤ &nbsp; Mock Tests
        </a>

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

            <h1>Discovered Notices</h1>
          </div>

          <a
  className="admin-logout"
  href="/admin/career-updates"
>
  Back to Jobs & Career Updates
</a>
        </header>

        <div style={{ padding: '25px 0' }}>
          <h2>Automatic Notice Discovery</h2>

          <p style={{ color: '#647b91', lineHeight: 1.7 }}>
            Review government job vacancies, recruitment notices, admit cards,
            results, answer keys, syllabi and other career updates collected
            from official websites. Verify every notice before publishing.
          </p>

          {message && (
            <div
              style={{
                padding: 12,
                margin: '15px 0',
                background: '#e5f8ef',
                color: '#087443',
                borderRadius: 8,
              }}
            >
              {message}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: 12,
                margin: '15px 0',
                background: '#fff0f0',
                color: '#bd2525',
                borderRadius: 8,
              }}
            >
              {errorMessage}
            </div>
          )}

          {collectionResults.length > 0 && (
            <div
              style={{
                padding: 14,
                margin: '12px 0',
                background: '#f1f6fa',
                border: '1px solid #dce5ec',
                borderRadius: 8,
                color: '#17324d',
              }}
            >
              <strong>Source scan details</strong>
              {collectionResults.map((item, index) => (
                <div
                  key={`${item.source}-${index}`}
                  style={{
                    paddingTop: 10,
                    marginTop: 10,
                    borderTop: '1px solid #dce5ec',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <div><b>Source:</b> {item.source}</div>
                  <div><b>Pages checked:</b> {item.pages_checked}</div>
                  <div><b>Candidate links:</b> {item.found}</div>
                  <div><b>PDFs read:</b> {item.pdfs_read}</div>
                  {item.error && (
                    <div style={{ color: '#bd2525' }}>
                      <b>Source error:</b> {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginTop: 25 }}>
            Filter by Status
          </h3>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              margin: '15px 0 25px',
            }}
          >
            {statusFilters.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                style={{
                  padding: '10px 15px',
                  borderRadius: 8,
                  border: '1px solid #dce5ec',
                  background:
                    filter === item ? '#102d49' : '#fff',
                  color: filter === item ? '#fff' : '#17324d',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textTransform: 'capitalize',
                }}
              >
                {item} ({counts[item as keyof typeof counts]})
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 22,
            }}
          >
            <label
              htmlFor="notice-category"
              style={{
                fontWeight: 700,
                color: '#17324d',
              }}
            >
              Filter by Category:
            </label>

            <select
              id="notice-category"
              value={categoryFilter}
              onChange={event =>
                setCategoryFilter(event.target.value)
              }
              style={{
                padding: '11px 14px',
                minWidth: 230,
                border: '1px solid #dce5ec',
                borderRadius: 8,
                background: '#fff',
                color: '#17324d',
                fontSize: 14,
              }}
            >
              {categoryFilters.map(category => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <h2 style={{ margin: 0 }}>
              Notices ({visibleItems.length})
            </h2>
<button
  type="button"
  onClick={processNextPdf}
  disabled={collecting || busyId !== null}
  style={{
    padding: '10px 15px',
    border: 0,
    borderRadius: 8,
    background: collecting ? '#647b91' : '#087443',
    color: '#fff',
    fontWeight: 700,
    cursor: collecting ? 'not-allowed' : 'pointer',
  }}
>
  {collecting ? 'Processing...' : 'Process One PDF'}
</button>
            <button
              type="button"
              onClick={runCollection}
              disabled={collecting || busyId !== null}
              style={{
                padding: '10px 15px',
                border: 0,
                borderRadius: 8,
                background: collecting ? '#647b91' : '#102d49',
                color: '#fff',
                fontWeight: 700,
                cursor: collecting ? 'not-allowed' : 'pointer',
              }}
            >
              {collecting
                ? 'Collecting Notices...'
                : 'Run Collection & Refresh'}
            </button>
          </div>

          {visibleItems.length === 0 ? (
            <div
              style={{
                background: '#fff',
                padding: 35,
                border: '1px solid #dce5ec',
                borderRadius: 12,
                textAlign: 'center',
              }}
            >
              <h3>No notices found</h3>

              <p style={{ color: '#647b91' }}>
                There are currently no notices matching these
                filters. New discoveries will appear here after
                collection.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 15 }}>
              {visibleItems.map(item => {
                const category: NoticeCategory = item.notice_category || 'other_update';

                const categoryStyle =
                  categoryColors[category] ||
                  categoryColors.other_update;

                return (
                  <article
                    key={item.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #dce5ec',
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 350px' }}>
                        <h3
                          style={{
                            margin: '0 0 12px',
                            fontSize: 19,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.discovered_title ||
                            'Untitled recruitment notice'}
                        </h3>

                        <div
                          style={{
                            color: '#174a7c',
                            fontSize: 14,
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                        >
                          Organisation:{' '}
                          {getSourceName(item.source_id)}
                        </div>

                        <span
                          style={{
                            display: 'inline-block',
                            background: categoryStyle.background,
                            color: categoryStyle.color,
                            padding: '7px 11px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 10,
                          }}
                        >
                          {categoryLabels[category] || 'Other Updates'}
                        </span>

                        <div
                          style={{
                            color: '#647b91',
                            fontSize: 13,
                            marginBottom: 8,
                          }}
                        >
                          Discovered:{' '}
                          {formatDate(item.discovered_at)}
                        </div>

                        <a
                          href={item.discovered_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#087d91',
                            fontWeight: 700,
                            fontSize: 13,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          Open original notice ↗
                        </a>

                        {item.pdf_url && (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              background: '#f5f8fb',
                              border: '1px solid #dce5ec',
                              borderRadius: 8,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                marginBottom: 7,
                              }}
                            >
                              PDF extraction:{' '}
                              {(item.extraction_status || 'pending')
                                .replace('_', ' ')}
                            </div>

                            <a
                              href={item.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#087d91',
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              Open PDF notification ↗
                            </a>

                            {item.extraction_error && (
                              <p
                                style={{
                                  color: '#bd2525',
                                  fontSize: 13,
                                  marginBottom: 0,
                                }}
                              >
                                {item.extraction_error}
                              </p>
                            )}

                            {item.extracted_details && (
                              <div
                                style={{
                                  marginTop: 10,
                                  fontSize: 13,
                                  color: '#34536e',
                                  lineHeight: 1.7,
                                }}
                              >
                                {item.extracted_details.job_title_candidates?.length ? (
                                  <div>
                                    <b>Title found:</b>{' '}
                                    {item.extracted_details.job_title_candidates.join(
                                      ' / '
                                    )}
                                  </div>
                                ) : null}

                                {item.extracted_details.department && (
                                  <div>
                                    <b>Department:</b>{' '}
                                    {item.extracted_details.department}
                                  </div>
                                )}

                                {item.extracted_details.vacancies && (
                                  <div>
                                    <b>Vacancies:</b>{' '}
                                    {item.extracted_details.vacancies}
                                  </div>
                                )}

                                {item.extracted_details.qualification && (
                                  <div>
                                    <b>Qualification:</b>{' '}
                                    {item.extracted_details.qualification}
                                  </div>
                                )}

                                {item.extracted_details.age_limit && (
                                  <div>
                                    <b>Age limit:</b>{' '}
                                    {item.extracted_details.age_limit}
                                  </div>
                                )}

                                {item.extracted_details.application_fee && (
                                  <div>
                                    <b>Application fee:</b>{' '}
                                    {item.extracted_details.application_fee}
                                  </div>
                                )}

                                {item.extracted_details.application_start_date && (
                                  <div>
                                    <b>Application starts:</b>{' '}
                                    {item.extracted_details.application_start_date}
                                  </div>
                                )}

                                {item.extracted_details.last_date && (
                                  <div>
                                    <b>Last date:</b>{' '}
                                    {item.extracted_details.last_date}
                                  </div>
                                )}

                                {item.extracted_details.examination_date && (
                                  <div>
                                    <b>Exam date:</b>{' '}
                                    {item.extracted_details.examination_date}
                                  </div>
                                )}

                                {item.extracted_details.pdf_pages && (
                                  <div>
                                    <b>PDF pages:</b>{' '}
                                    {item.extracted_details.pdf_pages}
                                  </div>
                                )}

                                {item.extracted_details.extraction_note && (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    {item.extracted_details.extraction_note}
                                  </div>
                                )}
                              </div>
                            )}

                            {item.extracted_at && (
                              <div
                                style={{
                                  marginTop: 7,
                                  color: '#647b91',
                                  fontSize: 12,
                                }}
                              >
                                Extracted:{' '}
                                {formatDate(item.extracted_at)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          background: '#edf3f8',
                          color: '#34536e',
                          padding: '7px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginTop: 16,
                      }}
                    >
                      <label
                        htmlFor={`category-${item.id}`}
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#34536e',
                        }}
                      >
                        Change Category:
                      </label>

                      <select
                        id={`category-${item.id}`}
                        value={category}
                        disabled={busyId !== null || collecting}
                        onChange={event =>
                          updateCategory(
                            item,
                            event.target.value as NoticeCategory
                          )
                        }
                        style={{
                          padding: '9px 12px',
                          border: '1px solid #dce5ec',
                          borderRadius: 7,
                          background: '#fff',
                          color: '#17324d',
                          fontSize: 13,
                          minWidth: 210,
                        }}
                      >
                        {categoryFilters
                          .filter(option => option.value !== 'all')
                          .map(option => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                      </select>

                      {busyId === item.id && (
                        <span
                          style={{
                            fontSize: 12,
                            color: '#647b91',
                          }}
                        >
                          Saving…
                        </span>
                      )}
                    </div>

                    {item.error_message && (
                      <p
                        style={{
                          color: '#bd2525',
                          background: '#fff0f0',
                          padding: 10,
                          borderRadius: 7,
                          fontSize: 13,
                        }}
                      >
                        {item.error_message}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        gap: 9,
                        flexWrap: 'wrap',
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: '1px solid #edf1f5',
                      }}
                    >
                      {item.status !== 'ignored' && (
                        <button
                          type="button"
                          disabled={busyId !== null || collecting}
                          onClick={() =>
                            updateStatus(item, 'ignored')
                          }
                          style={{
                            padding: '9px 13px',
                            border: 0,
                            borderRadius: 7,
                            background: '#fff0f0',
                            color: '#a52626',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {busyId === item.id
                            ? 'Please wait…'
                            : 'Mark as Ignored'}
                        </button>
                      )}

                      {item.status === 'ignored' && (
                        <button
                          type="button"
                          disabled={busyId !== null || collecting}
                          onClick={() =>
                            updateStatus(item, 'new')
                          }
                          style={{
                            padding: '9px 13px',
                            border: 0,
                            borderRadius: 7,
                            background: '#e5f8ef',
                            color: '#087443',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {busyId === item.id
                            ? 'Please wait…'
                            : 'Restore to New'}
                        </button>
                      )}

                      {item.status !== 'imported' &&
                        item.status !== 'ignored' && (
                          <button
                            type="button"
                            disabled={busyId !== null || collecting}
                            onClick={() => createDraftJob(item)}
                            style={{
                              padding: '9px 13px',
                              border: 0,
                              borderRadius: 7,
                              background: '#e8f1fb',
                              color: '#174a7c',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {busyId === item.id
                              ? 'Please wait…'
                              : 'Create Draft Record'}
                          </button>
                        )}

                      {item.status === 'error' && (
                        <button
                          type="button"
                          disabled={busyId !== null || collecting}
                          onClick={() =>
                            updateStatus(item, 'new')
                          }
                          style={{
                            padding: '9px 13px',
                            border: 0,
                            borderRadius: 7,
                            background: '#e8f1fb',
                            color: '#174a7c',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Retry Review
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: 25,
              padding: 16,
              background: '#edf4f8',
              borderRadius: 10,
              color: '#526b80',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            <strong>Administrator reminder:</strong> Automatically
            discovered links are candidates, not verified information.
            Open the official notice, verify its details and dates,
            and publish only after manual review.
          </div>
        </div>
      </section>
    </main>
  );
}
