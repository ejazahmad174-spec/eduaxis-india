'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Material = {
  id: number;
  title: string;
  description: string | null;
  exam_category: string | null;
  subject: string | null;
  class_level: string | null;
  file_path: string;
  access_type: string;
  price: number | null;
  status: string;
  created_at: string;
};

const emptyForm = {
  title: '',
  description: '',
  category: 'Teaching Exams',
  subject: '',
  classLevel: '',
  accessType: 'free',
  price: '',
  status: 'draft',
};

export default function StudyMaterialsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFilePath, setEditingFilePath] = useState('');
  const [editingAccessType, setEditingAccessType] = useState('free');

  const [title, setTitle] = useState(emptyForm.title);
  const [description, setDescription] = useState(emptyForm.description);
  const [category, setCategory] = useState(emptyForm.category);
  const [subject, setSubject] = useState(emptyForm.subject);
  const [classLevel, setClassLevel] = useState(emptyForm.classLevel);
  const [accessType, setAccessType] = useState(emptyForm.accessType);
  const [price, setPrice] = useState(emptyForm.price);
  const [status, setStatus] = useState(emptyForm.status);
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
      .select('id,title,description,exam_category,subject,class_level,file_path,access_type,price,status,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage('Could not load materials: ' + error.message);
      return;
    }

    setMaterials((data || []) as Material[]);
  }

  function clearForm() {
    setTitle(emptyForm.title);
    setDescription(emptyForm.description);
    setCategory(emptyForm.category);
    setSubject(emptyForm.subject);
    setClassLevel(emptyForm.classLevel);
    setAccessType(emptyForm.accessType);
    setPrice(emptyForm.price);
    setStatus(emptyForm.status);
    setFile(null);
    setEditingId(null);
    setEditingFilePath('');
    setEditingAccessType('free');

    const fileInput = document.getElementById('material-pdf') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }

  function startEdit(item: Material) {
    setMessage('');
    setErrorMessage('');
    setEditingId(item.id);
    setEditingFilePath(item.file_path);
    setEditingAccessType(item.access_type);
    setTitle(item.title);
    setDescription(item.description || '');
    setCategory(item.exam_category || 'Teaching Exams');
    setSubject(item.subject || '');
    setClassLevel(item.class_level || '');
    setAccessType(item.access_type);
    setPrice(item.price == null ? '' : String(item.price));
    setStatus(item.status);
    setFile(null);

    const fileInput = document.getElementById('material-pdf') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (!title.trim()) {
      setErrorMessage('Please enter a title.');
      return;
    }

    if (!editingId && !file) {
      setErrorMessage('Please select a PDF file.');
      return;
    }

    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are allowed.');
      return;
    }

    if (file && file.size > 20 * 1024 * 1024) {
      setErrorMessage('The PDF must be 20 MB or smaller.');
      return;
    }

    const numericPrice = Number(price);
    if (accessType === 'paid' && (!price || !Number.isFinite(numericPrice) || numericPrice <= 0)) {
      setErrorMessage('Enter a valid price for paid material.');
      return;
    }

    if (editingId && accessType !== editingAccessType && !file) {
      setErrorMessage('If you change Free/Paid access, please also select a replacement PDF so it can be stored in the correct folder.');
      return;
    }

    setBusy(true);

    let uploadedBucket = '';
    let uploadedPath = '';

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      let finalFilePath = editingFilePath;

      if (file) {
        const bucket = accessType === 'free'
          ? 'free-study-materials'
          : 'premium-study-materials';

        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
        const newPath = `${user.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await client.storage
          .from(bucket)
          .upload(newPath, file, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedBucket = bucket;
        uploadedPath = newPath;
        finalFilePath = `${bucket}/${newPath}`;
      }

      const values = {
        title: title.trim(),
        description: description.trim(),
        exam_category: category,
        subject: subject.trim() || null,
        class_level: classLevel.trim() || null,
        file_path: finalFilePath,
        access_type: accessType,
        price: accessType === 'paid' ? numericPrice : 0,
        status,
      };

      if (editingId) {
        const { error } = await client
          .from('study_materials')
          .update(values)
          .eq('id', editingId);

        if (error) throw error;

        if (file && editingFilePath) {
          const slash = editingFilePath.indexOf('/');
          const oldBucket = editingFilePath.slice(0, slash);
          const oldPath = editingFilePath.slice(slash + 1);
          if (oldBucket && oldPath) {
            const { error: removeError } = await client.storage.from(oldBucket).remove([oldPath]);
            if (removeError) {
              setMessage('Material updated, but the old PDF could not be removed. Please remove the old file from Supabase Storage manually.');
            }
          }
        }

        if (!message) setMessage('Study material updated successfully.');
      } else {
        const { error } = await client
          .from('study_materials')
          .insert({
            ...values,
            created_by: user.id,
          });

        if (error) throw error;
        setMessage('Study material uploaded successfully.');
      }

      clearForm();
      await loadMaterials();
    } catch (err) {
      if (uploadedBucket && uploadedPath) {
        await client.storage.from(uploadedBucket).remove([uploadedPath]);
      }
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong while saving.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePublishing(item: Material) {
    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    const { error } = await client
      .from('study_materials')
      .update({ status: nextStatus })
      .eq('id', item.id);

    if (error) {
      setErrorMessage('Could not change publishing status: ' + error.message);
    } else {
      setMessage(nextStatus === 'published' ? 'Material published.' : 'Material moved back to Draft.');
      await loadMaterials();
    }
    setBusy(false);
  }

  async function deleteMaterial(item: Material) {
    const confirmed = window.confirm(
      `Delete "${item.title}" permanently? This will also attempt to delete its PDF file.`
    );
    if (!confirmed) return;

    const client = supabase;
    if (!client) return;

    setBusy(true);
    setMessage('');
    setErrorMessage('');

    const { error: deleteError } = await client
      .from('study_materials')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
      setErrorMessage('Could not delete the material: ' + deleteError.message);
      setBusy(false);
      return;
    }

    const slash = item.file_path.indexOf('/');
    const bucket = item.file_path.slice(0, slash);
    const path = item.file_path.slice(slash + 1);

    if (bucket && path) {
      const { error: storageError } = await client.storage.from(bucket).remove([path]);
      if (storageError) {
        setMessage('The material record was deleted, but its PDF file could not be removed. Please remove that file manually from Supabase Storage.');
      } else {
        setMessage('Material and PDF deleted successfully.');
      }
    } else {
      setMessage('Material record deleted. Its stored file path was not recognised.');
    }

    if (editingId === item.id) clearForm();
    await loadMaterials();
    setBusy(false);
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
    background: '#fff',
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600 as const,
    marginBottom: '7px',
    color: '#17324d',
  };

  const actionStyle = {
    border: 0,
    borderRadius: 6,
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 600 as const,
    margin: '2px',
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
        <a className="admin-side-link active" href="/admin/study-materials">▤ &nbsp; Study Materials</a>
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
          <h2>{editingId ? 'Edit study material' : 'Upload new study material'}</h2>
          <p style={{ color: '#647b91' }}>
            Add PDF notes, books, question papers and learning resources. You can also edit, publish, unpublish or delete existing materials below.
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
            maxWidth: 850,
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
              <label style={labelStyle} htmlFor="material-pdf">
                {editingId ? 'Replace PDF (optional; maximum 20 MB)' : 'Select PDF file * (Maximum 20 MB)'}
              </label>
              <input id="material-pdf" type="file" accept=".pdf,application/pdf"
                required={!editingId} style={inputStyle}
                onChange={e => setFile(e.target.files?.[0] || null)} />
              {editingId && (
                <p style={{ color: '#647b91', fontSize: 13, marginTop: 6 }}>
                  Leave this blank to keep the current PDF. If you change Free/Paid access, you must also upload a replacement PDF.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" disabled={busy} style={{
                background: '#102d49',
                color: '#fff',
                border: 0,
                padding: '15px 20px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
              }}>
                {busy ? 'Please wait…' : editingId ? 'Save Changes' : 'Save Study Material'}
              </button>

              {editingId && (
                <button type="button" disabled={busy} onClick={clearForm} style={{
                  background: '#e9eef3',
                  color: '#17324d',
                  border: 0,
                  padding: '15px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <section style={{ marginTop: 35, maxWidth: 1100 }}>
            <h2>Uploaded study materials</h2>
            {materials.length === 0 ? (
              <p style={{ color: '#647b91' }}>No study materials have been added yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dce5ec', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 850 }}>
                  <thead>
                    <tr>
                      {['Title', 'Exam category', 'Subject', 'Access', 'Price', 'Status', 'Actions'].map(x => (
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
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5', whiteSpace: 'nowrap' }}>
                          <button type="button" disabled={busy} onClick={() => startEdit(item)}
                            style={{ ...actionStyle, background: '#e8f1fb', color: '#174a7c' }}>
                            Edit
                          </button>
                          <button type="button" disabled={busy} onClick={() => togglePublishing(item)}
                            style={{ ...actionStyle, background: item.status === 'published' ? '#fff3df' : '#e5f8ef', color: item.status === 'published' ? '#8a5700' : '#087443' }}>
                            {item.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <button type="button" disabled={busy} onClick={() => deleteMaterial(item)}
                            style={{ ...actionStyle, background: '#fff0f0', color: '#bd2525' }}>
                            Delete
                          </button>
                        </td>
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
