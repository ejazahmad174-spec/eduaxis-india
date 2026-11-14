
"use client";

import { useMemo, useState } from "react";

type Language = "English" | "Hindi" | "Urdu";

type Article = {
  id: number;
  language: Language;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  icon: string;
  featured?: boolean;
};

const articles: Article[] = [
  {
    id: 1,
    language: "English",
    title: "The Power of Consistency in Student Life",
    description:
      "Success is not achieved in a single day. Discover how small daily efforts, discipline and consistency can transform your learning journey.",
    category: "Motivation",
    date: "14 November 2026",
    readTime: "5 min read",
    icon: "🌱",
    featured: true,
  },
  {
    id: 2,
    language: "Hindi",
    title: "विद्यार्थी जीवन में अनुशासन का महत्व",
    description:
      "अनुशासन विद्यार्थियों को अपने लक्ष्य तक पहुँचने में मदद करता है। जानिए कैसे अच्छी आदतें आपके भविष्य को बेहतर बना सकती हैं।",
    category: "प्रेरणा",
    date: "14 नवम्बर 2026",
    readTime: "5 मिनट",
    icon: "🎯",
    featured: true,
  },
  {
    id: 3,
    language: "Urdu",
    title: "تعلیم انسان کی زندگی کو کیسے بدلتی ہے؟",
    description:
      "تعلیم صرف کتابی علم حاصل کرنے کا ذریعہ نہیں بلکہ بہتر سوچ، اعتماد اور روشن مستقبل کی بنیاد بھی ہے۔",
    category: "تعلیم",
    date: "14 نومبر 2026",
    readTime: "5 منٹ",
    icon: "📚",
    featured: true,
  },
  {
    id: 4,
    language: "English",
    title: "How to Manage Time During Examinations",
    description:
      "Practical ways to organise your daily study schedule, avoid distractions and prepare confidently for examinations.",
    category: "Student Life",
    date: "12 November 2026",
    readTime: "4 min read",
    icon: "⏰",
  },
  {
    id: 5,
    language: "Hindi",
    title: "असफलता से सफलता तक का सफर",
    description:
      "असफलता अंत नहीं है। यह सीखने, खुद को सुधारने और दोबारा प्रयास करने का एक अवसर है।",
    category: "जीवन के सबक",
    date: "11 नवम्बर 2026",
    readTime: "4 मिनट",
    icon: "🌟",
  },
  {
    id: 6,
    language: "Urdu",
    title: "وقت کی قدر اور کامیابی",
    description:
      "وقت ایک قیمتی سرمایہ ہے۔ اس کا درست استعمال طالب علم کو نظم و ضبط اور کامیابی کی طرف لے جاتا ہے۔",
    category: "زندگی کے اسباق",
    date: "10 نومبر 2026",
    readTime: "4 منٹ",
    icon: "⌛",
  },
];

const languages: Language[] = ["English", "Hindi", "Urdu"];

const languageLabels: Record<Language, string> = {
  English: "English",
  Hindi: "हिन्दी",
  Urdu: "اردو",
};

const languageDescriptions: Record<Language, string> = {
  English: "Ideas, knowledge and inspiration for every learner.",
  Hindi: "हर विद्यार्थी के लिए ज्ञान, विचार और प्रेरणा।",
  Urdu: "ہر طالب علم کے لیے علم، فکر اور رہنمائی۔",
};

export default function BlogsPage() {
  const [language, setLanguage] = useState<Language>("English");
  const [search, setSearch] = useState("");

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesLanguage = article.language === language;
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        article.title.toLowerCase().includes(term) ||
        article.description.toLowerCase().includes(term) ||
        article.category.toLowerCase().includes(term);

      return matchesLanguage && matchesSearch;
    });
  }, [language, search]);

  const featuredArticles = filteredArticles.filter(
    (article) => article.featured
  );

  const latestArticles = filteredArticles.filter(
    (article) => !article.featured
  );

  const isUrdu = language === "Urdu";

  return (
    <main className="blogPage">
      <div className="top">
        <div className="wrap topin">
          <span>EduAxis India Knowledge Hub</span>
          <span>Learn · Think · Grow</span>
        </div>
      </div>

      <header className="wrap blogNav">
        <a href="/" className="brand">
          <i>E</i>
          <span>
            EduAxis <b>India</b>
            <small>LEARN. PREPARE. PROGRESS.</small>
          </span>
        </a>

        <nav>
          <a href="/">Home</a>
          <a href="/study-materials">Study Materials</a>
          <a href="/government-jobs">Government Jobs</a>
          <a href="/mock-tests">Mock Tests</a>
        </nav>

        <a className="login" href="/student/login">
          Student Login
        </a>
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
        <div className="blogLanguageHeading">
          <div>
            <label>EXPLORE IN YOUR LANGUAGE</label>
            <h2>Choose your language</h2>
            <p className="sub">
              Read and explore articles in the language you prefer.
            </p>
          </div>
        </div>

        <div className="languageTabs" role="group" aria-label="Select article language">
          {languages.map((item) => (
            <button
              key={item}
              type="button"
              className={language === item ? "languageTab active" : "languageTab"}
              onClick={() => {
                setLanguage(item);
                setSearch("");
              }}
            >
              {languageLabels[item]}
            </button>
          ))}
        </div>

        <div
          className={isUrdu ? "blogLanguageInfo urdu" : "blogLanguageInfo"}
          dir={isUrdu ? "rtl" : "ltr"}
        >
          <h3>{languageLabels[language]} Articles</h3>
          <p>{languageDescriptions[language]}</p>
        </div>

        <div className="blogSearch">
          <span>⌕</span>
          <input
            type="search"
            placeholder={
              isUrdu
                ? "مضمون تلاش کریں..."
                : language === "Hindi"
                ? "लेख खोजें..."
                : "Search articles by title, topic or category..."
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            dir={isUrdu ? "rtl" : "ltr"}
          />
        </div>

        {featuredArticles.length > 0 && (
          <section className="blogSection">
            <div className="blogSectionTitle">
              <div>
                <label>HANDPICKED FOR YOU</label>
                <h2>Featured Articles</h2>
              </div>
              <span>Editor's choice</span>
            </div>

            <div className="blogGrid featuredGrid">
              {featuredArticles.map((article) => (
                <article
                  className="blogCard featuredCard"
                  key={article.id}
                  dir={article.language === "Urdu" ? "rtl" : "ltr"}
                >
                  <div className="blogCardVisual">
                    <span>{article.icon}</span>
                    <small>EDUAXIS INDIA</small>
                  </div>

                  <div className="blogCardBody">
                    <div className="blogMeta">
                      <span>{article.category}</span>
                      <small>{article.readTime}</small>
                    </div>

                    <h3>{article.title}</h3>
                    <p>{article.description}</p>

                    <div className="blogCardFooter">
                      <small>{article.date}</small>
                      <a className="readMore" href={`/blogs/${article.id}`}>
  Read Article →
</a>
                    </div>
                  </div>
                </article>
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

          {latestArticles.length > 0 ? (
            <div className="blogGrid">
              {latestArticles.map((article) => (
                <article
                  className="blogCard"
                  key={article.id}
                  dir={article.language === "Urdu" ? "rtl" : "ltr"}
                >
                  <div className="blogCardVisual">
                    <span>{article.icon}</span>
                    <small>EDUAXIS INDIA</small>
                  </div>

                  <div className="blogCardBody">
                    <div className="blogMeta">
                      <span>{article.category}</span>
                      <small>{article.readTime}</small>
                    </div>

                    <h3>{article.title}</h3>
                    <p>{article.description}</p>

                    <div className="blogCardFooter">
                      <small>{article.date}</small>
                      <a className="readMore" href={`/blogs/${article.id}`}>
  Read Article →
</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="blogEmpty">
              <span>📖</span>
              <h3>No articles found</h3>
              <p>
                Try another search or select a different language.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => setSearch("")}
              >
                Clear Search
              </button>
            </div>
          )}
        </section>

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
          <p>Empowering learners with knowledge, preparation and opportunity.</p>
          <div className="blogFooterLinks">
            <a href="/">Home</a>
            <a href="/study-materials">Study Materials</a>
            <a href="/government-jobs">Government Jobs</a>
            <a href="/mock-tests">Mock Tests</a>
          </div>
          <small>© {new Date().getFullYear()} EduAxis India. All rights reserved.</small>
        </div>
      </footer>

      <style jsx>{`
        .blogPage {
          background: #fff;
          min-height: 100vh;
        }

        .blogNav {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .blogNav nav {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: #506477;
        }

        .blogHero {
          background: linear-gradient(115deg, #f1f7f8, #e9f5f3);
          padding: 82px 0 88px;
          text-align: center;
        }

        .blogHeroInner {
          max-width: 850px;
        }

        .blogEyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--teal);
        }

        .blogHero h1 {
          margin: 18px 0;
          font-size: clamp(42px, 6vw, 68px);
          line-height: 1.08;
          letter-spacing: -2px;
        }

        .blogHero h1 em {
          color: var(--teal);
          font-style: normal;
        }

        .blogHero p {
          max-width: 650px;
          margin: 0 auto;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.8;
        }

        .blogHighlights {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 20px;
          margin-top: 28px;
          color: #456579;
          font-size: 12px;
          font-weight: 600;
        }

        .blogContent {
          padding-top: 65px;
          padding-bottom: 70px;
        }

        .blogLanguageHeading h2,
        .blogSectionTitle h2 {
          margin: 9px 0;
          font-size: 29px;
          letter-spacing: -1px;
        }

        .blogLanguageHeading .sub {
          margin-top: 5px;
          font-size: 14px;
        }

        .languageTabs {
          display: flex;
          gap: 10px;
          margin: 25px 0 18px;
          flex-wrap: wrap;
        }

        .languageTab {
          border: 1px solid var(--line);
          background: white;
          color: var(--navy);
          padding: 12px 25px;
          border-radius: 8px;
          font: 700 14px 'DM Sans', sans-serif;
          cursor: pointer;
          min-width: 110px;
        }

        .languageTab.active {
          background: var(--navy);
          color: white;
          border-color: var(--navy);
        }

        .blogLanguageInfo {
          background: #f4f8f8;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 16px 20px;
        }

        .blogLanguageInfo h3 {
          margin: 0 0 5px;
          font-size: 17px;
        }

        .blogLanguageInfo p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }

        .blogLanguageInfo.urdu {
          text-align: right;
          font-family: Arial, sans-serif;
        }

        .blogSearch {
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--line);
          border-radius: 9px;
          padding: 0 15px;
          max-width: 600px;
          height: 48px;
        }

        .blogSearch span {
          color: var(--teal);
          font-size: 25px;
        }

        .blogSearch input {
          width: 100%;
          border: 0;
          outline: 0;
          color: var(--ink);
          font: 14px 'DM Sans', sans-serif;
          background: transparent;
        }

        .blogSection {
          margin-top: 55px;
        }

        .blogSectionTitle {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 15px;
          margin-bottom: 22px;
        }

        .blogSectionTitle > span {
          font-size: 11px;
          color: var(--muted);
          border: 1px solid var(--line);
          padding: 7px 11px;
          border-radius: 20px;
        }

        .blogGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .blogCard {
          border: 1px solid var(--line);
          border-radius: 13px;
          overflow: hidden;
          background: white;
          transition: transform .2s, box-shadow .2s;
        }

        .blogCard:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 35px #183f5510;
        }

        .blogCardVisual {
          min-height: 145px;
          background: linear-gradient(135deg, #eaf5f3, #edf3f7);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .blogCardVisual > span {
          font-size: 48px;
        }

        .blogCardVisual small {
          position: absolute;
          bottom: 12px;
          right: 14px;
          font-size: 9px;
          letter-spacing: 1.5px;
          color: #78909b;
          font-weight: 700;
        }

        .blogCard[dir="rtl"] .blogCardVisual small {
          right: auto;
          left: 14px;
        }

        .blogCardBody {
          padding: 19px;
        }

        .blogMeta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .blogMeta span {
          color: var(--teal);
          font-size: 11px;
          font-weight: 700;
        }

        .blogMeta small,
        .blogCardFooter small {
          color: #81909c;
          font-size: 10px;
        }

        .blogCard h3 {
          font-size: 17px;
          line-height: 1.5;
          margin: 15px 0 9px;
        }

        .blogCard p {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.8;
          min-height: 65px;
          margin: 0;
        }

        .blogCard[dir="rtl"] .blogCardBody {
          font-family: Arial, sans-serif;
          text-align: right;
        }

        .blogCardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-top: 1px solid var(--line);
          padding-top: 14px;
          margin-top: 17px;
        }

        .readMore {
          font-size: 11px;
          color: var(--teal);
          font-weight: 700;
        }

        .blogEmpty {
          text-align: center;
          border: 1px dashed #cbd9df;
          border-radius: 12px;
          padding: 45px 20px;
        }

        .blogEmpty > span {
          font-size: 35px;
        }

        .blogEmpty h3 {
          margin-bottom: 6px;
        }

        .blogEmpty p {
          color: var(--muted);
          font-size: 13px;
          margin-bottom: 20px;
        }

        .blogQuote {
          text-align: center;
          background: #f3f8f7;
          padding: 38px 20px;
          border-radius: 15px;
          margin-top: 65px;
        }

        .blogQuote > span {
          color: var(--teal);
          font: 800 60px Georgia, serif;
          line-height: 1;
        }

        .blogQuote h2 {
          font-size: 25px;
          margin: 0 0 8px;
        }

        .blogQuote p {
          color: var(--muted);
          font-size: 13px;
        }

        .blogQuote b {
          color: var(--teal);
          font-size: 12px;
        }

        .blogFooterLinks {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          margin: 15px 0;
          font-size: 12px;
          color: #d7e3e9;
        }

        @media (max-width: 900px) {
          .blogNav nav {
            display: none;
          }

          .blogGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .blogHero {
            padding: 55px 0;
          }

          .blogContent {
            padding-top: 45px;
            padding-bottom: 50px;
          }

          .blogGrid {
            grid-template-columns: 1fr;
          }

          .blogSectionTitle h2,
          .blogLanguageHeading h2 {
            font-size: 25px;
          }

          .blogHighlights {
            gap: 12px;
          }

          .languageTab {
            flex: 1;
            min-width: 0;
            padding: 11px 14px;
          }

          .blogCard p {
            min-height: 0;
          }
        }
      `}</style>
    </main>
  );
}
