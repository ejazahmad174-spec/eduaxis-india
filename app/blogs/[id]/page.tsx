
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

type Article = {
  id: string;
  language: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  icon: string;
  content: string[];
};

const articles: Article[] = [
  {
    id: "1",
    language: "English",
    title: "The Power of Consistency in Student Life",
    category: "Motivation",
    date: "14 November 2026",
    readTime: "5 min read",
    author: "EduAxis India Editorial Team",
    icon: "🌱",
    content: [
      "Success is rarely the result of one extraordinary effort. More often, it is the outcome of small actions repeated consistently over time. For students, consistency can make the difference between ordinary preparation and meaningful progress.",
      "Many students begin their studies with great enthusiasm but find it difficult to maintain the same energy every day. The key is not to depend entirely on motivation. Instead, develop a realistic routine that you can follow even on days when you do not feel particularly motivated.",
      "Start with small goals. Read a few pages, revise one topic, solve a set of questions or spend some time understanding a difficult concept. Small achievements build confidence and make larger goals easier to approach.",
      "Consistency also means learning from mistakes. If you miss a study session, do not give up on the entire schedule. Identify what went wrong and return to your routine. Progress is not about being perfect; it is about continuing to improve.",
      "Remember that your future is shaped by the habits you develop today. Make learning a daily practice, remain patient and trust the process. Small steps, taken regularly, can lead to remarkable achievements."
    ]
  },
  {
    id: "2",
    language: "Hindi",
    title: "विद्यार्थी जीवन में अनुशासन का महत्व",
    category: "प्रेरणा",
    date: "14 नवम्बर 2026",
    readTime: "5 मिनट",
    author: "EduAxis India Editorial Team",
    icon: "🎯",
    content: [
      "विद्यार्थी जीवन मनुष्य के भविष्य की नींव तैयार करने का महत्वपूर्ण समय होता है। इस समय प्राप्त ज्ञान, विकसित आदतें और सीखे गए जीवन-मूल्य आगे चलकर व्यक्ति के व्यक्तित्व को आकार देते हैं। इन सबमें अनुशासन की विशेष भूमिका होती है।",
      "अनुशासन का अर्थ केवल समय पर उठना या निर्धारित समय पर पढ़ाई करना नहीं है। इसका अर्थ है अपने लक्ष्य को समझना, अपनी जिम्मेदारियों को स्वीकार करना और सही दिशा में नियमित प्रयास करना।",
      "एक अनुशासित विद्यार्थी अपने समय का बेहतर उपयोग करता है। वह पढ़ाई, खेल, आराम और अन्य गतिविधियों के बीच संतुलन बनाए रखने का प्रयास करता है। इससे तनाव कम होता है और सीखने की क्षमता बेहतर बनती है।",
      "अनुशासन विकसित करने के लिए छोटे कदम उठाएँ। प्रतिदिन का एक सरल कार्यक्रम बनाएँ, पढ़ाई के समय ध्यान भटकाने वाली चीजों से दूर रहें और अपने कार्यों की समीक्षा करें। गलती होने पर निराश होने के बजाय उससे सीखें।",
      "याद रखें, सफलता केवल प्रतिभा पर निर्भर नहीं करती। नियमित मेहनत, आत्मविश्वास और अनुशासन भी उतने ही महत्वपूर्ण हैं। आज की अच्छी आदतें कल के बेहतर भविष्य का निर्माण करती हैं।"
    ]
  },
  {
    id: "3",
    language: "Urdu",
    title: "تعلیم انسان کی زندگی کو کیسے بدلتی ہے؟",
    category: "تعلیم",
    date: "14 نومبر 2026",
    readTime: "5 منٹ",
    author: "EduAxis India Editorial Team",
    icon: "📚",
    content: [
      "تعلیم انسان کی زندگی میں بنیادی اہمیت رکھتی ہے۔ یہ صرف کتابیں پڑھنے یا امتحان پاس کرنے کا ذریعہ نہیں بلکہ سوچنے، سمجھنے اور زندگی کے مسائل کا بہتر حل تلاش کرنے کی صلاحیت بھی پیدا کرتی ہے۔",
      "ایک تعلیم یافتہ انسان اپنے اردگرد کی دنیا کو زیادہ گہرائی سے سمجھنے کی کوشش کرتا ہے۔ تعلیم اسے سوال کرنے، نئی معلومات حاصل کرنے اور درست فیصلے کرنے کا حوصلہ دیتی ہے۔",
      "تعلیم کے ذریعے انسان اپنے لیے بہتر مواقع پیدا کر سکتا ہے۔ علم اور مہارتیں روزگار، خود اعتمادی اور معاشرتی ترقی کے راستے کھولتی ہیں۔ اس کے ساتھ تعلیم انسان کو دوسروں کے حقوق اور ذمہ داریوں کا احساس بھی دلاتی ہے۔",
      "طلبہ کو چاہیے کہ وہ تعلیم کو صرف نمبروں اور ڈگریوں تک محدود نہ رکھیں۔ مطالعہ کریں، سوال پوچھیں، نئی چیزیں سیکھیں اور اپنے علم کو عملی زندگی میں استعمال کرنے کی کوشش کریں۔",
      "یاد رکھیے، تعلیم ایک مسلسل سفر ہے۔ سیکھنے کا عمل اسکول یا کالج ختم ہونے کے بعد بھی جاری رہتا ہے۔ جو انسان سیکھنے کے لیے تیار رہتا ہے، وہ زندگی میں آگے بڑھنے کے نئے راستے تلاش کر سکتا ہے۔"
    ]
  },
  {
    id: "4",
    language: "English",
    title: "How to Manage Time During Examinations",
    category: "Student Life",
    date: "12 November 2026",
    readTime: "4 min read",
    author: "EduAxis India Editorial Team",
    icon: "⏰",
    content: [
      "Examination periods can be stressful, especially when several subjects need attention. A practical timetable can help students use their available time more effectively.",
      "Begin by listing the subjects and topics you need to study. Identify the topics that require more attention and divide them into manageable study sessions.",
      "Avoid studying continuously for long hours. Short breaks help you maintain concentration. You can also use practice questions and revision sessions to check your understanding.",
      "Keep enough time for sleep, meals and relaxation. A healthy routine supports concentration and memory. Avoid comparing your preparation with others; focus on your own progress.",
      "Good time management is not about filling every minute with work. It is about giving the right amount of attention to the right task at the right time."
    ]
  },
  {
    id: "5",
    language: "Hindi",
    title: "असफलता से सफलता तक का सफर",
    category: "जीवन के सबक",
    date: "11 नवम्बर 2026",
    readTime: "4 मिनट",
    author: "EduAxis India Editorial Team",
    icon: "🌟",
    content: [
      "जीवन में हर व्यक्ति सफलता प्राप्त करना चाहता है, लेकिन सफलता का रास्ता हमेशा आसान नहीं होता। कई बार प्रयास करने के बाद भी अपेक्षित परिणाम नहीं मिलते। ऐसे समय में असफलता को समझना बहुत जरूरी है।",
      "असफलता यह बताती है कि हमारे प्रयासों में कहाँ सुधार की आवश्यकता है। यह हमारी कमियों को पहचानने और नई रणनीति बनाने का अवसर देती है।",
      "किसी परीक्षा में कम अंक आना या किसी लक्ष्य को प्राप्त न कर पाना जीवन का अंत नहीं है। अपनी गलतियों का विश्लेषण करें, आवश्यकता पड़ने पर मार्गदर्शन लें और दोबारा प्रयास करें।",
      "धैर्य और निरंतर मेहनत सफलता की यात्रा के महत्वपूर्ण साथी हैं। अपने लक्ष्य को छोटे हिस्सों में बाँटें और हर दिन थोड़ा आगे बढ़ने का प्रयास करें।",
      "याद रखें, असफलता आपकी पहचान नहीं है। उससे सीखकर आगे बढ़ना ही वास्तविक सफलता की दिशा में एक महत्वपूर्ण कदम है।"
    ]
  },
  {
    id: "6",
    language: "Urdu",
    title: "وقت کی قدر اور کامیابی",
    category: "زندگی کے اسباق",
    date: "10 نومبر 2026",
    readTime: "4 منٹ",
    author: "EduAxis India Editorial Team",
    icon: "⌛",
    content: [
      "وقت انسان کی زندگی کا ایک قیمتی سرمایہ ہے۔ گزرا ہوا وقت واپس نہیں آتا، اس لیے ضروری ہے کہ ہم اسے سمجھداری اور ذمہ داری کے ساتھ استعمال کریں۔",
      "طالب علم کی زندگی میں وقت کی پابندی خاص اہمیت رکھتی ہے۔ پڑھائی، کھیل، آرام اور دیگر سرگرمیوں کے لیے مناسب وقت مقرر کرنے سے زندگی میں توازن پیدا ہوتا ہے۔",
      "وقت کا بہتر استعمال کرنے کے لیے روزانہ کے کاموں کی فہرست بنائیں۔ اہم کاموں کو ترجیح دیں اور غیر ضروری مصروفیات سے بچنے کی کوشش کریں۔",
      "یہ بھی یاد رکھیں کہ آرام اور نیند وقت کا ضیاع نہیں ہیں۔ اچھی صحت اور ذہنی سکون بہتر سیکھنے اور کام کرنے میں مدد دیتے ہیں۔",
      "کامیابی کے لیے صرف بڑے خواب کافی نہیں ہوتے۔ وقت کی قدر، مستقل محنت اور درست منصوبہ بندی بھی ضروری ہیں۔ آج کے وقت کو بہتر بنائیں تاکہ آنے والا کل روشن ہو۔"
    ]
  }
];

export default function ArticlePage() {
  const params = useParams();
  const id = String(params.id);
  const article = articles.find((item) => item.id === id);

  if (!article) {
    return (
      <main className="articlePage">
        <div className="articleNotFound">
          <span>📖</span>
          <h1>Article Not Found</h1>
          <p>This article may not exist or may have been moved.</p>
          <Link href="/blogs" className="articleButton">
            Back to Blog
          </Link>
        </div>
      </main>
    );
  }

  const isUrdu = article.language === "Urdu";
  const isHindi = article.language === "Hindi";

  return (
    <main className="articlePage">
      <div className="top">
        <div className="wrap topin">
          <span>EduAxis India Knowledge Hub</span>
          <span>Learn · Think · Grow</span>
        </div>
      </div>

      <header className="wrap articleNav">
        <Link href="/" className="brand">
          <i>E</i>
          <span>
            EduAxis <b>India</b>
            <small>LEARN. PREPARE. PROGRESS.</small>
          </span>
        </Link>

        <Link href="/blogs" className="articleBack">
          ← Back to Blog
        </Link>
      </header>

      <div className="wrap articleContainer">
        <div className="articleBreadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/blogs">Blog</Link>
          <span>/</span>
          <span>{article.category}</span>
        </div>

        <article
          className="articleContent"
          dir={isUrdu ? "rtl" : "ltr"}
          lang={isUrdu ? "ur" : isHindi ? "hi" : "en"}
        >
          <div className="articleCategory">{article.category}</div>

          <h1>{article.title}</h1>

          <div className="articleMeta">
            <span>By {article.author}</span>
            <span>{article.date}</span>
            <span>{article.readTime}</span>
          </div>

          <div className="articleCover">
            <span>{article.icon}</span>
            <b>EDUAXIS INDIA</b>
          </div>

          <div className="articleBody">
            {article.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className="articleEnd">
            <b>EduAxis India</b>
            <p>
              Learn. Prepare. Progress.
            </p>
          </div>
        </article>

        <div className="articleBottom">
          <Link href="/blogs" className="articleButton">
            ← Explore More Articles
          </Link>
        </div>
      </div>

      <footer>
        <div className="wrap">
          <b>EduAxis India</b>
          <p>Empowering learners with knowledge, preparation and opportunity.</p>
          <small>© {new Date().getFullYear()} EduAxis India. All rights reserved.</small>
        </div>
      </footer>

      <style jsx>{`
        .articlePage {
          min-height: 100vh;
          background: #fff;
        }

        .articleNav {
          min-height: 78px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .articleBack {
          color: var(--teal);
          font-size: 13px;
          font-weight: 700;
        }

        .articleContainer {
          max-width: 850px;
          padding-top: 35px;
          padding-bottom: 70px;
        }

        .articleBreadcrumb {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 30px;
        }

        .articleBreadcrumb a {
          color: var(--teal);
        }

        .articleContent {
          color: var(--ink);
        }

        .articleContent[dir="rtl"] {
          text-align: right;
          font-family: Arial, sans-serif;
        }

        .articleCategory {
          display: inline-block;
          color: var(--teal);
          background: #eaf6f4;
          border-radius: 20px;
          padding: 7px 13px;
          font-size: 12px;
          font-weight: 700;
        }

        .articleContent h1 {
          font-size: clamp(30px, 5vw, 45px);
          line-height: 1.25;
          letter-spacing: -1px;
          margin: 18px 0;
        }

        .articleMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          color: var(--muted);
          font-size: 11px;
          padding-bottom: 22px;
          border-bottom: 1px solid var(--line);
        }

        .articleCover {
          min-height: 230px;
          background: linear-gradient(135deg, #eaf5f3, #edf3f7);
          border-radius: 15px;
          margin: 28px 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 12px;
        }

        .articleCover span {
          font-size: 65px;
        }

        .articleCover b {
          color: #78909b;
          letter-spacing: 2px;
          font-size: 11px;
        }

        .articleBody {
          max-width: 760px;
          margin: auto;
        }

        .articleBody p {
          color: #405568;
          font-size: 16px;
          line-height: 2;
          margin: 0 0 22px;
          white-space: pre-wrap;
        }

        .articleContent[dir="rtl"] .articleBody p {
          font-size: 18px;
          line-height: 2.1;
        }

        .articleEnd {
          border-top: 1px solid var(--line);
          margin-top: 35px;
          padding-top: 22px;
        }

        .articleEnd b {
          color: var(--navy);
          font-family: Manrope, sans-serif;
        }

        .articleEnd p {
          color: var(--teal);
          font-size: 12px;
        }

        .articleBottom {
          text-align: center;
          margin-top: 35px;
        }

        .articleButton {
          display: inline-block;
          background: var(--navy);
          color: white;
          padding: 13px 19px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        .articleNotFound {
          text-align: center;
          padding: 100px 20px;
        }

        .articleNotFound > span {
          font-size: 50px;
        }

        .articleNotFound h1 {
          font-size: 30px;
        }

        .articleNotFound p {
          color: var(--muted);
          margin-bottom: 25px;
        }

        @media (max-width: 620px) {
          .articleContainer {
            padding-top: 25px;
            padding-bottom: 45px;
          }

          .articleCover {
            min-height: 175px;
          }

          .articleBody p {
            font-size: 15px;
          }

          .articleMeta {
            gap: 10px;
          }
        }
      `}</style>
    </main>
  );
}
