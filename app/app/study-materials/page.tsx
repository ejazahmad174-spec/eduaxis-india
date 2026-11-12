'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Material = {
  id: string | number;
  title: string;
  description: string | null;
  exam_category: string | null;
  subject: string | null;
  class_level: string | null;
  access_type: string;
  file_path: string;
};

export default function StudyMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMaterials() {
      if (!supabase) {
        setError('Website connection is not configured.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('study_materials')
        .select('id, title, description, exam_category, subject, class_level, access_type, file_path')
        .eq('status', 'published')
        .eq('access_type', 'free')
        .order('created_at', { ascending: false });

      if (error) {
        setError('Unable to load study materials. Please try again later.');
      } else {
        setMaterials((data || []) as Material[]);
      }

      setLoading(false);
    }

    loadMaterials();
  }, []);

  const categories = useMemo(
    () => [
      'All Categories',
      ...Array.from(
        new Set(materials.map((item) => item.exam_category).filter(Boolean) as string[])
      ),
    ],
    [materials]
  );

  const filteredMaterials = materials.filter((item) => {
    const term = search.toLowerCase();

    const matchesSearch =
      item.title.toLowerCase().includes(term) ||
      (item.subject || '').toLowerCase().includes(term) ||
      (item.description || '').toLowerCase().includes(term) ||
      (item.class_level || '').toLowerCase().includes(term);

    const matchesCategory =
      category === 'All Categories' || item.exam_category === category;

    return matchesSearch && matchesCategory;
  });

  function downloadPdf(filePath: string) {
    if (!supabase) return;

    const bucket = 'free-study-materials';
    const storagePath = filePath.startsWith(`${bucket}/`)
      ? filePath.slice(bucket.length + 1)
      : filePath;

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7fb', color: '#142d49' }}>
      <header style={{ background: '#102d49', color: 'white', padding: '22px 6%' }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: 23, fontWeight: 800 }}>
          EduAxis India
        </Link>
        <p style={{ margin: '6px 0 0', color: '#b9d5e5' }}>
          Learn. Prepare. Progress.
        </p>
      </header>

      <section style={{ maxWidth: 1150, margin: 'auto', padding: '48px 22px' }}>
        <p style={{ color: '#009b9b', fontWeight: 700, letterSpacing: 2 }}>
          LEARNING RESOURCES
        </p>
        <h1 style={{ fontSize: 36, margin: '8px 0' }}>Study Materials</h1>
        <p style={{ color: '#64748b', fontSize: 17 }}>
          Find free notes, study guides and learning resources for your examination.
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          margin: '30px 0',
          background: 'white',
          padding: 18,
          borderRadius: 12,
          border: '1px solid #dce5ef'
        }}>
          <input
            type="search"
            placeholder="Search by title, subject or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: '1 1 280px',
              padding: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 15
            }}
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              flex: '0 1 240px',
              padding: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: 'white',
              fontSize: 15
            }}
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {loading && <p>Loading study materials...</p>}

        {error && (
          <p style={{ color: '#b91c1c', background: '#fee2e2', padding: 15, borderRadius: 8 }}>
            {error}
          </p>
        )}

        {!loading && !error && filteredMaterials.length === 0 && (
          <div style={{
            background: 'white',
            padding: 35,
            borderRadius: 12,
            textAlign: 'center',
            border: '1px solid #dce5ef'
          }}>
            <h2>No study materials available yet</h2>
            <p style={{ color: '#64748b' }}>
              Free study materials will appear here when they are published.
              Please check again soon.
            </p>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20
        }}>
          {filteredMaterials.map((item) => (
            <article key={item.id} style={{
              background: 'white',
              border: '1px solid #dce5ef',
              borderRadius: 12,
              padding: 22,
              boxShadow: '0 3px 12px rgba(15, 45, 73, 0.04)'
            }}>
              <span style={{
                display: 'inline-block',
                background: '#e0f5f2',
                color: '#087f75',
                padding: '5px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700
              }}>
                FREE PDF
              </span>

              <h2 style={{ fontSize: 20, margin: '15px 0 8px' }}>{item.title}</h2>

              <p style={{ color: '#64748b', lineHeight: 1.6 }}>
                {item.description || 'Study material for your preparation.'}
              </p>

              <p style={{ fontSize: 14, color: '#475569' }}>
                <b>Exam:</b> {item.exam_category || 'General'}
              </p>
              <p style={{ fontSize: 14, color: '#475569' }}>
                <b>Subject:</b> {item.subject || 'Not specified'}
              </p>
              <p style={{ fontSize: 14, color: '#475569' }}>
                <b>Level:</b> {item.class_level || 'Not specified'}
              </p>

              <button
                onClick={() => downloadPdf(item.file_path)}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: 13,
                  background: '#102d49',
                  color: 'white',
                  border: 0,
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Download PDF
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer style={{
        background: '#102d49',
        color: '#cbd5e1',
        textAlign: 'center',
        padding: 22
      }}>
        EduAxis India · Learn. Prepare. Progress.
      </footer>
    </main>
  );
}
