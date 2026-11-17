
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
  { value: 'all', label: 'All Updates' },
  { value: 'recruitment_notice', label: 'Latest Recruitment Notices' },
  { value: 'admit_card', label: 'Admit Cards' },
  { value: 'result_answer_key', label: 'Results & Answer Keys' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'other_update', label: 'Other Updates' },
];

function formatDate(value: string | null) {
  if (!value) return '';

  const date = new Date(value + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
    default:
      return 'View / Download Details';
  }
}

export default function CareerUpdatesPage() {
  const [updates, setUpdates] = useState<CareerUpdate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadUpdates() {
      const client = supabase;

      if (!client) {
        setErrorMessage('Unable to connect. Please try again later.');
        setLoading(false);
        return;
      }

      const { data, error } = await client
        .from('career_updates')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMessage('Unable to load career updates. Please try again later.');
      } else {
        setUpdates((data || []) as CareerUpdate[]);
      }

      setLoading(false);
    }

    loadUpdates();
  }, []);

  const visibleUpdates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return updates.filter(item => {
      const matchesCategory =
        selectedCategory === 'all' ||
        item.category === selectedCategory;

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

      const matchesSearch = !term || searchableText.includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [updates, selectedCategory, search]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: updates.length };

    categories.forEach(category => {
      if (category.value !== 'all') {
        result[category.value] = updates.filter(
          item => item.category === category.value
        ).length;
      }
    });

    return result;
  }, [updates]);

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

      {/* Page heading */}
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
            CAREER INFORMATION PORTAL
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            margin: '0 0 12px',
          }}>
            Government Jobs & Career Updates
          </h1>

          <p style={{
            maxWidth: '700px',
            lineHeight: 1.7,
            margin: 0,
            color: '#e0f2ec',
          }}>
            Find the latest recruitment notices, admit cards, examination
            results, answer keys and syllabus updates from official sources.
          </p>
        </div>
      </section>

      <div style={{
        maxWidth: '1200px',
        margin: 'auto',
        padding: '28px 5% 55px',
      }}>
        {/* Category navigation */}
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
            Browse Career Updates
          </h2>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '9px',
          }}>
            {categories.map(category => {
              const active = selectedCategory === category.value;

              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setSelectedCategory(category.value)}
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
                  {category.label}
                  {' '}({counts[category.value] || 0})
                </button>
              );
            })}
          </div>
        </section>

        {/* Search and results heading */}
        <section style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '20px',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px' }}>
              {categories.find(
                item => item.value === selectedCategory
              )?.label}
            </h2>

            <p style={{
              margin: '6px 0 0',
              color: '#64748b',
              fontSize: '13px',
            }}>
              {visibleUpdates.length} update(s) available
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, exams or departments..."
            style={{
              width: 'min(100%, 340px)',
              padding: '12px 14px',
              border: '1px solid #d5e0e9',
              borderRadius: '8px',
              fontSize: '14px',
              background: '#fff',
            }}
          />
        </section>

        {/* Loading */}
        {loading && (
          <div style={{
            background: '#fff',
            padding: '35px',
            textAlign: 'center',
            borderRadius: '10px',
            color: '#64748b',
          }}>
            Loading latest career updates...
          </div>
        )}

        {/* Error */}
        {!loading && errorMessage && (
          <div style={{
            background: '#fff0f0',
            color: '#b42318',
            padding: '18px',
            borderRadius: '10px',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Empty state */}
        {!loading && !errorMessage && visibleUpdates.length === 0 && (
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
              No published updates were found in this category.
              Please check again later.
            </p>
          </div>
        )}

        {/* Update cards */}
        {!loading && !errorMessage && visibleUpdates.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
            gap: '16px',
          }}>
            {visibleUpdates.map(item => (
              <article
                key={item.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e1e8ef',
                  borderRadius: '11px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '11px',
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
                    {categories.find(
                      category => category.value === item.category
                    )?.label || 'Career Update'}
                  </span>

                  {item.notice_date && (
                    <span style={{
                      fontSize: '11px',
                      color: '#64748b',
                    }}>
                      {formatDate(item.notice_date)}
                    </span>
                  )}
                </div>

                <h3 style={{
                  fontSize: '18px',
                  lineHeight: 1.45,
                  margin: 0,
                  color: '#17324d',
                }}>
                  {item.title}
                </h3>

                {(item.organization || item.exam_name) && (
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#52677d',
                    lineHeight: 1.6,
                  }}>
                    {item.organization}
                    {item.organization && item.exam_name ? ' • ' : ''}
                    {item.exam_name}
                  </p>
                )}

                {item.state && (
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#64748b',
                  }}>
                    Region: {item.state}
                  </p>
                )}

                {item.description && (
                  <p style={{
                    fontSize: '13px',
                    color: '#52677d',
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: 'pre-line',
                  }}>
                    {item.description}
                  </p>
                )}

                {(item.event_date || item.last_date) && (
                  <div style={{
                    background: '#f5f8fc',
                    borderRadius: '7px',
                    padding: '10px',
                    fontSize: '12px',
                    lineHeight: 1.8,
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
                  marginTop: 'auto',
                  paddingTop: '8px',
                }}>
                  {item.official_url && (
                    <a
                      href={item.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        background: '#126b45',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '10px 13px',
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
                        display: 'inline-block',
                        background: '#eaf1fb',
                        color: '#2457a6',
                        textDecoration: 'none',
                        padding: '10px 13px',
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
          </div>
        )}
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
          Please verify important information through the official website
          of the concerned authority.
        </p>
      </footer>
    </main>
  );
}
