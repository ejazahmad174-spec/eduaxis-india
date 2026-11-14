
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Author = {
  id: string;
  user_id: string;
  full_name: string;
  designation: string | null;
  biography: string | null;
  status: string;
  created_at: string;
};

type Submission = {
  id: string;
  author_id: string;
  title: string;
  language: 'English' | 'Hindi' | 'Urdu';
  category: string | null;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  status: string;
  created_at: string;
};

export default function AuthorManagementPage() {
  const router = useRouter();

  const [authors, setAuthors] = useState<Author[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Submission | null>(null);
  const [notes, setNotes] = useState('');

  async function loadData() {
    if (!supabase) {
      setError('Admin service is unavailable.');
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.replace('/student/login');
      return;
    }

    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (adminError || adminProfile?.role !== 'admin') {
      router.replace('/student/login');
      return;
    }

    const [authorResult, submissionResult] = await Promise.all([
      supabase
        .from('author_profiles')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('author_submissions')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (authorResult.error) {
      setError('Unable to load author applications.');
    } else {
      setAuthors((authorResult.data || []) as Author[]);
    }

    if (submissionResult.error) {
      setError('Unable to load article submissions.');
    } else {
      setSubmissions((submissionResult.data || []) as Submission[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateAuthorStatus(author: Author, status: 'approved' | 'rejected') {
    if (!supabase) return;

    const action = status === 'approved' ? 'approve' : 'reject';

    if (!window.confirm(`Are you sure you want to ${action} ${author.full_name}?`)) {
      return;
    }

    setBusyId(author.id);
    setError('');
    setMessage('');

    const { error: updateError } = await supabase
      .from('author_profiles')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', author.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(`Author ${author.full_name} has been ${status}.`);
      await loadData();
    }

    setBusyId('');
  }

  async function reviewArticle(
    article: Submission,
    status: 'approved' | 'rejected'
  ) {
    if (!supabase) return;

    if (status === 'approved') {
      const author = authors.find((item) => item.id === article.author_id);

      if (!author || author.status !== 'approved') {
        setError('This article cannot be published because its author is not approved.');
        return;
      }

      if (!window.confirm('Publish this article on the public Educational Blog?')) {
        return;
      }
    } else {
      if (!window.confirm('Are you sure you want to reject this article?')) {
        return;
      }
    }

    setBusyId(article.id);
    setError('');
    setMessage('');

    try {
      if (status === 'approved') {
        const author = authors.find((item) => item.id === article.author_id);

        const baseSlug = article.title
          .normalize('NFKC')
          .toLowerCase()
          .trim()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 65);

        const slug = `${baseSlug || 'article'}-${article.id.slice(0, 8)}`;

        // First publish the article in the public blog table.
        const { error: publishError } = await supabase
          .from('blog_articles')
          .insert({
            title: article.title,
            slug,
            language: article.language,
            category: article.category,
            excerpt: article.excerpt,
            content: article.content,
            featured_image_url: article.featured_image_url,
            author_name: author?.full_name || 'EduAxis Contributor',
            status: 'published',
            is_featured: false,
            published_at: new Date().toISOString(),
          });

        if (publishError) throw publishError;
      }

      // Update the submission after successful publication,
      // or directly mark it rejected.
      const { error: reviewError } = await supabase
        .from('author_submissions')
        .update({
          status,
          admin_notes: notes.trim() || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      if (reviewError) {
        throw new Error(
          status === 'approved'
            ? 'The article was published, but its submission status could not be updated. Please contact technical support before trying again.'
            : reviewError.message
        );
      }

      setMessage(
        status === 'approved'
          ? 'Article published successfully on Educational Blogs.'
          : 'Article rejected successfully.'
      );

      setSelectedArticle(null);
      setNotes('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to process this article.');
    } finally {
      setBusyId('');
    }
  }

  const pendingAuthors = authors.filter((item) => item.status === 'pending');
  const pendingArticles = submissions.filter((item) => item.status === 'pending');

  function authorName(authorId: string) {
    return authors.find((item) => item.id === authorId)?.full_name || 'Unknown Author';
  }

  if (loading) {
    return <div className="adminPage">Loading author management...</div>;
  }

  return (
    <main className="adminPage authorManagement">
      <div className="pageHeader">
        <div>
          <h1>Author Management</h1>
          <p>Manage contributor applications and review submitted articles.</p>
        </div>

        <button onClick={() => router.push('/admin')}>
          ← Admin Dashboard
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice success">{message}</div>}

      <section className="summaryGrid">
        <div className="summaryCard">
          <span>Total Authors</span>
          <strong>{authors.length}</strong>
        </div>
        <div className="summaryCard">
          <span>Pending Applications</span>
          <strong>{pendingAuthors.length}</strong>
        </div>
        <div className="summaryCard">
          <span>Total Submissions</span>
          <strong>{submissions.length}</strong>
        </div>
        <div className="summaryCard">
          <span>Articles Awaiting Review</span>
          <strong>{pendingArticles.length}</strong>
        </div>
      </section>

      <section className="managementSection">
        <div className="sectionTitle">
          <div>
            <h2>Author Applications</h2>
            <p>Review and approve people who want to contribute.</p>
          </div>
          <span>{authors.length} applications</span>
        </div>

        {authors.length === 0 ? (
          <div className="emptyState">No author applications received yet.</div>
        ) : (
          <div className="recordList">
            {authors.map((author) => (
              <article className="recordCard" key={author.id}>
                <div className="recordInfo">
                  <h3>{author.full_name}</h3>
                  <p>{author.designation || 'Designation not provided'}</p>
                  {author.biography && <p>{author.biography}</p>}
                  <small>
                    Applied: {new Date(author.created_at).toLocaleDateString('en-IN')}
                  </small>
                </div>

                <div className="recordActions">
                  <span className={`status ${author.status}`}>
                    {author.status}
                  </span>

                  {author.status === 'pending' && (
                    <>
                      <button
                        className="approveButton"
                        disabled={busyId === author.id}
                        onClick={() => updateAuthorStatus(author, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="rejectButton"
                        disabled={busyId === author.id}
                        onClick={() => updateAuthorStatus(author, 'rejected')}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="managementSection">
        <div className="sectionTitle">
          <div>
            <h2>Article Submissions</h2>
            <p>Review articles before they appear on the public Blog.</p>
          </div>
          <span>{submissions.length} submissions</span>
        </div>

        {submissions.length === 0 ? (
          <div className="emptyState">No articles submitted yet.</div>
        ) : (
          <div className="recordList">
            {submissions.map((article) => (
              <article className="recordCard" key={article.id}>
                <div className="recordInfo">
                  <h3>{article.title}</h3>
                  <p>
                    {authorName(article.author_id)} · {article.language}
                    {article.category ? ` · ${article.category}` : ''}
                  </p>
                  <small>
                    Submitted: {new Date(article.created_at).toLocaleDateString('en-IN')}
                  </small>

                  <div>
                    <button
                      className="viewButton"
                      onClick={() => {
                        setSelectedArticle(article);
                        setNotes('');
                      }}
                    >
                      Read Article
                    </button>
                  </div>
                </div>

                <div className="recordActions">
                  <span className={`status ${article.status}`}>
                    {article.status}
                  </span>

                  {article.status === 'pending' && (
                    <>
                      <button
                        className="approveButton"
                        disabled={busyId === article.id}
                        onClick={() => reviewArticle(article, 'approved')}
                      >
                        Publish
                      </button>
                      <button
                        className="rejectButton"
                        disabled={busyId === article.id}
                        onClick={() => reviewArticle(article, 'rejected')}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedArticle && (
        <div className="modalBackdrop">
          <div className="articleModal">
            <button
              className="closeButton"
              onClick={() => setSelectedArticle(null)}
            >
              ×
            </button>

            <span className="modalLabel">
              {selectedArticle.language} · {selectedArticle.category || 'General'}
            </span>

            <h2>{selectedArticle.title}</h2>
            <p className="modalAuthor">
              By {authorName(selectedArticle.author_id)}
            </p>

            {selectedArticle.featured_image_url && (
              <img
                className="modalImage"
                src={selectedArticle.featured_image_url}
                alt={selectedArticle.title}
              />
            )}

            {selectedArticle.excerpt && (
              <p className="modalExcerpt">{selectedArticle.excerpt}</p>
            )}

            <div className="articleContent">
              {selectedArticle.content}
            </div>

            {selectedArticle.status === 'pending' && (
              <div className="reviewControls">
                <label>Admin Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Write internal review notes..."
                />

                <div className="modalActions">
                  <button
                    className="approveButton"
                    disabled={busyId === selectedArticle.id}
                    onClick={() => reviewArticle(selectedArticle, 'approved')}
                  >
                    Publish Article
                  </button>

                  <button
                    className="rejectButton"
                    disabled={busyId === selectedArticle.id}
                    onClick={() => reviewArticle(selectedArticle, 'rejected')}
                  >
                    Reject Article
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .authorManagement {
          padding-bottom: 60px;
        }

        .pageHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
        }

        .pageHeader h1 {
          margin: 0 0 7px;
          color: #102b46;
        }

        .pageHeader p,
        .sectionTitle p {
          margin: 0;
          color: #657789;
          font-size: 13px;
        }

        .pageHeader button {
          background: white;
          border: 1px solid #dce5e9;
          border-radius: 7px;
          padding: 10px 14px;
          cursor: pointer;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .summaryCard {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 10px;
          padding: 19px;
        }

        .summaryCard span {
          display: block;
          color: #657789;
          font-size: 12px;
        }

        .summaryCard strong {
          display: block;
          color: #102b46;
          font-size: 27px;
          margin-top: 8px;
        }

        .managementSection {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 12px;
          padding: 23px;
          margin-bottom: 25px;
        }

        .sectionTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .sectionTitle h2 {
          color: #102b46;
          margin: 0 0 6px;
          font-size: 20px;
        }

        .sectionTitle > span {
          color: #657789;
          font-size: 12px;
        }

        .recordList {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recordCard {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 17px;
          border: 1px solid #e2eaed;
          border-radius: 9px;
        }

        .recordInfo {
          min-width: 0;
        }

        .recordInfo h3 {
          margin: 0 0 6px;
          color: #102b46;
          font-size: 15px;
        }

        .recordInfo p {
          color: #657789;
          font-size: 12px;
          line-height: 1.6;
          margin: 4px 0;
        }

        .recordInfo small {
          color: #81909c;
          font-size: 11px;
        }

        .recordActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .recordActions button,
        .viewButton {
          border: 0;
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .approveButton {
          background: #e5f6ee;
          color: #187346;
        }

        .rejectButton {
          background: #fff0ef;
          color: #a52c25;
        }

        .viewButton {
          background: #edf4f7;
          color: #244a60;
          margin-top: 8px;
        }

        .recordActions button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .status {
          border-radius: 20px;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: capitalize;
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

        .emptyState {
          border: 1px dashed #cbd9df;
          padding: 30px;
          text-align: center;
          border-radius: 9px;
          color: #657789;
          font-size: 13px;
        }

        .notice {
          padding: 13px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .notice.error {
          background: #fff0ef;
          color: #a52c25;
        }

        .notice.success {
          background: #e8f7ef;
          color: #176b3b;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: #102b4688;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .articleModal {
          position: relative;
          background: white;
          border-radius: 13px;
          padding: 28px;
          width: 100%;
          max-width: 780px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .closeButton {
          position: absolute;
          right: 18px;
          top: 12px;
          border: 0;
          background: transparent;
          color: #657789;
          font-size: 29px;
          cursor: pointer;
        }

        .modalLabel {
          color: #18a5a0;
          font-size: 11px;
          font-weight: 700;
        }

        .articleModal h2 {
          color: #102b46;
          font-size: 25px;
          margin: 12px 35px 7px 0;
        }

        .modalAuthor {
          color: #657789;
          font-size: 12px;
        }

        .modalImage {
          display: block;
          width: 100%;
          max-height: 300px;
          object-fit: cover;
          border-radius: 9px;
          margin: 18px 0;
        }

        .modalExcerpt {
          color: #456579;
          font-weight: 600;
          line-height: 1.7;
        }

        .articleContent {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          color: #294357;
          font-size: 14px;
          line-height: 1.9;
          margin: 20px 0;
        }

        .reviewControls {
          border-top: 1px solid #e2eaed;
          padding-top: 18px;
        }

        .reviewControls label {
          display: block;
          color: #294357;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .reviewControls textarea {
          width: 100%;
          border: 1px solid #dce5e9;
          border-radius: 7px;
          padding: 12px;
          font: inherit;
          font-size: 13px;
        }

        .modalActions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .modalActions button {
          border: 0;
          border-radius: 7px;
          padding: 11px 15px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 760px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .recordCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .recordActions {
            justify-content: flex-start;
          }

          .pageHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .managementSection {
            padding: 16px;
          }
        }
      `}</style>
    </main>
  );
}
