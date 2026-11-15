
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

function formatDate(value: string | null) {
  if (!value) return 'Not specified';

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatVerified(value: string | null) {
  if (!value) return 'Not recorded';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not recorded';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function GovernmentJobDetailsPage() {
  const params = useParams();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadJob() {
      const client = supabase;

      if (!client) {
        setError('Job information is temporarily unavailable.');
        setLoading(false);
        return;
      }

      if (!jobId || !/^\d+$/.test(String(jobId))) {
        setError('Invalid job notification.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await client
        .from('government_jobs')
        .select(`
          id,
          title,
          organization,
          post_name,
          state,
          vacancies,
          qualification,
          application_fee,
          notification_url,
          apply_url,
          last_date,
          status,
          job_category,
          age_limit,
          application_start_date,
          official_website,
          last_verified_at,
          created_at
        `)
        .eq('id', Number(jobId))
        .in('status', ['published', 'closed'])
        .maybeSingle();

      if (!active) return;

      if (fetchError || !data) {
        setError('This job notification could not be found or is no longer available.');
      } else {
        setJob(data as Job);
      }

      setLoading(false);
    }

    loadJob();

    return () => {
      active = false;
    };
  }, [jobId]);

  const details = job
    ? [
        ['Recruiting organisation', job.organization],
        ['Post name', job.post_name],
        ['Job category', job.job_category],
        ['State / jurisdiction', job.state],
        ['Total vacancies', job.vacancies],
        ['Educational qualification', job.qualification],
        ['Age limit', job.age_limit],
        ['Application fee', job.application_fee],
        ['Application start date', formatDate(job.application_start_date)],
        ['Last date to apply', formatDate(job.last_date)],
      ]
    : [];

  const detailStyle = {
    background: '#f5f8fa',
    border: '1px solid #e7edf2',
    borderRadius: 10,
    padding: 16,
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f4f7fa',
        color: '#102d49',
      }}
    >
      <header
        style={{
          background: '#102d49',
          color: '#fff',
          padding: '18px 5%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 15,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 21,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg,#0b526d,#10a6a0)',
              fontSize: 24,
            }}
          >
            E
          </span>
          EduAxis <span style={{ color: '#35c7bf' }}>India</span>
        </Link>

        <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14 }}>
          <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>
            Home
          </Link>
          <Link
            href="/government-jobs"
            style={{ color: '#35c7bf', textDecoration: 'none', fontWeight: 700 }}
          >
            Government Jobs
          </Link>
          <Link href="/study-materials" style={{ color: '#fff', textDecoration: 'none' }}>
            Study Materials
          </Link>
        </nav>
      </header>

      <section
        style={{
          background: 'linear-gradient(120deg,#102d49,#164b68)',
          color: '#fff',
          padding: '35px 5%',
        }}
      >
        <div style={{ maxWidth: 1050, margin: '0 auto' }}>
          <Link
            href="/government-jobs"
            style={{ color: '#53d1c8', textDecoration: 'none', fontSize: 14 }}
          >
            ← Back to Government Jobs
          </Link>

          <div
            style={{
              marginTop: 24,
              color: '#53d1c8',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            EDUAXIS INDIA CAREER DESK
          </div>

          <h1 style={{ fontSize: 'clamp(28px,5vw,43px)', lineHeight: 1.2 }}>
            {loading ? 'Loading job details...' : job?.title || 'Job Details'}
          </h1>

          {job && (
            <>
              <p style={{ color: '#d8e6ef', fontSize: 16 }}>
                {job.organization}
                {job.post_name ? ` · ${job.post_name}` : ''}
              </p>

              <span
                style={{
                  display: 'inline-block',
                  background: job.status === 'closed' ? '#7f2935' : '#087443',
                  padding: '7px 13px',
                  borderRadius: 30,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {job.status === 'closed' ? 'Application Closed' : 'Published'}
              </span>
            </>
          )}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1050,
          margin: '0 auto',
          padding: '35px 5% 60px',
        }}
      >
        {loading && (
          <div style={{ background: '#fff', padding: 25, borderRadius: 12 }}>
            Loading recruitment information...
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            style={{
              background: '#fff',
              padding: 30,
              borderRadius: 12,
              textAlign: 'center',
              border: '1px solid #e2e8f0',
            }}
          >
            <h2>Job notification unavailable</h2>
            <p style={{ color: '#647b91' }}>{error}</p>
            <Link
              href="/government-jobs"
              style={{ color: '#0b918d', fontWeight: 700 }}
            >
              Browse all government jobs →
            </Link>
          </div>
        )}

        {!loading && job && (
          <>
            <section
              style={{
                background: '#fff',
                border: '1px solid #dce5ec',
                borderRadius: 14,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Recruitment Overview</h2>

              <p style={{ color: '#647b91', lineHeight: 1.8 }}>
                Explore the recruitment information for {job.title}.
                Review the eligibility conditions, vacancies and important
                application dates before applying through the official portal.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                  gap: 13,
                  marginTop: 22,
                }}
              >
                {details.map(([label, value]) => (
                  <div key={label} style={detailStyle}>
                    <div
                      style={{
                        color: '#71869a',
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        marginBottom: 7,
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        color: '#17324d',
                        fontSize: 15,
                        fontWeight: 600,
                        overflowWrap: 'anywhere',
                        lineHeight: 1.6,
                      }}
                    >
                      {value || 'As per official notification'}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              style={{
                background: '#fff',
                border: '1px solid #dce5ec',
                borderRadius: 14,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Important Dates</h2>

              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <strong>Application Start Date</strong>
                  <p style={{ color: '#647b91', margin: '5px 0' }}>
                    {formatDate(job.application_start_date)}
                  </p>
                </div>

                <div>
                  <strong>Last Date to Apply</strong>
                  <p style={{ color: '#647b91', margin: '5px 0' }}>
                    {formatDate(job.last_date)}
                  </p>
                </div>
              </div>
            </section>

            <section
              style={{
                background: '#fff',
                border: '1px solid #dce5ec',
                borderRadius: 14,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Official Links</h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {job.notification_url && (
                  <a
                    href={job.notification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#eaf2fa',
                      color: '#174a7c',
                      padding: '12px 16px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    Official Notification ↗
                  </a>
                )}

                {job.official_website && (
                  <a
                    href={job.official_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#edf2f6',
                      color: '#34536e',
                      padding: '12px 16px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    Official Website ↗
                  </a>
                )}

                {job.apply_url && job.status !== 'closed' && (
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#102d49',
                      color: '#fff',
                      padding: '12px 16px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    Apply Online ↗
                  </a>
                )}

                {!job.notification_url && !job.official_website && !job.apply_url && (
                  <p style={{ color: '#647b91' }}>
                    Official links have not been added yet.
                  </p>
                )}
              </div>

              <p style={{ color: '#8293a2', fontSize: 12, marginTop: 20 }}>
                Last verified: {formatVerified(job.last_verified_at)}
              </p>
            </section>

            <div
              style={{
                background: '#edf4f8',
                borderRadius: 12,
                padding: 20,
                color: '#526b80',
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <strong>Important Notice:</strong> EduAxis India is an
              information platform and is not a government recruitment
              authority. Vacancy details, eligibility, fees and dates may
              change. Always read the official recruitment notification
              and verify all information on the recruiting organisation's
              website before applying.
            </div>

            <div style={{ marginTop: 25 }}>
              <Link
                href="/government-jobs"
                style={{
                  color: '#0b918d',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                ← Explore more government jobs
              </Link>
            </div>
          </>
        )}
      </section>

      <footer
        style={{
          background: '#102d49',
          color: '#d8e6ef',
          padding: 25,
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        © {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.
      </footer>
    </main>
  );
}
