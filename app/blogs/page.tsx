
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Language = 'English' | 'Hindi' | 'Urdu';

type Article = {
  id: string;
  title: string;
  slug: string;
  language: Language;
  category: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
};

const languages: Language[] = ['English', 'Hindi', 'Urdu'];

const labels: Record<Language, string> = {
  English: 'English',
  Hindi: 'हिन्दी',
  Urdu: 'اردو',
};

const descriptions: Record<Language, string> = {
  English: 'Ideas, knowledge and inspiration for every learner.',
  Hindi: 'हर विद्यार्थी के लिए ज्ञान, विचार और प्रेरणा।',
  Urdu: 'ہر طالب علم کے لیے علم، فکر اور رہنمائی۔',
};

function ArticleCard({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const rtl = article.language === 'Urdu';

  const date = new Date(
    article.published_at || article.created_at
  ).toLocaleDateString(
    article.language === 'Hindi'
      ? 'hi-IN'
      : article.language === 'Urdu'
      ? 'ur-PK'
      : 'en-IN'
  );

  return (
    <article
      className={featured ? 'blogCard featuredCard' : 'blogCard'}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <Link
        href={`/blogs/${article.slug}`}
        className="blogImageLink"
        aria-label={`Read ${article.title}`}
      >
        {article.featured_image_url ? (
          <div className="blogImage">
            <img src={article.featured_image_url} alt={article.title} />
          </div>
        ) : (
          <div className="blogImage blogImageFallback">
            <span>📚</span>
            <small>EDUAXIS INDIA</small>
          </div>
        )}
      </Link>

      <div className="blogCardBody">
        <div className="blogMeta">
          <span>{article.category || 'Knowledge'}</span>
          <small>{labels[article.language]}</small>
        </div>

        <h3>
          <Link href={`/blogs/${article.slug}`}>
            {article.title}
          </Link>
        </h3>

        <p>
          {article.excerpt || 'Explore this article on EduAxis India.'}
        </p>

        <div className="blogCardFooter">
          <small>{date}</small>

          <Link className="readMore" href={`/blogs/${article.slug}`}>
            {rtl
              ? 'مکمل مضمون ←'
              : article.language === 'Hindi'
              ? 'पूरा लेख पढ़ें →'
              : 'Read Article →'}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function BlogsPage() {
  const [language, setLanguage] = useState<Language>('English');
  const [search, setSearch] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadArticles() {
      if (!supabase) {
        if (active) {
          setError('Blog service is temporarily unavailable.');
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('blog_articles')
        .select(
          'id,title,slug,language,category,excerpt,featured_image_url,author_name,is_featured,published_at,created_at'
        )
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError('Articles could not be loaded. Please try again later.');
      } else {
        setArticles((data || []) as Article[]);
      }

      setLoading(false);
    }

    loadArticles();

    return () => {
      active = false;
    };
  }, []);

  const filteredArticles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesLanguage = article.language === language;

      const matchesSearch =
        !term ||
        article.title.toLowerCase().includes(term) ||
        (article.excerpt || '').toLowerCase().includes(term) ||
        (article.category || '').toLowerCase().includes(term);

      return matchesLanguage && matchesSearch;
    });
  }, [articles, language, search]);

  const featured = filteredArticles.filter(
    (article) => article.is_featured
  );

  const latest = filteredArticles.filter(
    (article) => !article.is_featured
  );

  const isUrdu = language === 'Urdu';

  return (
    <main className="blogPage">
      <div className="top">
        <div className="wrap topin">
          <span>EduAxis India Knowledge Hub</span>
          <span>Learn · Think · Grow</span>
        </div>
      </div>

      <header className="wrap blogNav">
        <Link href="/" className="brand">
          <i>E</i>
          <span>
            EduAxis <b>India</b>
            <small>LEARN. PREPARE. PROGRESS.</small>
          </span>
        </Link>

        <nav>
          <Link href="/">Home</Link>
          <Link href="/study-materials">Study Materials</Link>
          <Link href="/government-jobs">Government Jobs</Link>
          <Link href="/mock-tests">Mock Tests</Link>
        </nav>

        <Link className="login" href="/student/login">
          Student Login
        </Link>
      </header>

      <section className="blogHero">
        <div className="wrap blogHeroInner">
          <div className="blogEyebrow">THE EDUAXIS KNOWLEDGE HUB</div>

          <h1>
            Knowledge Beyond
            <br />
            <em>Textbooks.</em>
          </h1>

          <p>
            Explore ideas, discover knowledge and find inspiration.
            A space for students and curious minds to learn, think
            and grow.
          </p>

          <div className="blogHighlights">
            <span>✦ Education</span>
            <span>✦ Motivation</span>
            <span>✦ Knowledge</span>
            <span>✦ Life Lessons</span>
          </div>
        </div>
      </section>

      <section className="wrap blogContent">
        <label>EXPLORE IN YOUR LANGUAGE</label>
        <h2>Choose your language</h2>

        <p className="sub">
          Read and explore articles in the language you prefer.
        </p>

        <div className="languageTabs">
          {languages.map((item) => (
            <button
              key={item}
              type="button"
              className={
                language === item
                  ? 'languageTab active'
                  : 'languageTab'
              }
              onClick={() => {
                setLanguage(item);
                setSearch('');
              }}
            >
              {labels[item]}
            </button>
          ))}
        </div>

        <div
          className={isUrdu ? 'languageInfo urdu' : 'languageInfo'}
          dir={isUrdu ? 'rtl' : 'ltr'}
        >
          <h3>{labels[language]} Articles</h3>
          <p>{descriptions[language]}</p>
        </div>

        <div className="blogSearch">
          <span>⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            dir={isUrdu ? 'rtl' : 'ltr'}
            placeholder={
              isUrdu
                ? 'مضمون تلاش کریں...'
                : language === 'Hindi'
                ? 'लेख खोजें...'
                : 'Search articles by title, topic or category...'
            }
          />
        </div>

        {loading ? (
          <div className="blogMessage">
            Loading published articles...
          </div>
        ) : error ? (
          <div className="blogMessage blogError">{error}</div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="blogSection">
                <div className="blogSectionTitle">
                  <div>
                    <label>HANDPICKED FOR YOU</label>
                    <h2>Featured Articles</h2>
                  </div>
                  <span>Editor's choice</span>
                </div>

                <div className="featuredList">
                  {featured.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      featured
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="blogSection">
              <div className="blogSectionTitle">
                <div>
                  <label>FRESH IDEAS AND KNOWLEDGE</label>
                  <h2>Latest Articles</h2>
                </div>
                <span>{filteredArticles.length} articles</span>
              </div>

              {latest.length > 0 ? (
                <div className="blogGrid">
                  {latest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : featured.length === 0 ? (
                <div className="blogEmpty">
                  <span>📖</span>
                  <h3>
                    {search
                      ? 'No articles found'
                      : 'No articles published yet'}
                  </h3>
                  <p>
                    {search
                      ? 'Try another search or select a different language.'
                      : 'New articles will appear here when they are published.'}
                  </p>

                  {search && (
                    <button
                      className="clearButton"
                      onClick={() => setSearch('')}
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : null}
            </section>
          </>
        )}

        <section className="blogQuote">
          <span>“</span>
          <h2>Learning never ends.</h2>
          <p>
            Every new idea is an opportunity to understand the world
            a little better.
          </p>
          <b>EduAxis India</b>
        </section>
      </section>

      <footer>
        <div className="wrap">
          <b>EduAxis India</b>
          <p>
            Empowering learners with knowledge, preparation and opportunity.
          </p>

          <div className="blogFooterLinks">
            <Link href="/">Home</Link>
            <Link href="/study-materials">Study Materials</Link>
            <Link href="/government-jobs">Government Jobs</Link>
            <Link href="/mock-tests">Mock Tests</Link>
          </div>

          <small>
            © {new Date().getFullYear()} EduAxis India. All rights reserved.
          </small>
        </div>
      </footer>

      <style jsx global>{`
        .blogPage {
          width: 100%;
          min-height: 100vh;
          overflow-x: hidden;
          background: #fff;
          color: #172b3d;
        }

        .blogPage *,
        .blogPage *::before,
        .blogPage *::after {
          box-sizing: border-box;
        }

        /* Explicit container sizing for desktop and mobile */
        .blogPage .wrap {
          width: min(1180px, calc(100% - 40px));
          max-width: 1180px;
          margin-left: auto;
          margin-right: auto;
        }

        .blogPage .blogNav {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .blogPage .blogNav nav {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: #506477;
        }

        .blogPage .blogHero {
          background: linear-gradient(115deg, #f1f7f8, #e9f5f3);
          padding: 82px 0 88px;
          text-align: center;
        }

        .blogPage .blogHeroInner {
          max-width: 850px;
        }

        .blogPage .blogEyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #18a5a0;
        }

        .blogPage .blogHero h1 {
          margin: 18px 0;
          font-size: clamp(42px, 6vw, 68px);
          line-height: 1.08;
          letter-spacing: -2px;
        }

        .blogPage .blogHero h1 em {
          color: #18a5a0;
          font-style: normal;
        }

        .blogPage .blogHero p {
          max-width: 650px;
          margin: 0 auto;
          color: #657789;
          font-size: 16px;
          line-height: 1.8;
        }

        .blogPage .blogHighlights {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 20px;
          margin-top: 28px;
          color: #456579;
          font-size: 12px;
          font-weight: 600;
        }

        .blogPage .blogContent {
          padding-top: 65px;
          padding-bottom: 70px;
        }

        .blogPage .blogContent > h2 {
          margin: 9px 0;
          font-size: 29px;
          color: #102b46;
        }

        .blogPage .blogContent > .sub {
          margin-top: 5px;
          font-size: 14px;
          color: #657789;
        }

        .blogPage .languageTabs {
          display: flex;
          gap: 10px;
          margin: 25px 0 18px;
          flex-wrap: wrap;
        }

        .blogPage .languageTab {
          border: 1px solid #e2eaed;
          background: white;
          color: #102b46;
          padding: 12px 25px;
          border-radius: 8px;
          font: 700 14px 'DM Sans', sans-serif;
          cursor: pointer;
          min-width: 110px;
        }

        .blogPage .languageTab.active {
          background: #102b46;
          color: white;
          border-color: #102b46;
        }

        .blogPage .languageInfo {
          background: #f4f8f8;
          border: 1px solid #e2eaed;
          border-radius: 10px;
          padding: 16px 20px;
        }

        .blogPage .languageInfo h3 {
          margin: 0 0 5px;
          font-size: 17px;
        }

        .blogPage .languageInfo p {
          margin: 0;
          color: #657789;
          font-size: 13px;
        }

        .blogPage .urdu {
          text-align: right;
          font-family: Arial, sans-serif;
        }

        .blogPage .blogSearch {
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #e2eaed;
          border-radius: 9px;
          padding: 0 15px;
          width: 100%;
          max-width: 600px;
          height: 48px;
        }

        .blogPage .blogSearch span {
          color: #18a5a0;
          font-size: 25px;
        }

        .blogPage .blogSearch input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: #172b3d;
          font: 14px 'DM Sans', sans-serif;
          background: transparent;
        }

        .blogPage .blogSection {
          margin-top: 55px;
          width: 100%;
          min-width: 0;
        }

        .blogPage .blogSectionTitle {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 15px;
          margin-bottom: 22px;
        }

        .blogPage .blogSectionTitle h2 {
          font-size: 29px;
          margin: 9px 0;
          color: #102b46;
        }

        .blogPage .blogSectionTitle > span {
          font-size: 11px;
          color: #657789;
          border: 1px solid #e2eaed;
          padding: 7px 11px;
          border-radius: 20px;
        }

        /* Featured article: image 35%, text 65% */
        .blogPage .featuredList {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 18px;
          width: 100%;
        }

        .blogPage .blogCard {
          display: flex;
          flex-direction: column;
          min-width: 0;
          width: 100%;
          border: 1px solid #e2eaed;
          border-radius: 13px;
          overflow: hidden;
          background: white;
          transition: transform .2s, box-shadow .2s;
        }

        .blogPage .blogCard:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 35px #183f5510;
        }

        .blogPage .featuredCard {
          display: grid !important;
          grid-template-columns: minmax(0, 35%) minmax(0, 65%) !important;
          align-items: stretch;
          min-height: 220px;
        }

        .blogPage .blogImageLink {
          display: block;
          width: 100%;
          min-width: 0;
          height: 100%;
          overflow: hidden;
          text-decoration: none;
        }

        .blogPage .blogImage {
          width: 100%;
          height: 180px;
          min-height: 180px;
          max-height: 180px;
          overflow: hidden;
          background: #edf5f5;
        }

        .blogPage .featuredCard .blogImage {
          height: 100%;
          min-height: 220px;
          max-height: 260px;
        }

        .blogPage .blogImage img {
          display: block;
          width: 100%;
          height: 100%;
          max-width: 100%;
          object-fit: cover;
          object-position: center;
        }

        .blogPage .blogImageFallback {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: linear-gradient(135deg, #eaf5f3, #edf3f7);
        }

        .blogPage .blogImageFallback span {
          font-size: 48px;
        }

        .blogPage .blogImageFallback small {
          position: absolute;
          bottom: 12px;
          right: 14px;
          color: #78909b;
          font-size: 9px;
          letter-spacing: 1.5px;
        }

        .blogPage .blogCardBody {
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .blogPage .blogCard[dir="rtl"] .blogCardBody {
          text-align: right;
          font-family: Arial, sans-serif;
        }

        .blogPage .blogMeta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .blogPage .blogMeta span {
          color: #18a5a0;
          font-size: 11px;
          font-weight: 700;
        }

        .blogPage .blogMeta small,
        .blogPage .blogCardFooter small {
          color: #81909c;
          font-size: 10px;
        }

        .blogPage .blogCard h3 {
          font-size: 19px;
          line-height: 1.5;
          margin: 14px 0 9px;
        }

        .blogPage .blogCard h3 a {
          color: #102b46;
          text-decoration: none;
        }

        .blogPage .blogCard p {
          color: #657789;
          font-size: 13px;
          line-height: 1.8;
          margin: 0;
        }

        .blogPage .blogCardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-top: 1px solid #e2eaed;
          padding-top: 14px;
          margin-top: 17px;
        }

        .blogPage .readMore {
          font-size: 11px;
          color: #18a5a0;
          font-weight: 700;
          text-decoration: none;
        }

        /* Latest article cards */
        .blogPage .blogGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          width: 100%;
        }

        .blogPage .blogGrid .blogImage {
          height: 160px;
          min-height: 160px;
          max-height: 160px;
        }

        .blogPage .blogGrid .blogCardBody {
          padding: 19px;
        }

        .blogPage .blogGrid .blogCard h3 {
          font-size: 17px;
        }

        .blogPage .blogGrid .blogCard p {
          min-height: 65px;
          font-size: 12px;
        }

        .blogPage .blogEmpty,
        .blogPage .blogMessage {
          text-align: center;
          border: 1px dashed #cbd9df;
          border-radius: 12px;
          padding: 45px 20px;
          color: #657789;
        }

        .blogPage .blogEmpty > span {
          font-size: 35px;
        }

        .blogPage .blogEmpty h3 {
          color: #102b46;
          margin-bottom: 6px;
        }

        .blogPage .blogEmpty p {
          font-size: 13px;
          margin-bottom: 15px;
        }

        .blogPage .clearButton {
          border: 0;
          background: #102b46;
          color: white;
          border-radius: 7px;
          padding: 10px 15px;
          cursor: pointer;
        }

        .blogPage .blogError {
          color: #a52c25;
        }

        .blogPage .blogQuote {
          text-align: center;
          background: #f3f8f7;
          padding: 38px 20px;
          border-radius: 15px;
          margin-top: 65px;
        }

        .blogPage .blogQuote > span {
          color: #18a5a0;
          font: 800 60px Georgia, serif;
          line-height: 1;
        }

        .blogPage .blogQuote h2 {
          font-size: 25px;
          margin: 0 0 8px;
        }

        .blogPage .blogQuote p {
          color: #657789;
          font-size: 13px;
        }

        .blogPage .blogQuote b {
          color: #18a5a0;
          font-size: 12px;
        }

        .blogPage .blogFooterLinks {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          margin: 15px 0;
          font-size: 12px;
          color: #d7e3e9;
        }

        @media (max-width: 900px) {
          .blogPage .blogNav nav {
            display: none;
          }

          .blogPage .blogGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .blogPage .wrap {
            width: calc(100% - 28px);
            max-width: none;
          }

          .blogPage .blogHero {
            padding: 55px 0;
          }

          .blogPage .blogContent {
            padding-top: 45px;
            padding-bottom: 50px;
          }

          .blogPage .featuredCard {
            display: flex !important;
            flex-direction: column !important;
          }

          .blogPage .featuredCard .blogImage {
            width: 100%;
            height: 190px;
            min-height: 190px;
            max-height: 190px;
          }

          .blogPage .featuredCard .blogCardBody {
            width: 100%;
            padding: 18px;
          }

          .blogPage .blogGrid {
            grid-template-columns: minmax(0, 1fr);
          }

          .blogPage .blogGrid .blogImage {
            height: 190px;
            min-height: 190px;
            max-height: 190px;
          }

          .blogPage .blogSectionTitle h2,
          .blogPage .blogContent > h2 {
            font-size: 25px;
          }

          .blogPage .blogHighlights {
            gap: 12px;
          }

          .blogPage .languageTab {
            flex: 1;
            min-width: 0;
            padding: 11px 14px;
          }

          .blogPage .blogGrid .blogCard p {
            min-height: 0;
          }
        }
      `}</style>
    </main>
  );
}
