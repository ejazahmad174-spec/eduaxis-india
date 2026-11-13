
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Material = {
  id: string | number;
  title: string;
  description: string | null;
  exam_category: string | null;
  subject: string | null;
  class_level: string | null;
  access_type: string;
  file_path?: string;
  price?: number | null;
};

export default function StudyMaterialsPage() {
  const router = useRouter();

  const [freeMaterials, setFreeMaterials] = useState<Material[]>([]);
  const [premiumMaterials, setPremiumMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadMaterials() {
      if (!supabase) {
        setError('Website connection is not configured.');
        setLoading(false);
        return;
      }

      // Check student authentication before loading any materials.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace(
          `/student/login?next=${encodeURIComponent('/study-materials')}`
        );
        return;
      }

      const [freeResult, premiumResult] = await Promise.all([
        supabase
          .from('study_materials')
          .select('id, title, description, exam_category, subject, class_level, access_type, file_path')
          .eq('status', 'published')
          .eq('access_type', 'free')
          .order('created_at', { ascending: false }),

        supabase
          .from('study_materials')
          .select('id, title, description, exam_category, subject, class_level, access_type, price')
          .eq('status', 'published')
          .eq('access_type', 'paid')
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      if (freeResult.error || premiumResult.error) {
        setError('Unable to load study materials. Please try again later.');
      } else {
        setFreeMaterials((freeResult.data || []) as Material[]);
        setPremiumMaterials((premiumResult.data || []) as Material[]);
      }

      setLoading(false);
    }

    loadMaterials();

    return () => {
      active = false;
    };
  }, [router]);

  const allMaterials = [...freeMaterials, ...premiumMaterials];

  const categories = useMemo(
    () => [
      'All Categories',
      ...Array.from(
        new Set(
          allMaterials
            .map((item) => item.exam_category)
            .filter(Boolean) as string[]
        )
      ),
    ],
    [freeMaterials, premiumMaterials]
  );

  function filterMaterials(items: Material[]) {
    const term = search.toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(term) ||
        (item.subject || '').toLowerCase().includes(term) ||
        (item.description || '').toLowerCase().includes(term) ||
        (item.class_level || '').toLowerCase().includes(term);

      const matchesCategory =
        category === 'All Categories' ||
        item.exam_category === category;

      return matchesSearch && matchesCategory;
    });
  }

  const filteredFree = filterMaterials(freeMaterials);
  const filteredPremium = filterMaterials(premiumMaterials);

  function downloadPdf(filePath?: string) {
    if (!supabase || !filePath) {
      alert('PDF file path is unavailable.');
      return;
    }

    const bucket = 'free-study-materials';

    const storagePath = filePath.startsWith(`${bucket}/`)
      ? filePath.slice(bucket.length + 1)
      : filePath;

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  }

  function MaterialCard({
    item,
    premium = false,
  }: {
    item: Material;
    premium?: boolean;
  }) {
    return (
      <article className="material-card">
        <span className={premium ? 'premium-badge' : 'free-badge'}>
          {premium ? 'PREMIUM MATERIAL' : 'FREE PDF'}
        </span>

        <h3>{item.title}</h3>

        <p className="material-description">
          {item.description || 'Study material for your preparation.'}
        </p>

        <p><b>Exam:</b> {item.exam_category || 'General'}</p>
        <p><b>Subject:</b> {item.subject || 'Not specified'}</p>
        <p><b>Level:</b> {item.class_level || 'Not specified'}</p>

        {premium ? (
          <div className="premium-action">
            <strong>
              {item.price && item.price > 0
                ? `₹${item.price}`
                : 'Premium access'}
            </strong>
            <span>Online purchase will be available soon.</span>
          </div>
        ) : (
          <button
            className="download-button"
            onClick={() => downloadPdf(item.file_path)}
          >
            <span>↓</span> Download Free PDF
          </button>
        )}
      </article>
    );
  }

  return (
    <main className="study-page">
      <header className="study-header">
        <div className="study-header-inner">
          <Link href="/" className="study-brand">
            <span className="study-logo">E</span>
            <span>
              <strong>EduAxis <b>India</b></strong>
              <small>LEARN. PREPARE. PROGRESS.</small>
            </span>
          </Link>

          <Link href="/" className="home-link">Home</Link>
        </div>
      </header>

      <section className="study-container">
        <div className="study-heading">
          <label>LEARNING RESOURCES</label>
          <h1>Study Materials</h1>
          <p>
            Find free notes, study guides and premium learning
            resources for your examination.
          </p>
        </div>

        <div className="study-filters">
          <input
            type="search"
            placeholder="Search by title, subject or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="empty-state">Checking login and loading study materials...</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {!loading && !error && (
          <>
            <section className="material-section">
              <div className="material-section-heading">
                <div>
                  <label>OPEN LEARNING RESOURCES</label>
                  <h2>Free PDF Materials</h2>
                  <p>Download notes, books and study guides without paying.</p>
                </div>
                <span className="section-count">
                  {filteredFree.length} Resources
                </span>
              </div>

              {filteredFree.length === 0 ? (
                <div className="empty-state">
                  <h3>No free PDFs found</h3>
                  <p>
                    Free published study materials will appear here.
                    Try another search or category.
                  </p>
                </div>
              ) : (
                <div className="materials-grid">
                  {filteredFree.map((item) => (
                    <MaterialCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            <section className="material-section premium-section">
              <div className="material-section-heading">
                <div>
                  <label>EXCLUSIVE LEARNING RESOURCES</label>
                  <h2>Premium Study Materials</h2>
                  <p>
                    Detailed notes, comprehensive guides and
                    exam-focused preparation resources.
                  </p>
                </div>
                <span className="premium-section-count">
                  {filteredPremium.length} Resources
                </span>
              </div>

              {filteredPremium.length === 0 ? (
                <div className="empty-state">
                  <h3>Premium materials coming soon</h3>
                  <p>
                    Our premium study resources will be listed here
                    when they are published.
                  </p>
                </div>
              ) : (
                <div className="materials-grid">
                  {filteredPremium.map((item) => (
                    <MaterialCard
                      key={item.id}
                      item={item}
                      premium
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <footer className="study-footer">
        <strong>EduAxis India</strong>
        <p>Learn. Prepare. Progress.</p>
        <small>© {new Date().getFullYear()} EduAxis India. All rights reserved.</small>
      </footer>

      <style jsx>{`
        .study-page {
          min-height: 100vh;
          background: #f4f7fb;
          color: #142d49;
        }

        .study-header {
          background: #102d49;
          padding: 15px 5%;
          color: white;
        }

        .study-header-inner {
          max-width: 1200px;
          margin: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .study-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          color: white;
          text-decoration: none;
        }

        .study-logo {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #102d49, #18a5a0);
          font-size: 25px;
          font-weight: 800;
        }

        .study-brand strong {
          display: block;
          font-size: 20px;
        }

        .study-brand strong b {
          color: #35c4b6;
        }

        .study-brand small {
          display: block;
          font-size: 9px;
          letter-spacing: 1.3px;
          color: #bdd0df;
          margin-top: 3px;
        }

        .home-link {
          color: white;
          text-decoration: none;
          font-size: 14px;
        }

        .study-container {
          max-width: 1200px;
          margin: auto;
          padding: 55px 24px 70px;
        }

        .study-heading label,
        .material-section-heading label {
          color: #009b9b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .study-heading h1 {
          color: #102d49;
          font-size: clamp(30px, 4vw, 42px);
          margin: 10px 0;
        }

        .study-heading p,
        .material-section-heading p {
          color: #64748b;
          line-height: 1.7;
        }

        .study-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 30px 0 45px;
          padding: 17px;
          background: white;
          border: 1px solid #dce5ef;
          border-radius: 12px;
        }

        .study-filters input {
          flex: 1 1 280px;
          min-width: 0;
        }

        .study-filters select {
          flex: 0 1 240px;
        }

        .study-filters input,
        .study-filters select {
          padding: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          font-size: 15px;
          color: #142d49;
        }

        .material-section {
          margin-bottom: 55px;
        }

        .material-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 22px;
        }

        .material-section-heading h2 {
          font-size: 27px;
          color: #102d49;
          margin: 8px 0;
        }

        .section-count,
        .premium-section-count {
          white-space: nowrap;
          padding: 9px 13px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          background: #e0f5f2;
          color: #087f75;
        }

        .premium-section-count {
          background: #fff1d6;
          color: #946000;
        }

        .materials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
          gap: 20px;
        }

        .material-card,
        .empty-state {
          background: white;
          border: 1px solid #dce5ef;
          border-radius: 13px;
          padding: 23px;
          box-shadow: 0 3px 12px rgba(15, 45, 73, 0.04);
        }

        .free-badge,
        .premium-badge {
          display: inline-block;
          padding: 6px 11px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          background: #e0f5f2;
          color: #087f75;
        }

        .premium-badge {
          background: #fff1d6;
          color: #946000;
        }

        .material-card h3 {
          font-size: 20px;
          color: #102d49;
          margin: 15px 0 8px;
        }

        .material-description {
          color: #64748b;
          line-height: 1.6;
          min-height: 42px;
        }

        .material-card p {
          color: #475569;
          font-size: 14px;
          line-height: 1.5;
        }

        .download-button {
          width: 100%;
          margin-top: 12px;
          padding: 14px;
          background: #102d49;
          color: white;
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          font-size: 14px;
        }

        .download-button:hover {
          background: #087f85;
        }

        .premium-action {
          margin-top: 18px;
          padding: 14px;
          border-radius: 9px;
          background: #fff8e9;
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #946000;
        }

        .premium-action span {
          font-size: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 35px 20px;
        }

        .empty-state h3 {
          color: #102d49;
        }

        .empty-state p {
          color: #64748b;
          line-height: 1.6;
        }

        .error-state {
          padding: 15px;
          color: #b91c1c;
          background: #fee2e2;
          border-radius: 8px;
        }

        .study-footer {
          background: #102d49;
          color: #dce8ef;
          text-align: center;
          padding: 30px 15px;
        }

        .study-footer p,
        .study-footer small {
          color: #b9d5e5;
        }

        @media (max-width: 600px) {
          .study-container {
            padding: 35px 16px 50px;
          }

          .material-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .study-filters select {
            flex: 1 1 100%;
          }

          .materials-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
