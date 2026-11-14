
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type BlogArticle = {
  id: string;
  title: string;
  slug: string;
  language: 'English' | 'Hindi' | 'Urdu';
  category: string | null;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  author_name: string | null;
  status: 'draft' | 'published';
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
};

const emptyForm = {
  title: '',
  language: 'English' as 'English' | 'Hindi' | 'Urdu',
  category: '',
  excerpt: '',
  content: '',
  featured_image_url: '',
  author_name: 'EduAxis India Editorial Team',
  status: 'draft' as 'draft' | 'published',
  is_featured: false,
};

function createSlug(title: string) {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

export default function AdminBlogsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState(emptyForm);

  async function loadArticles() {
    if (!supabase) return;

    const { data, error: loadError } = await supabase
      .from('blog_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (loadError) {
      setError('Could not load articles. Please check Supabase permissions.');
      return;
    }

    setArticles((data || []) as BlogArticle[]);
  }

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      if (!supabase) {
        router.replace('/admin/login');
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/admin/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin') {
        await supabase.auth.signOut();
        router.replace('/admin/login');
        return;
      }

      if (!active) return;

      setEmail(user.email || 'Administrator');
      await loadArticles();

      if (active) setLoading(false);
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  function updateForm(
    field: keyof typeof emptyForm,
    value: string | boolean
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openNewArticle() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    setShowEditor(true);
  }

  function openEditArticle(article: BlogArticle) {
    setEditingId(article.id);

    setForm({
      title: article.title,
      language: article.language,
      category: article.category || '',
      excerpt: article.excerpt || '',
      content: article.content,
      featured_image_url: article.featured_image_url || '',
      author_name: article.author_name || 'EduAxis India Editorial Team',
      status: article.status,
      is_featured: article.is_featured,
    });

    setError('');
    setNotice('');
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveArticle(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!supabase || saving) return;

    setSaving(true);
    setError('');
    setNotice('');

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title || !content) {
      setError('Please enter both the article title and content.');
      setSaving(false);
      return;
    }

    const slug = createSlug(title);

    if (!slug) {
      setError('Please enter a valid article title.');
      setSaving(false);
      return;
    }

    const articleData = {
      title,
      slug,
      language: form.language,
      category: form.category.trim() || null,
      excerpt: form.excerpt.trim() || null,
      content,
      featured_image_url: form.featured_image_url.trim() || null,
      author_name: form.author_name.trim() || 'EduAxis India Editorial Team',
      status: form.status,
      is_featured: form.is_featured,
      published_at:
        form.status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (editingId) {
      result = await supabase
        .from('blog_articles')
        .update(articleData)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('blog_articles')
        .insert(articleData);
    }

    if (result.error) {
      setError(
        result.error.code === '23505'
          ? 'An article with this URL already exists. Please change the title slightly.'
          : result.error.message
      );
      setSaving(false);
      return;
    }

    await loadArticles();

    setNotice(
      form.status === 'published'
        ? 'Article published successfully.'
        : 'Article saved as draft successfully.'
    );

    setShowEditor(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
  }

  async function deleteArticle(article: BlogArticle) {
    if (!supabase) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${article.title}"?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('blog_articles')
      .delete()
      .eq('id', article.id);

    if (deleteError) {
      setError('Could not delete this article: ' + deleteError.message);
      return;
    }

    setArticles((previous) =>
      previous.filter((item) => item.id !== article.id)
    );

    setNotice('Article deleted successfully.');
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace('/admin/login');
    router.refresh();
  }

  const filteredArticles = articles.filter((article) => {
    if (filter === 'all') return true;
    if (filter === 'published') return article.status === 'published';
    if (filter === 'draft') return article.status === 'draft';
    return article.language === filter;
  });

  const publishedCount = articles.filter(
    (item) => item.status === 'published'
  ).length;

  const draftCount = articles.filter(
    (item) => item.status === 'draft'
  ).length;

  if (loading) {
    return (
      <main className="admin-loading">
        Checking administrator access...
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span className="admin-brand-mark">E</span>
          <span>
            EduAxis <b>India</b>
            <small>ADMINISTRATION</small>
          </span>
        </a>

        <div className="admin-side-label">WORKSPACE</div>

        <a className="admin-side-link" href="/admin/dashboard">
          ▦ &nbsp; Dashboard
        </a>

        <div className="admin-side-label">CONTENT MANAGEMENT</div>

        <a className="admin-side-link" href="/admin/study-materials">
          ▤ &nbsp; Study Materials
        </a>

        <a className="admin-side-link" href="/admin/government-jobs">
          ▤ &nbsp; Government Jobs
        </a>

        <a className="admin-side-link" href="/admin/mock-tests">
          ▤ &nbsp; Mock Tests
        </a>

        <a className="admin-side-link active" href="/admin/blogs">
          ▤ &nbsp; Educational Blogs
        </a>

        <div className="admin-sidebar-bottom">
          <a href="/">← View public website</a>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / CONTENT</div>
            <h1>Blog Management</h1>
          </div>

          <div className="admin-user">
            <span className="admin-avatar">A</span>
            <span>
              <b>Administrator</b>
              <small>{email}</small>
            </span>
            <button onClick={signOut} className="admin-logout">
              Sign out
            </button>
          </div>
        </header>

        <div className="admin-welcome">
          <div>
            <h2>Manage your educational articles</h2>
            <p>
              Create and publish articles in English, Hindi and Urdu.
            </p>
          </div>

          <button className="blogPrimaryButton" onClick={openNewArticle}>
            + Write New Article
          </button>
        </div>

        {notice && <div className="blogSuccess">{notice}</div>}
        {error && <div className="blogError">{error}</div>}

        <div className="blogAdminStats">
          <article>
            <span>Total Articles</span>
            <strong>{articles.length}</strong>
          </article>
          <article>
            <span>Published</span>
            <strong>{publishedCount}</strong>
          </article>
          <article>
            <span>Drafts</span>
            <strong>{draftCount}</strong>
          </article>
          <article>
            <span>Languages</span>
            <strong>3</strong>
          </article>
        </div>

        {showEditor && (
          <section className="blogEditor">
            <div className="blogEditorHeading">
              <div>
                <div className="admin-kicker">
                  ARTICLE EDITOR
                </div>
                <h2>{editingId ? 'Edit Article' : 'Write New Article'}</h2>
              </div>

              <button
                type="button"
                className="blogCancelButton"
                onClick={() => {
                  setShowEditor(false);
                  setEditingId(null);
                  setForm(emptyForm);
                  setError('');
                }}
              >
                Close
              </button>
            </div>

            <form onSubmit={saveArticle}>
              <div className="blogFormGrid">
                <label>
                  Article Title *
                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      updateForm('title', event.target.value)
                    }
                    placeholder="Enter article title"
                  />
                </label>

                <label>
                  Language *
                  <select
                    value={form.language}
                    onChange={(event) =>
                      updateForm('language', event.target.value)
                    }
                  >
                    <option value="English">English</option>
                    <option value="Hindi">हिन्दी</option>
                    <option value="Urdu">اردو</option>
                  </select>
                </label>

                <label>
                  Category
                  <input
                    value={form.category}
                    onChange={(event) =>
                      updateForm('category', event.target.value)
                    }
                    placeholder="e.g. Motivation, Science, Student Life"
                  />
                </label>

                <label>
                  Author Name
                  <input
                    value={form.author_name}
                    onChange={(event) =>
                      updateForm('author_name', event.target.value)
                    }
                    placeholder="Author name"
                  />
                </label>

                <label className="blogFullWidth">
                  Short Description
                  <textarea
                    rows={3}
                    value={form.excerpt}
                    onChange={(event) =>
                      updateForm('excerpt', event.target.value)
                    }
                    placeholder="Write a short introduction for the article card..."
                  />
                </label>

                <label className="blogFullWidth">
                  Article Content *
                  <textarea
                    rows={14}
                    required
                    value={form.content}
                    onChange={(event) =>
                      updateForm('content', event.target.value)
                    }
                    placeholder="Write your complete article here..."
                    dir={form.language === 'Urdu' ? 'rtl' : 'auto'}
                  />
                </label>

                <label className="blogFullWidth">
                  Featured Image URL
                  <input
                    type="url"
                    value={form.featured_image_url}
                    onChange={(event) =>
                      updateForm('featured_image_url', event.target.value)
                    }
                    placeholder="https://example.com/image.jpg"
                  />
                </label>

                <label>
                  Publication Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm('status', event.target.value)
                    }
                  >
                    <option value="draft">Save as Draft</option>
                    <option value="published">Publish Article</option>
                  </select>
                </label>

                <label className="blogCheckLabel">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(event) =>
                      updateForm('is_featured', event.target.checked)
                    }
                  />
                  Feature this article on the Blog
                </label>
              </div>

              <div className="blogFormActions">
                <button
                  type="submit"
                  className="blogPrimaryButton"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : form.status === 'published'
                    ? 'Publish Article'
                    : 'Save Draft'}
                </button>

                <button
                  type="button"
                  className="blogCancelButton"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="blogArticleList">
          <div className="blogListHeading">
            <div>
              <div className="admin-kicker">YOUR CONTENT</div>
              <h2>All Articles</h2>
            </div>

            <select
              className="blogFilter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All Articles</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Urdu">Urdu</option>
            </select>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="blogNoArticles">
              <span>📝</span>
              <h3>No articles found</h3>
              <p>
                Start writing your first educational article.
              </p>
              <button
                className="blogPrimaryButton"
                onClick={openNewArticle}
              >
                + Write New Article
              </button>
            </div>
          ) : (
            <div className="blogTableWrap">
              <table className="blogTable">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredArticles.map((article) => (
                    <tr key={article.id}>
                      <td>
                        <b>{article.title}</b>
                        <small>
                          {article.category || 'General'}
                        </small>
                      </td>

                      <td>{article.language}</td>

                      <td>
                        <span
                          className={
                            article.status === 'published'
                              ? 'blogStatus published'
                              : 'blogStatus draft'
                          }
                        >
                          {article.status}
                        </span>
                      </td>

                      <td>{article.is_featured ? 'Yes' : 'No'}</td>

                      <td>
                        <div className="blogActions">
                          <button
                            type="button"
                            onClick={() => openEditArticle(article)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="blogDeleteButton"
                            onClick={() => deleteArticle(article)}
                          >
                            Delete
                          </button>

                          {article.status === 'published' && (
                            <a
                              href={`/blogs/${article.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="admin-footer">
          EduAxis India · Learn. Prepare. Progress.
        </footer>
      </section>

      <style jsx>{`
        .blogPrimaryButton {
          background: #102b46;
          color: white;
          border: 0;
          border-radius: 8px;
          padding: 12px 17px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .blogPrimaryButton:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .blogCancelButton {
          background: white;
          color: #526779;
          border: 1px solid #dce5e9;
          border-radius: 8px;
          padding: 11px 16px;
          cursor: pointer;
        }

        .blogSuccess,
        .blogError {
          border-radius: 8px;
          padding: 13px 16px;
          margin: 18px 0;
          font-size: 13px;
        }

        .blogSuccess {
          background: #eaf7ef;
          color: #17683b;
        }

        .blogError {
          background: #fff0ef;
          color: #a52c25;
        }

        .blogAdminStats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin: 25px 0;
        }

        .blogAdminStats article {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 11px;
          padding: 20px;
        }

        .blogAdminStats span,
        .blogAdminStats strong {
          display: block;
        }

        .blogAdminStats span {
          color: #657789;
          font-size: 12px;
        }

        .blogAdminStats strong {
          color: #102b46;
          font-size: 28px;
          margin-top: 8px;
        }

        .blogEditor,
        .blogArticleList {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 12px;
          padding: 24px;
          margin-top: 25px;
        }

        .blogEditorHeading,
        .blogListHeading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 22px;
        }

        .blogEditorHeading h2,
        .blogListHeading h2 {
          color: #102b46;
          font-size: 22px;
          margin: 7px 0 0;
        }

        .blogFormGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .blogFormGrid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #405568;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .blogFormGrid input,
        .blogFormGrid select,
        .blogFormGrid textarea,
        .blogFilter {
          width: 100%;
          padding: 12px;
          border: 1px solid #dce5e9;
          border-radius: 7px;
          background: white;
          color: #172b3d;
          font: 13px 'DM Sans', sans-serif;
        }

        .blogFormGrid textarea {
          resize: vertical;
          line-height: 1.7;
        }

        .blogFullWidth {
          grid-column: 1 / -1;
        }

        .blogCheckLabel {
          flex-direction: row !important;
          align-items: center;
          align-self: center;
        }

        .blogCheckLabel input {
          width: auto;
        }

        .blogFormActions {
          display: flex;
          gap: 10px;
          margin-top: 22px;
          flex-wrap: wrap;
        }

        .blogFilter {
          width: auto;
          min-width: 150px;
        }

        .blogNoArticles {
          text-align: center;
          padding: 45px 15px;
          border: 1px dashed #dce5e9;
          border-radius: 10px;
        }

        .blogNoArticles span {
          font-size: 35px;
        }

        .blogNoArticles h3 {
          color: #102b46;
          margin-bottom: 6px;
        }

        .blogNoArticles p {
          color: #657789;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .blogTableWrap {
          width: 100%;
          overflow-x: auto;
        }

        .blogTable {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: left;
        }

        .blogTable th {
          color: #657789;
          background: #f5f8f9;
          padding: 13px 12px;
          white-space: nowrap;
        }

        .blogTable td {
          border-top: 1px solid #e7edef;
          padding: 14px 12px;
          color: #405568;
          vertical-align: middle;
        }

        .blogTable td:first-child b,
        .blogTable td:first-child small {
          display: block;
        }

        .blogTable td:first-child b {
          color: #102b46;
          max-width: 280px;
          line-height: 1.5;
        }

        .blogTable td:first-child small {
          margin-top: 5px;
          color: #81909c;
        }

        .blogStatus {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          text-transform: capitalize;
          font-size: 10px;
          font-weight: 700;
        }

        .blogStatus.published {
          background: #e7f5ec;
          color: #187142;
        }

        .blogStatus.draft {
          background: #f1f3f5;
          color: #657789;
        }

        .blogActions {
          display: flex;
          gap: 10px;
          align-items: center;
          white-space: nowrap;
        }

        .blogActions button,
        .blogActions a {
          background: none;
          border: 0;
          padding: 0;
          color: #168e8b;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .blogActions .blogDeleteButton {
          color: #bd4545;
        }

        @media (max-width: 850px) {
          .blogAdminStats {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .blogFormGrid {
            grid-template-columns: 1fr;
          }

          .blogFullWidth {
            grid-column: auto;
          }

          .blogEditor,
          .blogArticleList {
            padding: 16px;
          }

          .blogEditorHeading,
          .blogListHeading {
            align-items: flex-start;
            flex-direction: column;
          }

          .blogFilter {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
