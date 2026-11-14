
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Article = {
  id: string;
  title: string;
  slug: string;
  language: string;
  category: string | null;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
};

export default function BlogArticlePage() {
  const params = useParams<{ id: string }>();
  const slug = params?.id;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadArticle() {
      if (!slug) {
        if (isActive) {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setNotFound(false);

      // Check that the Supabase client is available.
      const client = supabase;

      if (!client) {
        console.error('Supabase client is not available.');

        if (isActive) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await client
          .from('blog_articles')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .maybeSingle();

        if (!isActive) return;

        if (error) {
          console.error('Article loading error:', error);
          setNotFound(true);
        } else if (!data) {
          setNotFound(true);
        } else {
          setArticle(data as Article);
        }
      } catch (error) {
        console.error('Unexpected article error:', error);

        if (isActive) {
          setNotFound(true);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadArticle();

    return () => {
      isActive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="articleMessage">
        <h2>Loading article...</h2>
      </main>
    );
  }

  if (notFound || !article) {
    return (
      <main className="articleMessage">
        <h1>Article Not Found</h1>
        <p>
          This article may not exist, may be unpublished,
          or may have been moved.
        </p>
        <Link href="/blogs">← Back to Blog</Link>

        <style jsx>{`
          .articleMessage {
            min-height: 55vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 30px 20px;
            color: #102b46;
          }

          .articleMessage h1 {
            font-size: 38px;
            margin-bottom: 12px;
          }

          .articleMessage p {
            color: #657789;
          }

          .articleMessage a {
            color: #168f8c;
            margin-top: 15px;
            text-decoration: none;
          }
        `}</style>
      </main>
    );
  }

  const isUrdu = article.language === 'Urdu';

  const formattedDate = new Date(
    article.published_at || article.created_at
  ).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="articlePage">
      <div className="articleContainer">

        <Link href="/blogs" className="backLink">
          ← Back to Blog
        </Link>

        <div className="articleMeta">
          {article.category && (
            <span>{article.category}</span>
          )}
          <span>{article.language}</span>
          <span>{formattedDate}</span>
        </div>

        <h1 dir={isUrdu ? 'rtl' : 'ltr'}>
          {article.title}
        </h1>

        {article.excerpt && (
          <p
            className="articleExcerpt"
            dir={isUrdu ? 'rtl' : 'ltr'}
          >
            {article.excerpt}
          </p>
        )}

        {article.featured_image_url && (
          <img
            className="articleImage"
            src={article.featured_image_url}
            alt={article.title}
          />
        )}

        <div className="articleAuthor">
          By {article.author_name || 'EduAxis India Editorial Team'}
        </div>

        <div
          className="articleContent"
          dir={isUrdu ? 'rtl' : 'ltr'}
        >
          {article.content
            .split(/\n\s*\n/)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>

        <div className="articleFooter">
          <Link href="/blogs" className="backLink">
            ← Explore More Articles
          </Link>
        </div>

      </div>

      <style jsx>{`
        .articlePage {
          min-height: 70vh;
          padding: 45px 20px 70px;
          background: #f7fafb;
        }

        .articleContainer {
          max-width: 850px;
          margin: 0 auto;
          background: #ffffff;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 5px 25px rgba(16, 43, 70, 0.06);
        }

        .backLink {
          display: inline-block;
          color: #168f8c;
          text-decoration: none;
          font-weight: 600;
          margin-bottom: 25px;
        }

        .backLink:hover {
          text-decoration: underline;
        }

        .articleMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          color: #657789;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .articleMeta span {
          background: #eef7f7;
          padding: 6px 11px;
          border-radius: 20px;
        }

        h1 {
          color: #102b46;
          font-size: clamp(30px, 5vw, 43px);
          line-height: 1.3;
          margin: 0 0 20px;
        }

        .articleExcerpt {
          color: #657789;
          font-size: 19px;
          line-height: 1.7;
          margin-bottom: 25px;
        }

        .articleImage {
          display: block;
          width: 100%;
          max-height: 430px;
          object-fit: cover;
          border-radius: 12px;
          margin: 15px 0 25px;
        }

        .articleAuthor {
          color: #657789;
          font-size: 14px;
          border-bottom: 1px solid #e2eaed;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }

        .articleContent {
          color: #263b4d;
          font-size: 17px;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        .articleContent p {
          margin: 0 0 20px;
        }

        .articleFooter {
          margin-top: 35px;
          border-top: 1px solid #e2eaed;
          padding-top: 20px;
        }

        .articleFooter .backLink {
          margin-bottom: 0;
        }

        @media (max-width: 600px) {
          .articlePage {
            padding: 25px 12px 45px;
          }

          .articleContainer {
            padding: 24px 18px;
          }
        }
      `}</style>
    </main>
  );
}
