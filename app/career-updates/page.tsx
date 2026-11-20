
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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

const sections = [
  { value: 'all', label: 'All Updates' },
  { value: 'jobs', label: 'Latest Government Jobs' },
  { value: 'recruitment_notice', label: 'Recruitment Notices' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'result_answer_key', label: 'Results & Answer Keys' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'admission', label: 'Admission' },
  { value: 'other_update', label: 'Other Updates' },
];

const jobCategories = [
  'All Categories',
  'Bihar Government Jobs',
  'Central Government Jobs',
  'Teaching Jobs',
  'Banking Jobs',
  'Railway Jobs',
  'Defence Jobs',
  'Other State Government Jobs',
  'Other Government Jobs',
];

function formatDate(value: string | null) {
  if (!value) return 'Not specified';

  const date = new Date(value.slice(0, 10) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
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

function updateCategoryLabel(category: string) {
  const item = sections.find(section => section.value === category);
  return item?.label || 'Career Update';
}

function downloadButtonLabel(category: string) {
  switch (category) {
    case 'recruitment_notice':
      return 'Download Notice';
    case 'admit_card':
      return 'Download Admit Card';
    case 'result_answer_key':
      return 'View Result / Answer Key';
      case 'syllabus':
  return 'Download Syllabus';
case 'admission':
  return 'View Admission Details';
    default:
      return 'View / Download Details';
  }
}

export default function CareerUpdatesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [updates, setUpdates] = useState<CareerUpdate[]>([]);

  const [selectedSection, setSelectedSection] = useState('all');
  const [search, setSearch] = useState('');
  const [jobCategory, setJobCategory] = useState('All Categories');
  const [showClosed, setShowClosed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [jobError, setJobError] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAllData() {
      const client = supabase;

      if (!client) {
        setJobError('Unable to connect to the database.');
        setUpdateError('Unable to connect to the database.');
        setLoading(false);
        return;
      }

      const [jobsResult, updatesResult] = await Promise.all([
        client
          .from('government_jobs')
          .select('id,title,organization,post_name,state,vacancies,qualification,application_fee,notification_url,apply_url,last_date,status,job_category,age_limit,application_start_date,official_website,last_verified_at,created_at')
          .in('status', ['published', 'closed'])
          .order('created_at', { ascending: false }),

        client
          .from('career_updates')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      if (jobsResult.error) {
        setJobError('Government job listings could not be loaded.');
      } else {
        setJobs((jobsResult.data || []) as Job[]);
      }

      if (updatesResult.error) {
        setUpdateError('Career updates could not be loaded.');
      } else {
        setUpdates((updatesResult.data || []) as CareerUpdate[]);
      }

      setLoading(false);
    }

    loadAllData();

    return () => {
      active = false;
    };
  }, []);

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return jobs.filter(job => {
      const matchesSearch = !term || [
        job.title,
        job.organization,
        job.post_name,
        job.state,
        job.qualification,
        job.job_category,
      ].some(value => value?.toLowerCase().includes(term));

      const matchesCategory =
        jobCategory === 'All Categories' ||
        job.job_category === jobCategory;

      const matchesStatus = showClosed || job.status !== 'closed';

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [jobs, search, jobCategory, showClosed]);

  const visibleUpdates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return updates.filter(item => {
      const matchesSection =
        selectedSection === 'all' ||
        selectedSection === 'jobs' ||
        item.category === selectedSection;

      const searchableText = [
        item.title,
        item.organization,
        item.exam_name,
        item.state,
        item.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesSection && (!term || searchableText.includes(term));
    });
  }, [updates, selectedSection, search]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      all: jobs.filter(job => showClosed || job.status !== 'closed').length +
        updates.length,
      jobs: jobs.filter(job => showClosed || job.status !== 'closed').length,
    };

    sections.forEach(section => {
      if (section.value !== 'all' && section.value !== 'jobs') {
        result[section.value] = updates.filter(
          item => item.category === section.value
        ).length;
      }
    });

    return result;
  }, [jobs, updates, showClosed]);

  const showJobs =
    selectedSection === 'all' || selectedSection === 'jobs';

  const showUpdates = selectedSection !== 'jobs';

  const totalVisible =
    (showJobs ? visibleJobs.length : 0) +
    (showUpdates ? visibleUpdates.length : 0);

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f5f8fc',
      color: '#17324d',
    }}>

      {/* Header */}
      <header style={{
        background: '#102d49',
        color: '#fff',
        padding: '16px 5%',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px',
          flexWrap: 'wrap',
        }}>
          <Link href="/" style={{
            color: '#fff',
            textDecoration: 'none',
            fontSize: '23px',
            fontWeight: 800,
          }}>
            EduAxis <span style={{ color: '#35c69a' }}>India</span>
          </Link>

          <Link href="/" style={{
            color: '#fff',
            textDecoration: 'none',
            fontSize: '14px',
          }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(120deg, #123b5c, #176b55)',
        color: '#fff',
        padding: '42px 5%',
      }}>
        <div style={{ maxWidth: '1200px', margin: 'auto' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#a9e9d1',
            letterSpacing: '1px',
            marginBottom: '10px',
          }}>
            EDUAXIS INDIA · CAREER INFORMATION PORTAL
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            margin: '0 0 12px',
          }}>
            Government Jobs & Updates
          </h1>

          <p style={{
            maxWidth: '760px',
            lineHeight: 1.7,
            margin: 0,
            color: '#e0f2ec',
          }}>
            Find government vacancies, recruitment notices, admit cards,
            examination results, answer keys and syllabus updates from
            official sources.
          </p>

          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '22px',
          }}>
            {[
              ['Government Jobs', jobs.length],
              ['Career Updates', updates.length],
            ].map(([label, count]) => (
              <div key={String(label)} style={{
                background: 'rgba(255,255,255,.12)',
                border: '1px solid rgba(255,255,255,.18)',
                padding: '11px 17px',
                borderRadius: '9px',
              }}>
                <strong style={{ fontSize: '22px' }}>
                  {loading ? '...' : count}
                </strong>
                <div style={{ fontSize: '12px', color: '#d8eee7' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{
        maxWidth: '1200px',
        margin: 'auto',
        padding: '28px 5% 55px',
      }}>

        {/* Section filters */}
        <section style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e3eaf1',
          marginBottom: '22px',
        }}>
          <h2 style={{
            fontSize: '19px',
            margin: '0 0 15px',
          }}>
            Browse Government Jobs & Updates
          </h2>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '9px',
          }}>
            {sections.map(section => {
              const active = selectedSection === section.value;

              return (
                <button
                  key={section.value}
                  type="button"
                  onClick={() => setSelectedSection(section.value)}
                  style={{
                    border: active ? '1px solid #126b45' : '1px solid #dce5ed',
                    background: active ? '#126b45' : '#fff',
                    color: active ? '#fff' : '#29435b',
                    borderRadius: '7px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {section.label} ({counts[section.value] || 0})
                </button>
              );
            })}
          </div>
        </section>

        {/* Search and filters */}
        <section style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '22px',
        }}>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search jobs, exams or departments..."
            style={{
              flex: '1 1 280px',
              padding: '12px 14px',
              border: '1px solid #d5e0e9',
              borderRadius: '8px',
              fontSize: '14px',
              background: '#fff',
            }}
          />

          {selectedSection === 'jobs' && (
            <select
              value={jobCategory}
              onChange={event => setJobCategory(event.target.value)}
              style={{
                flex: '1 1 210px',
                padding: '12px',
                border: '1px solid #d5e0e9',
                borderRadius: '8px',
                background: '#fff',
                fontSize: '14px',
              }}
            >
              {jobCategories.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          )}

          {selectedSection === 'jobs' && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#52677d',
              fontSize: '13px',
            }}>
              <input
                type="checkbox"
                checked={showClosed}
                onChange={event => setShowClosed(event.target.checked)}
              />
              Show closed vacancies
            </label>
          )}
        </section>

        {/* Results heading */}
        <div style={{ marginBottom: '17px' }}>
          <h2 style={{ margin: 0, fontSize: '22px' }}>
            {sections.find(
              section => section.value === selectedSection
            )?.label}
          </h2>

          <p style={{
            margin: '6px 0 0',
            color: '#64748b',
            fontSize: '13px',
          }}>
            {loading ? 'Loading information...' : `${totalVisible} update(s) available`}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{
            background: '#fff',
            padding: '35px',
            textAlign: 'center',
            borderRadius: '10px',
            color: '#64748b',
          }}>
            Loading government jobs and career updates...
          </div>
        )}

        {/* Database errors */}
        {!loading && jobError && showJobs && (
          <div style={{
            background: '#fff0f0',
            color: '#b42318',
            padding: '15px',
            borderRadius: '9px',
            marginBottom: '12px',
          }}>
            {jobError}
          </div>
        )}

        {!loading && updateError && showUpdates && (
          <div style={{
            background: '#fff0f0',
            color: '#b42318',
            padding: '15px',
            borderRadius: '9px',
            marginBottom: '12px',
          }}>
            {updateError}
          </div>
        )}

        {/* Government job cards */}
        {!loading && showJobs && !jobError && visibleJobs.map(job => (
          <article
            key={job.id}
            style={{
              background: '#fff',
              border: '1px solid #e1e8ef',
              borderRadius: '11px',
              padding: '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(20, 45, 70, 0.035)',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: '1 1 400px' }}>
                <span style={{
                  color: '#126b45',
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  {job.job_category || 'Government Jobs'}
                  {job.state ? ` · ${job.state}` : ''}
                </span>

                <h3 style={{
                  fontSize: '19px',
                  lineHeight: 1.4,
                  margin: '7px 0',
                  color: '#17324d',
                }}>
                  {job.title}
                </h3>

                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#52677d',
                }}>
                  {job.organization || 'Recruiting organisation not specified'}
                  {job.post_name ? ` · ${job.post_name}` : ''}
                </p>
              </div>

              <span style={{
                background: job.status === 'closed' ? '#fff0f0' : '#e9f7f0',
                color: job.status === 'closed' ? '#ad3030' : '#087443',
                padding: '6px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                {job.status === 'closed' ? 'Application Closed' : 'Published'}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))',
              gap: '10px',
              margin: '18px 0',
            }}>
              {[
                ['Total Vacancies', job.vacancies || 'As per notification'],
                ['Qualification', job.qualification || 'As per notification'],
                ['Age Limit', job.age_limit || 'As per notification'],
                ['Application Fee', job.application_fee || 'As per notification'],
                ['Application Starts', formatDate(job.application_start_date)],
                ['Last Date', formatDate(job.last_date)],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: '#f5f8fc',
                  borderRadius: '7px',
                  padding: '11px',
                }}>
                  <div style={{
                    color: '#71869a',
                    fontSize: '10px',
                    fontWeight: 700,
                    marginBottom: '5px',
                  }}>
                    {label}
                  </div>
                  <div style={{
                    color: '#17324d',
                    fontSize: '13px',
                    fontWeight: 600,
                    overflowWrap: 'anywhere',
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              borderTop: '1px solid #edf1f5',
              paddingTop: '14px',
            }}>
              <span style={{ color: '#8293a2', fontSize: '11px' }}>
                Last verified: {formatVerified(job.last_verified_at)}
              </span>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}>
                {job.notification_url && (
                  <a
                    href={job.notification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#eaf2fa',
                      color: '#174a7c',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
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
                      background: '#f0f3f6',
                      color: '#34536e',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
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
                      background: '#126b45',
                      color: '#fff',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                    }}
                  >
                    Apply Online ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}

        {/* Career update cards */}
        {!loading && showUpdates && !updateError && visibleUpdates.map(item => (
          <article
            key={item.id}
            style={{
              background: '#fff',
              border: '1px solid #e1e8ef',
              borderRadius: '11px',
              padding: '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(20, 45, 70, 0.035)',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}>
              <span style={{
                color: '#126b45',
                background: '#e9f7f0',
                padding: '5px 9px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                {updateCategoryLabel(item.category)}
              </span>

              {item.notice_date && (
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {formatDate(item.notice_date)}
                </span>
              )}
            </div>

            <h3 style={{
              fontSize: '18px',
              lineHeight: 1.45,
              margin: '12px 0 8px',
              color: '#17324d',
            }}>
              {item.title}
            </h3>

            {(item.organization || item.exam_name) && (
              <p style={{
                margin: '0 0 8px',
                fontSize: '13px',
                color: '#52677d',
              }}>
                {item.organization}
                {item.organization && item.exam_name ? ' · ' : ''}
                {item.exam_name}
              </p>
            )}

{item.description && (
  <p style={{
    fontSize: '13px',
    color: '#52677d',
    lineHeight: 1.7,
    margin: '10px 0',
    whiteSpace: 'pre-line',
  }}>
    {item.description}
  </p>
)}

{(
  item.post_details ||
  item.vacancy_details ||
  item.age_limit_details ||
  item.educational_qualification ||
  item.eligibility_details ||
  item.application_fee ||
  item.application_start_date ||
  item.important_dates
) && (
  <div style={{
    background: '#f5f8fc',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '10px',
    fontSize: '13px',
    lineHeight: 1.8,
    color: '#52677d',
  }}>
    {item.post_details && (
      <div><b>Post Details:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.post_details}</span></div>
    )}

    {item.vacancy_details && (
      <div><b>Vacancy Details:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.vacancy_details}</span></div>
    )}

    {item.age_limit_details && (
      <div><b>Age Limit:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.age_limit_details}</span></div>
    )}

    {item.educational_qualification && (
      <div><b>Educational Qualification:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.educational_qualification}</span></div>
    )}

    {item.eligibility_details && (
      <div><b>Eligibility:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.eligibility_details}</span></div>
    )}

    {item.application_fee && (
      <div><b>Application Fee:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.application_fee}</span></div>
    )}

    {item.application_start_date && (
      <div><b>Application Start Date:</b> {formatDate(item.application_start_date)}</div>
    )}

    {item.important_dates && (
      <div><b>Important Dates:</b> <span style={{ whiteSpace: 'pre-line' }}>{item.important_dates}</span></div>
    )}
  </div>
)}

{(item.event_date || item.last_date) && (

                        <div style={{
                background: '#f5f8fc',
                borderRadius: '7px',
                padding: '10px',
                fontSize: '12px',
                lineHeight: 1.8,
                marginTop: '10px',
              }}>
                {item.event_date && (
                  <div>
                    <b>Exam / Event Date:</b> {formatDate(item.event_date)}
                  </div>
                )}

                {item.last_date && (
                  <div>
                    <b>Last Date:</b> {formatDate(item.last_date)}
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '15px',
            }}>
              {item.official_url && (
                <a
                  href={item.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#126b45',
                    color: '#fff',
                    textDecoration: 'none',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  Official Website ↗
                </a>
              )}

              {item.download_url && (
                <a
                  href={item.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#eaf1fb',
                    color: '#2457a6',
                    textDecoration: 'none',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {downloadButtonLabel(item.category)} ↗
                </a>
              )}
            </div>
          </article>
        ))}

        {/* Empty state */}
        {!loading && totalVisible === 0 && !jobError && !updateError && (
          <div style={{
            background: '#fff',
            border: '1px solid #e3eaf1',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
          }}>
            <h3 style={{ marginTop: 0, color: '#17324d' }}>
              No Updates Available
            </h3>

            <p style={{ color: '#64748b', marginBottom: 0 }}>
              No published information was found in this section.
              Please check again later.
            </p>
          </div>
        )}

        {/* Important notice */}
        <div style={{
          marginTop: '25px',
          padding: '17px',
          background: '#edf4f8',
          borderRadius: '10px',
          color: '#526b80',
          fontSize: '12px',
          lineHeight: 1.7,
        }}>
          <strong>Important notice:</strong> EduAxis India is an information
          platform and is not a government recruitment authority. Vacancy
          details, eligibility, fees and dates may change. Always read the
          official notification and verify information on the concerned
          organisation's website.
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        background: '#102d49',
        color: '#dce8f1',
        padding: '22px 5%',
        textAlign: 'center',
        fontSize: '13px',
      }}>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} EduAxis India. All Rights Reserved.
        </p>
        <p style={{ margin: '7px 0 0', color: '#a9bdce' }}>
          Learn. Prepare. Progress.
        </p>
      </footer>
    </main>
  );
}
