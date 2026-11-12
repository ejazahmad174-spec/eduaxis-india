'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

const categories = [
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
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
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

export default function GovernmentJobsPublicPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [stateFilter, setStateFilter] = useState('All States');
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      const client = supabase;
      if (!client) {
        if (active) {
          setErrorMessage('Job listings are temporarily unavailable. Please try again later.');
          setLoading(false);
        }
        return;
      }

      const { data, error } = await client
        .from('government_jobs')
        .select('id,title,organization,post_name,state,vacancies,qualification,application_fee,notification_url,apply_url,last_date,status,job_category,age_limit,application_start_date,official_website,last_verified_at,created_at')
        .in('status', ['published', 'closed'])
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        setErrorMessage('We could not load job notifications right now. Please try again later.');
      } else {
        setJobs((data || []) as Job[]);
      }
      setLoading(false);
    }

    loadJobs();
    return () => {
      active = false;
    };
  }, []);

  const states = useMemo(() => {
    const values = Array.from(
      new Set(jobs.map(job => job.state?.trim()).filter((value): value is string => Boolean(value)))
    ).sort((a, b) => a.localeCompare(b));
    return ['All States', ...values];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
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
        category === 'All Categories' || job.job_category === category;
      const matchesState =
        stateFilter === 'All States' || job.state === stateFilter;
      const matchesStatus = showClosed || job.status !== 'closed';

      return matchesSearch && matchesCategory && matchesState && matchesStatus;
    });
  }, [jobs, search, category, stateFilter, showClosed]);

  const openCount = jobs.filter(job => job.status === 'published').length;

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7fa', color: '#102d49' }}>
      <header style={{
        background: '#102d49',
        color: '#fff',
        padding: '18px 5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        flexWrap: 'wrap',
      }}>
        <Link href="/" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center',
            background: 'linear-gradient(135deg,#0b526d,#10a6a0)', color: '#fff', fontSize: 24, fontWeight: 800,
          }}>E</span>
          <span style={{ fontSize: 21, fontWeight: 800 }}>EduAxis <span style={{ color: '#35c7bf' }}>India</span></span>
        </Link>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 14 }}>
          <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link>
          <Link href="/study-materials" style={{ color: '#fff', textDecoration: 'none' }}>Study Materials</Link>
          <Link href="/government-jobs" style={{ color: '#35c7bf', textDecoration: 'none', fontWeight: 700 }}>Latest Government Jobs</Link>
        </nav>
      </header>

      <section style={{
        background: 'linear-gradient(120deg,#102d49,#164b68)',
        color: '#fff',
        padding: '54px 5% 48px',
      }}>
        <div style={{ maxWidth: 1150, margin: '0 auto' }}>
          <div style={{ color: '#53d1c8', fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 12 }}>
            EDUAXIS INDIA CAREER DESK
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,48px)', lineHeight: 1.12, margin: '0 0 14px' }}>
            Latest Government Jobs
          </h1>
          <p style={{ color: '#d8e6ef', fontSize: 17, maxWidth: 720, lineHeight: 1.7, margin: 0 }}>
            Explore government recruitment notifications across India. Check eligibility and important dates, then visit the official website to apply.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 25 }}>
            <div style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', padding: '12px 18px', borderRadius: 10 }}>
              <strong style={{ fontSize: 23 }}>{openCount}</strong>
              <div style={{ fontSize: 12, color: '#d8e6ef' }}>Published vacancies</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', padding: '12px 18px', borderRadius: 10 }}>
              <strong style={{ fontSize: 23 }}>{categories.length - 1}</strong>
              <div style={{ fontSize: 12, color: '#d8e6ef' }}>Job categories</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1150, margin: '0 auto', padding: '30px 5% 60px' }}>
        <div style={{
          background: '#fff', border: '1px solid #dce5ec', borderRadius: 14,
          padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12,
          boxShadow: '0 5px 20px rgba(16,45,73,.04)',
        }}>
          <input
            aria-label="Search jobs"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search job, organisation or qualification"
            style={{ width: '100%', padding: 13, border: '1px solid #d7e0e8', borderRadius: 8, fontSize: 14 }}
          />
          <select aria-label="Filter by category" value={category} onChange={event => setCategory(event.target.value)}
            style={{ width: '100%', padding: 13, border: '1px solid #d7e0e8', borderRadius: 8, background: '#fff', fontSize: 14 }}>
            {categories.map(item => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter by state" value={stateFilter} onChange={event => setStateFilter(event.target.value)}
            style={{ width: '100%', padding: 13, border: '1px solid #d7e0e8', borderRadius: 8, background: '#fff', fontSize: 14 }}>
            {states.map(item => <option key={item}>{item}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#526b80', fontSize: 14 }}>
            <input type="checkbox" checked={showClosed} onChange={event => setShowClosed(event.target.checked)} />
            Show closed vacancies
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '28px 0 16px' }}>
          <div>
            <h2 style={{ fontSize: 25, margin: 0 }}>Available Job Notifications</h2>
            <p style={{ color: '#647b91', margin: '6px 0 0', fontSize: 14 }}>
              {loading ? 'Loading vacancies…' : `${filteredJobs.length} notification${filteredJobs.length === 1 ? '' : 's'} found`}
            </p>
          </div>
          <span style={{ color: '#647b91', fontSize: 13 }}>Check official notices before applying.</span>
        </div>

        {loading && (
          <div style={{ background: '#fff', padding: 30, borderRadius: 12, border: '1px solid #dce5ec', color: '#647b91' }}>
            Loading government job notifications…
          </div>
        )}

        {!loading && errorMessage && (
          <div role="alert" style={{ background: '#fff0f0', padding: 18, borderRadius: 10, color: '#a52626' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && filteredJobs.length === 0 && (
          <div style={{ background: '#fff', padding: 35, borderRadius: 12, border: '1px solid #dce5ec', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>No job notifications found</h3>
            <p style={{ color: '#647b91', marginBottom: 0 }}>
              Try changing your search or filters. New notifications will appear here after they are published by EduAxis India.
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          {filteredJobs.map(job => (
            <article key={job.id} style={{
              background: '#fff', border: '1px solid #dce5ec', borderRadius: 14,
              padding: 22, boxShadow: '0 5px 18px rgba(16,45,73,.035)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 420px' }}>
                  <div style={{ color: '#0b918d', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {job.job_category || 'Government Jobs'} {job.state ? ` · ${job.state}` : ''}
                  </div>
                  <h3 style={{ fontSize: 22, lineHeight: 1.3, margin: '8px 0 5px' }}>{job.title}</h3>
                  <div style={{ color: '#647b91', fontSize: 14 }}>
                    {job.organization || 'Recruiting organisation not specified'}
                    {job.post_name ? ` · ${job.post_name}` : ''}
                  </div>
                </div>
                <span style={{
                  background: job.status === 'closed' ? '#fff0f0' : '#e5f8ef',
                  color: job.status === 'closed' ? '#ad3030' : '#087443',
                  padding: '7px 11px', borderRadius: 30, fontSize: 12, fontWeight: 700,
                }}>
                  {job.status === 'closed' ? 'Application Closed' : 'Published'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, margin: '20px 0' }}>
                {[
                  ['Total vacancies', job.vacancies || 'As per notification'],
                  ['Qualification', job.qualification || 'As per notification'],
                  ['Age limit', job.age_limit || 'As per notification'],
                  ['Application fee', job.application_fee || 'As per notification'],
                  ['Application starts', formatDate(job.application_start_date)],
                  ['Last date', formatDate(job.last_date)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#f5f8fa', borderRadius: 9, padding: 12 }}>
                    <div style={{ color: '#71869a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                    <div style={{ color: '#17324d', fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #edf1f5', paddingTop: 15 }}>
                <div style={{ color: '#8293a2', fontSize: 12 }}>
                  Last verified: {formatVerified(job.last_verified_at)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                  {job.notification_url && (
                    <a href={job.notification_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', background: '#eaf2fa', color: '#174a7c', padding: '10px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                      Official Notification ↗
                    </a>
                  )}
                  {job.official_website && (
                    <a href={job.official_website} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', background: '#f0f3f6', color: '#34536e', padding: '10px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                      Official Website ↗
                    </a>
                  )}
                  {job.apply_url && job.status !== 'closed' && (
                    <a href={job.apply_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', background: '#102d49', color: '#fff', padding: '10px 13px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                      Apply Online ↗
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 30, padding: 18, background: '#edf4f8', borderRadius: 12, color: '#526b80', fontSize: 13, lineHeight: 1.7 }}>
          <strong>Important notice:</strong> EduAxis India is an information platform and is not a government recruitment authority. Vacancy details, eligibility, fees and dates may change. Always read the official recruitment notification and verify details on the recruiting organisation's website before applying.
        </div>
      </section>

      <footer style={{ background: '#102d49', color: '#d8e6ef', padding: '25px 5%', textAlign: 'center', fontSize: 13 }}>
        © {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.
      </footer>
    </main>
  );
}
