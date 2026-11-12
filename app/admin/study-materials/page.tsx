
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Material = {
  id: number;
  title: string;
  exam_category: string | null;
  subject: string | null;
  access_type: string;
  price: number | null;
  status: string;
  created_at: string;
};

export default function StudyMaterialsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Teaching Exams');
  const [subject, setSubject] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [accessType, setAccessType] = useState('free');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('draft');
  const [file, setFile] = useState<File | null>(null);

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

      await loadMaterials();

      if (active) setLoading(false);
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function loadMaterials() {
    const client = supabase;
    if (!client) return;

    const { data, error } = await client
      .from('study_materials')
      .select('id,title,exam_category,subject,access_type,price,status,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Could not load materials: ' + error.message);
      return;
    }

    setMaterials((data || []) as Material[]);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setErrorMessage('');

    const client = supabase;

    if (!client) {
      setErrorMessage('Supabase connection is not configured.');
      return;
    }

    if (!file) {
      setErrorMessage('Please select a PDF file.');
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are allowed.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('The PDF must be 20 MB or smaller.');
      return;
    }

    const numericPrice = Number(price);

    if (accessType === 'paid' && (!price || !Number.isFinite(numericPrice) || numericPrice <= 0)) {
      setErrorMessage('Enter a valid price for paid material.');
      return;
    }

    setBusy(true);

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();

      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const bucket = accessType === 'free'
        ? 'free-study-materials'
        : 'premium-study-materials';

      const safeName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-');

      const filePath = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await client.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await client
        .from('study_materials')
        .insert({
          title: title.trim(),
          description: description.trim(),
          exam_category: category,
          subject: subject.trim() || null,
          class_level: classLevel.trim() || null,
          file_path: `${bucket}/${filePath}`,
          access_type: accessType,
          price: accessType === 'paid' ? numericPrice : 0,
          status,
          created_by: user.id
        });

      if (insertError) {
        await client.storage.from(bucket).remove([filePath]);
        throw insertError;
      }

      setMessage('Study material saved successfully.');
      setTitle('');
      setDescription('');
      setSubject('');
      setClassLevel('');
      setPrice('');
      setFile(null);

      const fileInput = document.getElementById('material-pdf') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      await loadMaterials();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong while uploading.'
      );
    } finally {
      setBusy(false);
    }
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
    background: '#fff'
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600 as const,
    marginBottom: '7px',
    color: '#17324d'
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
        <a className="admin-side-link active" href="/admin/study-materials">
          ▤ &nbsp; Study Materials
        </a>
        <a className="admin-side-link" href="/admin/dashboard">▤ &nbsp; Government Jobs</a>
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
            <h1>Study Materials</h1>
          </div>
          <a className="admin-logout" href="/admin/dashboard">Back to Dashboard</a>
        </header>

        <div style={{ padding: '25px 0' }}>
          <h2>Upload new study material</h2>
          <p style={{ color: '#647b91' }}>
            Add PDF notes, books, question papers and learning resources.
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
            maxWidth: 850
          }}>
            <div>
              <label style={labelStyle} htmlFor="material-title">PDF title *</label>
              <input id="material-title" style={inputStyle} required value={title}
                onChange={e => setTitle(e.target.value)} placeholder="e.g. BPSC TRE Commerce Notes" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-description">Description</label>
              <textarea id="material-description" style={{ ...inputStyle, minHeight: 90 }}
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Briefly describe this study material." />
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-category">Exam category *</label>
              <select id="material-category" style={inputStyle} value={category}
                onChange={e => setCategory(e.target.value)}>
                <option>Teaching Exams</option>
                <option>Competitive Exams</option>
                <option>CBSE Board</option>
                <option>State Board</option>
                <option>College Education</option>
                <option>Commerce</option>
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-subject">Subject</label>
              <input id="material-subject" style={inputStyle} value={subject}
                onChange={e => setSubject(e.target.value)} placeholder="e.g. Accountancy, Commerce, Mathematics" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-class">Class / Level</label>
              <input id="material-class" style={inputStyle} value={classLevel}
                onChange={e => setClassLevel(e.target.value)} placeholder="e.g. Class 12, Graduation, BPSC TRE" />
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-access">Access type *</label>
              <select id="material-access" style={inputStyle} value={accessType}
                onChange={e => setAccessType(e.target.value)}>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {accessType === 'paid' && (
              <div>
                <label style={labelStyle} htmlFor="material-price">Price in INR (₹) *</label>
                <input id="material-price" type="number" min="1" step="1"
                  style={inputStyle} required value={price}
                  onChange={e => setPrice(e.target.value)} placeholder="e.g. 99" />
              </div>
            )}

            <div>
              <label style={labelStyle} htmlFor="material-status">Publishing status</label>
              <select id="material-status" style={inputStyle} value={status}
                onChange={e => setStatus(e.target.value)}>
                <option value="draft">Save as Draft</option>
                <option value="published">Publish</option>
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-pdf">Select PDF file * (Maximum 20 MB)</label>
              <input id="material-pdf" type="file" accept=".pdf,application/pdf"
                required style={inputStyle} onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>

            <button type="submit" disabled={busy} style={{
              background: '#102d49',
              color: '#fff',
              border: 0,
              padding: '15px 20px',
              borderRadius: 8,
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer'
            }}>
              {busy ? 'Uploading and saving…' : 'Save Study Material'}
            </button>
          </form>

          <section style={{ marginTop: 35, maxWidth: 1000 }}>
            <h2>Uploaded study materials</h2>
            {materials.length === 0 ? (
              <p style={{ color: '#647b91' }}>No study materials have been added yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dce5ec', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      {['Title', 'Exam category', 'Subject', 'Access', 'Price', 'Status'].map(x => (
                        <th key={x} style={{ padding: 12, borderBottom: '1px solid #dce5ec' }}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map(item => (
                      <tr key={item.id}>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.title}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.exam_category || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.subject || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.access_type}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>
                          {item.access_type === 'paid' ? `₹${item.price}` : 'Free'}
                        </td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.status}</td>
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
