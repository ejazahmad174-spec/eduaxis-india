
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StudentNavigation from '@/components/student/StudentNavigation';

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => void;
      prefill?: { email?: string };
      theme?: { color?: string };
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type Material = {
  id: string;
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
  const [message, setMessage] = useState('');
  const [purchasedMaterials, setPurchasedMaterials] = useState<string[]>([]);
  const [processingMaterial, setProcessingMaterial] = useState('');

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

      const [purchaseResult, paidOrderResult] = await Promise.all([
        supabase
          .from('study_material_purchases')
          .select('study_material_id,payment_order_id')
          .eq('user_id', user.id),
        supabase
          .from('study_material_payment_orders')
          .select('id,study_material_id')
          .eq('user_id', user.id)
          .eq('status', 'paid')
          .not('razorpay_payment_id', 'is', null),
      ]);

      if (!active) return;

      if (purchaseResult.error || paidOrderResult.error) {
        setError('Unable to load your premium PDF purchases. Please refresh the page.');
      } else {
        const paidOrderIds = new Set((paidOrderResult.data || []).map((item) => item.id));
        setPurchasedMaterials(
          (purchaseResult.data || [])
            .filter((item) => paidOrderIds.has(item.payment_order_id))
            .map((item) => item.study_material_id)
        );
      }

      setLoading(false);
    }

    loadMaterials();

    return () => {
      active = false;
    };
  }, [router]);

  async function purchaseMaterial(item: Material) {
    const client = supabase;
    if (!client || processingMaterial) return;

    setMessage('');
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      router.replace(`/student/login?next=${encodeURIComponent('/study-materials')}`);
      return;
    }

    if (purchasedMaterials.includes(item.id)) {
      setMessage('You have already purchased this PDF. Use the download button to access it.');
      return;
    }

    setProcessingMaterial(item.id);
    try {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Your login session has expired. Please log in again.');

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay Checkout. Please try again.');
      }

      const orderResponse = await fetch('/api/study-materials/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ materialId: item.id }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || 'Unable to start PDF checkout.');

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'EduAxis India',
        description: orderData.materialTitle || item.title,
        order_id: orderData.orderId,
        prefill: { email: authData.user.email || '' },
        theme: { color: '#174ea6' },
        handler: async (response) => {
          try {
            setMessage('Payment received. Verifying your payment...');
            const verifyResponse = await fetch('/api/study-materials/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.error ||
                'Payment verification is pending. Please refresh your purchase status or contact support.'
              );
            }
            setPurchasedMaterials((current) =>
              current.includes(item.id) ? current : [...current, item.id]
            );
            setMessage('Payment successful! Your premium PDF is now unlocked.');
          } catch (verifyError) {
            setMessage(
              verifyError instanceof Error
                ? verifyError.message
                : 'Payment verification failed. Please contact support.'
            );
          } finally {
            setProcessingMaterial('');
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingMaterial('');
            setMessage('Payment window closed. No PDF access was granted.');
          },
        },
      });

      checkout.open();
    } catch (purchaseError) {
      setMessage(
        purchaseError instanceof Error
          ? purchaseError.message
          : 'Unable to process your PDF purchase.'
      );
      setProcessingMaterial('');
    }
  }

  async function downloadPurchasedPdf(materialId: string) {
    const client = supabase;
    if (!client) return;
    try {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Please log in again to download this PDF.');

      const response = await fetch('/api/study-materials/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ materialId }),
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error || 'Unable to prepare your secure PDF download.');
      }
      window.location.assign(payload.signedUrl);
    } catch (downloadError) {
      setMessage(
        downloadError instanceof Error
          ? downloadError.message
          : 'Unable to download the premium PDF.'
      );
    }
  }

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
            {purchasedMaterials.includes(item.id) ? (
              <>
                <span className="premium-unlocked">✓ Purchased · Access available</span>
                <button
                  className="premium-download-button"
                  onClick={() => downloadPurchasedPdf(item.id)}
                >
                  ↓ Download Purchased PDF
                </button>
              </>
            ) : (
              <button
                className="premium-purchase-button"
                disabled={!!processingMaterial}
                onClick={() => purchaseMaterial(item)}
              >
                {processingMaterial === item.id ? 'Preparing checkout…' : 'Purchase Now'}
              </button>
            )}
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
      <StudentNavigation />


      <section className="study-container">
        <div className="study-heading">
          <label>LEARNING RESOURCES</label>
          <h1>Study Materials</h1>
          <p>
            Find free notes, study guides and premium learning
            resources for your examination.
          </p>
        </div>

        {message && <div className="study-message" role="status">{message}</div>}

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

        .premium-purchase-button,
        .premium-download-button {
          width: 100%;
          margin-top: 9px;
          padding: 12px 14px;
          border: 0;
          border-radius: 8px;
          background: #102d49;
          color: #fff;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .premium-purchase-button:disabled {
          opacity: .6;
          cursor: wait;
        }

        .premium-download-button {
          background: #087f75;
        }

        .premium-unlocked {
          color: #087443;
          font-weight: 750;
        }

        .study-message {
          margin: 0 0 20px;
          padding: 13px 15px;
          border: 1px solid #b9d9e8;
          border-radius: 9px;
          background: #edf7fb;
          color: #174a6e;
          font-size: 13px;
          line-height: 1.55;
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
      <style jsx global>{`
        /* MaterialCard is a nested render function, so its nodes need global
           selectors rather than the parent component's styled-jsx scope. */
        .material-card {
          background: #ffffff;
          border: 1px solid #dce5ef;
          border-radius: 13px;
          padding: 23px;
          box-shadow: 0 3px 12px rgba(15, 45, 73, 0.05);
          min-width: 0;
        }

        .material-card h3 {
          font-size: 20px;
          line-height: 1.35;
          color: #102d49;
          margin: 15px 0 8px;
          font-weight: 800;
        }

        .material-card p {
          color: #475569;
          font-size: 14px;
          line-height: 1.55;
          margin: 10px 0;
        }

        .material-card .material-description {
          color: #64748b;
          line-height: 1.6;
          min-height: 42px;
        }

        .material-card .free-badge,
        .material-card .premium-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 6px 11px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .35px;
          background: #e0f5f2;
          color: #087f75;
        }

        .material-card .premium-badge {
          background: #fff1d6;
          color: #946000;
        }

        .material-card .download-button,
        .material-card .premium-purchase-button,
        .material-card .premium-download-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 46px;
          margin-top: 12px;
          padding: 12px 16px;
          border: 0;
          border-radius: 9px;
          background: #102d49;
          color: #ffffff;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 5px 12px rgba(16, 45, 73, .13);
          transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
        }

        .material-card .download-button:hover,
        .material-card .premium-purchase-button:hover {
          background: #087f85;
          transform: translateY(-1px);
          box-shadow: 0 7px 15px rgba(8, 127, 133, .18);
        }

        .material-card .premium-download-button {
          background: #087f75;
        }

        .material-card .premium-download-button:hover {
          background: #066a62;
          transform: translateY(-1px);
        }

        .material-card .premium-purchase-button:disabled {
          opacity: .6;
          cursor: wait;
          transform: none;
        }

        .material-card .premium-action {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 18px;
          padding: 15px;
          border: 1px solid #f2dfb8;
          border-radius: 11px;
          background: #fff8e9;
          color: #946000;
        }

        .material-card .premium-action > strong {
          color: #102d49;
          font-size: 25px;
          font-weight: 900;
        }

        .material-card .premium-action span {
          font-size: 12px;
        }

        .material-card .premium-unlocked {
          color: #087443;
          font-weight: 800;
        }

        @media (max-width: 600px) {
          .material-card {
            padding: 18px;
          }
        }
      `}</style>

    </main>
  );
}
