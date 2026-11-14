
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AuthorProfile = {
  id: string;
  full_name: string;
  designation: string | null;
  status: string;
};

type Submission = {
  id: string;
  title: string;
  language: string;
  category: string | null;
  status: string;
  created_at: string;
};

export default function AuthorDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<AuthorProfile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [category, setCategory] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  async function loadDashboard() {
    if (!supabase) {
      setError('Dashboard service is temporarily unavailable.');
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace('/author/login');
      return;
    }

    if (authData.user.user_metadata?.account_type !== 'author') {
      await supabase.auth.signOut();
      router.replace('/author/login');
      return;
    }

    const { data: author, error: profileError } = await supabase
      .from('author_profiles')
      .select('id, full_name, designation, status')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileError || !author) {
      setError('Your author profile could not be found. Please contact the administration team.');
      setLoading(false);
      return;
    }

    setProfile(author);

    if (author.status === 'approved') {
      const { data: articles, error: articlesError } = await supabase
        .from('author_submissions')
        .select('id, title, language, category, status, created_at')
        .eq('author_id', author.id)
        .order('created_at', { ascending: false });

      if (articlesError) {
        setError('Your submitted articles could not be loaded.');
      } else {
        setSubmissions((articles || []) as Submission[]);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!supabase || !profile) {
      setError('Unable to submit your article right now.');
      return;
    }

    if (profile.status !== 'approved') {
      setError('Your author account must be approved before submitting articles.');
      return;
    }

    if (content.trim().length < 100) {
      setError('Please write an article containing at least 100 characters.');
      return;
    }

    setSaving(true);

    try {
      const { error: submitError } = await supabase
        .from('author_submissions')
        .insert({
          author_id: profile.id,
          title: title.trim(),
          language,
          category: category.trim() || null,
          excerpt: excerpt.trim() || null,
          content: content.trim(),
          featured_image_url: imageUrl.trim() || null,
          status: 'pending',
        });

      if (submitError) throw submitError;

      setTitle('');
      setLanguage('English');
      setCategory('');
      setExcerpt('');
      setContent('');
      setImageUrl('');
      setShowEditor(false);
      setMessage('Your article has been submitted successfully for admin review.');

      await loadDashboard();
    } catch (err: any) {
      setError(err.message || 'Article submission failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/author/login');
  }

  if (loading) {
    return (
      <main className="authorDashboard">
        <div className="loading">Loading your author dashboard...</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="authorDashboard">
        <div className="dashboardCard">
          <h2>Author Dashboard</h2>
          <p>{error || 'Your author profile is unavailable.'}</p>
          <Link href="/author/login">Return to Author Login</Link>
        </div>
      </main>
    );
  }

  const pendingCount = submissions.filter(
    (item) => item.status === 'pending'
  ).length;

  const approvedCount = submissions.filter(
    (item) => item.status === 'approved'
  ).length;

  const rejectedCount = submissions.filter(
    (item) => item.status === 'rejected'
  ).length;

  return (
    <main className="authorDashboard">
      <header className="dashboardHeader">
        <Link href="/blogs" className="brand">
          <span className="brandIcon">E</span>
          <span>
            EduAxis <b>India</b>
            <small>AUTHOR PORTAL</small>
          </span>
        </Link>

        <div className="headerActions">
          <Link href="/blogs">View Blog</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboardWrap">
        <section className="welcome">
          <div>
            <span className="eyebrow">CONTRIBUTOR DASHBOARD</span>
            <h1>Welcome, {profile.full_name}</h1>
            <p>Share your knowledge and ideas with the EduAxis community.</p>
          </div>
          <span className="approvedBadge">Author Approved</span>
        </section>

        {error && <div className="errorMessage">{error}</div>}
        {message && <div className="successMessage">{message}</div>}

        <section className="stats">
          <div className="statCard">
            <small>Total Submissions</small>
            <strong>{submissions.length}</strong>
          </div>
          <div className="statCard">
            <small>Pending Review</small>
            <strong>{pendingCount}</strong>
          </div>
          <div className="statCard">
            <small>Approved</small>
            <strong>{approvedCount}</strong>
          </div>
          <div className="statCard">
            <small>Rejected</small>
            <strong>{rejectedCount}</strong>
          </div>
        </section>

        <section className="articleSection">
          <div className="sectionHeading">
            <div>
              <h2>My Articles</h2>
              <p>Manage and track your article submissions.</p>
            </div>

            <button
              className="primaryButton"
              onClick={() => {
                setShowEditor(!showEditor);
                setError('');
                setMessage('');
              }}
            >
              {showEditor ? 'Close Editor' : '+ Write New Article'}
            </button>
          </div>

          {showEditor && (
            <form className="editor" onSubmit={handleSubmit}>
              <h3>Submit a New Article</h3>

              <label>Article Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter your article title"
                required
              />

              <label>Article Language *</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>English</option>
                <option>Hindi</option>
                <option>Urdu</option>
              </select>

              <label>Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Education, Science, Career, Motivation"
              />

              <label>Short Summary</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Write a short introduction to your article"
                rows={3}
              />

              <label>Featured Image URL (Optional)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />

              <label>Full Article *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your complete article here..."
                rows={14}
                required
              />

              <p className="editorNote">
                Your article will be saved as a pending submission.
                It will not appear publicly until the administration approves it.
              </p>

              <button
                type="submit"
                className="primaryButton submitButton"
                disabled={saving}
              >
                {saving ? 'Submitting...' : 'Submit Article for Review →'}
              </button>
            </form>
          )}

          {submissions.length === 0 ? (
            <div className="emptyState">
              <span>📝</span>
              <h3>No articles submitted yet</h3>
              <p>Start sharing your knowledge by writing your first article.</p>
            </div>
          ) : (
            <div className="submissionList">
              {submissions.map((article) => (
                <article className="submissionCard" key={article.id}>
                  <div>
                    <h3>{article.title}</h3>
                    <p>
                      {article.language}
                      {article.category ? ` · ${article.category}` : ''}
                    </p>
                    <small>
                      Submitted: {new Date(article.created_at).toLocaleDateString('en-IN')}
                    </small>
                  </div>

                  <span className={`status ${article.status}`}>
                    {article.status}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .authorDashboard {
          min-height: 100vh;
          background: #f3f7f8;
          color: #172b3d;
        }

        .dashboardHeader {
          background: white;
          border-bottom: 1px solid #e2eaed;
          padding: 15px max(20px, calc((100% - 1180px) / 2));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          text-decoration: none;
          color: #102b46;
          font-size: 20px;
          font-weight: 700;
        }

        .brandIcon {
          width: 42px;
          height: 42px;
          border-radius: 9px;
          background: #102b46;
          color: white;
          display: grid;
          place-items: center;
        }

        .brand small {
          display: block;
          color: #18a5a0;
          font-size: 9px;
          letter-spacing: 1px;
          margin-top: 3px;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .headerActions a {
          color: #18a5a0;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .headerActions button {
          border: 1px solid #dce5e9;
          background: white;
          padding: 9px 14px;
          border-radius: 7px;
          cursor: pointer;
          color: #102b46;
        }

        .dashboardWrap {
          max-width: 1180px;
          width: calc(100% - 40px);
          margin: 0 auto;
          padding: 45px 0 70px;
        }

        .welcome {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        .eyebrow {
          color: #18a5a0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        h1 {
          color: #102b46;
          font-size: 32px;
          margin: 9px 0;
        }

        .welcome p {
          color: #657789;
          font-size: 14px;
          margin: 0;
        }

        .approvedBadge {
          background: #e5f6ee;
          color: #187346;
          border-radius: 30px;
          padding: 9px 15px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 35px;
        }

        .statCard {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 11px;
          padding: 20px;
        }

        .statCard small {
          display: block;
          color: #657789;
          font-size: 12px;
        }

        .statCard strong {
          display: block;
          color: #102b46;
          font-size: 28px;
          margin-top: 8px;
        }

        .articleSection {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 13px;
          padding: 25px;
        }

        .sectionHeading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 22px;
        }

        .sectionHeading h2 {
          color: #102b46;
          font-size: 22px;
          margin: 0 0 6px;
        }

        .sectionHeading p {
          color: #657789;
          font-size: 13px;
          margin: 0;
        }

        .primaryButton {
          border: 0;
          border-radius: 8px;
          background: #102b46;
          color: white;
          padding: 12px 17px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .primaryButton:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .editor {
          border: 1px solid #dfe9ec;
          border-radius: 10px;
          padding: 22px;
          margin-bottom: 25px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #fbfdfd;
        }

        .editor h3 {
          color: #102b46;
          margin: 0 0 10px;
          font-size: 19px;
        }

        .editor label {
          font-size: 13px;
          font-weight: 700;
          color: #294357;
          margin-top: 7px;
        }

        .editor input,
        .editor select,
        .editor textarea {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #dce5e9;
          border-radius: 7px;
          background: white;
          color: #172b3d;
          font: inherit;
          font-size: 14px;
          outline: none;
        }

        .editor input:focus,
        .editor select:focus,
        .editor textarea:focus {
          border-color: #18a5a0;
        }

        .editor textarea {
          resize: vertical;
          line-height: 1.7;
        }

        .editorNote {
          background: #edf6f5;
          color: #456579;
          border-radius: 7px;
          padding: 12px;
          font-size: 12px;
          line-height: 1.6;
        }

        .submitButton {
          align-self: flex-start;
          margin-top: 5px;
        }

        .emptyState {
          text-align: center;
          border: 1px dashed #cbd9df;
          border-radius: 10px;
          padding: 45px 15px;
        }

        .emptyState span {
          font-size: 35px;
        }

        .emptyState h3 {
          color: #102b46;
          margin: 10px 0 5px;
        }

        .emptyState p {
          color: #657789;
          font-size: 13px;
        }

        .submissionList {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .submissionCard {
          border: 1px solid #e2eaed;
          border-radius: 9px;
          padding: 17px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .submissionCard h3 {
          color: #102b46;
          font-size: 15px;
          margin: 0 0 6px;
        }

        .submissionCard p,
        .submissionCard small {
          color: #657789;
          font-size: 12px;
          margin: 4px 0;
        }

        .status {
          padding: 7px 11px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .status.pending {
          background: #fff5df;
          color: #9a6800;
        }

        .status.approved {
          background: #e5f6ee;
          color: #187346;
        }

        .status.rejected {
          background: #fff0ef;
          color: #a52c25;
        }

        .errorMessage,
        .successMessage {
          border-radius: 8px;
          padding: 13px;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.6;
        }

        .errorMessage {
          background: #fff0ef;
          color: #a52c25;
        }

        .successMessage {
          background: #e8f7ef;
          color: #176b3b;
        }

        .loading {
          text-align: center;
          padding: 80px 20px;
          color: #657789;
        }

        .dashboardCard {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 550px;
          margin: 60px auto;
        }

        @media (max-width: 700px) {
          .dashboardWrap {
            width: calc(100% - 28px);
            padding-top: 30px;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .welcome {
            align-items: flex-start;
            flex-direction: column;
          }

          .sectionHeading {
            align-items: flex-start;
            flex-direction: column;
          }

          .articleSection {
            padding: 17px;
          }

          .submissionCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboardHeader {
            padding: 13px 15px;
          }

          .brand {
            font-size: 17px;
          }
        }
      `}</style>
    </main>
  );
}
