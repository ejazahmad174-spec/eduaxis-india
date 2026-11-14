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

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'divider' }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] };

function parseArticleContent(content: string): ContentBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ContentBlock[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraphLines = [];
  };

  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (/^HEADING:\s*/i.test(line)) {
      flushParagraph();
      const heading = line.replace(/^HEADING:\s*/i, '').trim();
      if (heading) blocks.push({ type: 'heading', text: heading });
      index += 1;
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    if (/^[•*-]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^[•*-]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[•*-]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'bullets', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'numbered', items });
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

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
        if (isActive) setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);

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
        if (isActive) setNotFound(true);
      } finally {
        if (isActive) setLoading(false);
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
        <style jsx>{`
          .articleMessage {
            min-height: 55vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
            color: #102b46;
          }
        `}</style>
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
  const direction = isUrdu ? 'rtl' : 'ltr';

  const formattedDate = new Date(
    article.published_at || article.created_at
  ).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const contentBlocks = parseArticleContent(article.content);

  return (
    <main className="articlePage">
      <div className="articleContainer">
        <Link href="/blogs" className="backLink">
          ← Back to Blog
        </Link>

        <div className="articleMeta">
          {article.category && <span>{article.category}</span>}
          <span>{article.language}</span>
          <span>{formattedDate}</span>
        </div>

        <h1 dir={direction}>{article.title}</h1>

        {article.excerpt && (
          <p className="articleExcerpt" dir={direction}>
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

        <div className="articleContent" dir={direction}>
          {contentBlocks.map((block, index) => {
            if (block.type === 'heading') {
              return <h2 key={index}>{block.text}</h2>;
            }

            if (block.type === 'divider') {
              return <hr key={index} />;
            }

            if (block.type === 'bullets') {
              return (
                <ul key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              );
            }

            if (block.type === 'numbered') {
              return (
                <ol key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ol>
              );
            }

            return <p key={index}>{block.text}</p>;
          })}
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
          white-space: pre-wrap;
        }

        .articleContent h2 {
          color: #102b46;
          font-size: clamp(21px, 3vw, 27px);
          line-height: 1.4;
          margin: 30px 0 14px;
        }

        .articleContent ul,
        .articleContent ol {
          margin: 0 0 22px;
          padding-inline-start: 28px;
        }

        .articleContent li {
          padding-inline-start: 6px;
          margin-bottom: 9px;
        }

        .articleContent hr {
          border: 0;
          border-top: 1px solid #dce7e9;
          margin: 28px 0;
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
