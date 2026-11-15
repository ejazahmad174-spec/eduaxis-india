
"use client";

import { useState } from "react";
const examCategories = [
  { name: "BPSC TRE", detail: "Bihar teacher recruitment", icon: "🎓" },
  { name: "CTET", detail: "Central teacher eligibility", icon: "📚" },
  { name: "Bihar STET", detail: "State teacher eligibility", icon: "✍️" },
  { name: "UGC NET", detail: "Assistant professor & JRF", icon: "🏛️" },
  { name: "SSC", detail: "Staff selection examinations", icon: "📝" },
  { name: "UPSC", detail: "Civil services preparation", icon: "🇮🇳" },
];

const mockTests = [
  { name: "BPSC TRE", detail: "Teacher recruitment examination", icon: "🎓" },
  { name: "CTET", detail: "Paper I and Paper II preparation", icon: "📘" },
  { name: "UGC NET", detail: "Paper I and subject preparation", icon: "🏛️" },
  { name: "Bihar SLET", detail: "Library Science and General Studies", icon: "📖" },
];

const services = [
  {
    icon: "📚",
    title: "Study Materials",
    description: "Explore notes, PDFs, subject resources and exam-focused learning materials.",
    href: "/study-materials",
    link: "Explore materials",
  },
  {
    icon: "🧪",
    title: "Mock Tests",
    description: "Practise with examination-based tests and evaluate your preparation.",
    href: "/mock-tests",
    link: "Explore mock tests",
  },
  {
    icon: "🎓",
    title: "Online Courses",
    description: "Discover structured courses for academic and competitive examinations.",
    href: "/courses",
    link: "Explore courses",
  },
  {
    icon: "💼",
    title: "Government Jobs",
    description: "Find recruitment notifications, eligibility details and important dates.",
    href: "/government-jobs",
    link: "View latest jobs",
  },
];

const jobCategories = [
  { name: "Latest Jobs", detail: "Recruitment notifications", icon: "💼" },
  { name: "Admit Cards", detail: "Examination hall tickets", icon: "🎫" },
  { name: "Results", detail: "Examination results and merit lists", icon: "🏆" },
  { name: "Admissions", detail: "Admission and application updates", icon: "🎓" },
];

export default function Home() {
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  return (
    <main className="ea-home">
      <style jsx global>{`
        .ea-home {
          --ea-navy: #102b46;
          --ea-teal: #129b98;
          --ea-ink: #172b3d;
          --ea-muted: #657789;
          --ea-line: #e2eaed;
          --ea-soft: #f4f8fa;
          color: var(--ea-ink);
          overflow: hidden;
        }
        .ea-home * { box-sizing: border-box; }
        .ea-wrap { width: min(1180px, calc(100% - 40px)); margin: auto; }
        .ea-top {
          background: var(--ea-navy);
          color: #dce8ef;
          padding: 9px 0;
          font-size: 12px;
        }
        .ea-top-inner {
          display: flex; justify-content: space-between; gap: 15px;
        }
        .ea-nav {
          background: #fff; border-bottom: 1px solid var(--ea-line);
          position: relative; z-index: 2;
        }
        .ea-nav-inner {
          min-height: 78px; display: flex; align-items: center;
          justify-content: space-between; gap: 22px;
        }
        .ea-brand {
          display: flex; align-items: center; gap: 10px;
          color: var(--ea-navy); text-decoration: none; flex-shrink: 0;
          font: 800 21px Manrope, sans-serif;
        }
        .ea-brand-mark {
          width: 43px; height: 43px; border-radius: 12px;
          display: grid; place-items: center; color: #fff;
          background: linear-gradient(135deg, var(--ea-navy), var(--ea-teal));
          font-size: 24px;
        }
        .ea-brand small {
          display: block; font: 600 9px "DM Sans", sans-serif;
          letter-spacing: 1.3px; color: #718494; margin-top: 3px;
        }
        .ea-nav-links {
          display: flex; align-items: center; justify-content: center;
          flex-wrap: wrap; gap: 19px;
        }
        .ea-nav-links a {
          color: #506477; font-size: 13px; font-weight: 600;
          text-decoration: none;
        }
        .ea-nav-links a:hover { color: var(--ea-teal); }
        .ea-login, .ea-button {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 8px; padding: 12px 17px; font-size: 13px;
          font-weight: 700; text-decoration: none; transition: .2s;
        }
        .ea-login {
          color: var(--ea-navy); border: 1px solid #cbd9df;
          white-space: nowrap;
        }
        .ea-button { background: var(--ea-teal); color: #fff; border: 1px solid var(--ea-teal); }
        .ea-button:hover { background: #087d7a; transform: translateY(-1px); }
        .ea-button-dark { background: var(--ea-navy); border-color: var(--ea-navy); }
        .ea-button-outline { background: transparent; color: var(--ea-navy); border-color: #cbd9df; }
        .ea-hero {
          background: linear-gradient(115deg, #edf5f7 0%, #e7f4f1 100%);
          padding: 75px 0 68px;
        }
        .ea-hero-grid {
          display: grid; grid-template-columns: 1.15fr .85fr;
          gap: 55px; align-items: center;
        }
        .ea-eyebrow {
          color: var(--ea-teal); font-size: 11px; font-weight: 800;
          letter-spacing: 2px; text-transform: uppercase;
        }
        .ea-hero h1 {
          color: var(--ea-navy); font: 800 clamp(37px, 5vw, 60px)/1.12 Manrope, sans-serif;
          letter-spacing: -2px; margin: 18px 0;
        }
        .ea-hero h1 span { color: var(--ea-teal); }
        .ea-hero-copy {
          max-width: 610px; color: var(--ea-muted);
          font-size: 16px; line-height: 1.85;
        }
        .ea-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 27px; }
        .ea-hero-points {
          display: flex; gap: 19px; flex-wrap: wrap;
          margin-top: 24px; color: #587183; font-size: 12px;
        }
        .ea-hero-art {
          background: #fff; border: 1px solid var(--ea-line);
          border-radius: 22px; padding: 28px;
          box-shadow: 0 22px 60px #183f5515;
        }
        .ea-art-head { display: flex; justify-content: space-between; align-items: center; }
        .ea-art-head strong { color: var(--ea-navy); font: 800 17px Manrope; }
        .ea-art-label { background: #e5f6f3; color: #087d7a; padding: 7px 10px; border-radius: 30px; font-size: 10px; font-weight: 700; }
        .ea-art-center {
          margin: 28px auto; width: 185px; height: 185px; border-radius: 50%;
          background: radial-gradient(circle, #e3f5f1 0 43%, #f5faf9 44%);
          border: 1px dashed #a6d6d0; display: grid; place-items: center;
          position: relative;
        }
        .ea-art-center strong {
          width: 85px; height: 85px; border-radius: 24px;
          background: linear-gradient(135deg, var(--ea-navy), var(--ea-teal));
          color: #fff; display: grid; place-items: center;
          font: 800 33px Manrope;
        }
        .ea-art-icon {
          position: absolute; background: #fff; padding: 10px;
          border-radius: 12px; box-shadow: 0 5px 18px #183f5517; font-size: 21px;
        }
        .ea-art-icon.one { top: 0; }
        .ea-art-icon.two { right: -3px; }
        .ea-art-icon.three { bottom: 0; }
        .ea-art-icon.four { left: -3px; }
        .ea-art-bottom { border-top: 1px solid var(--ea-line); padding-top: 17px; }
        .ea-art-bottom b { color: var(--ea-navy); font: 700 15px Manrope; }
        .ea-art-bottom p { color: var(--ea-muted); font-size: 12px; line-height: 1.6; }
        .ea-section { padding: 68px 0; }
        .ea-section-heading {
          display: flex; align-items: end; justify-content: space-between;
          gap: 20px; margin-bottom: 27px;
        }
        .ea-section h2 {
          font: 800 clamp(25px, 3vw, 32px)/1.25 Manrope, sans-serif;
          letter-spacing: -1px; color: var(--ea-navy); margin: 9px 0 0;
        }
        .ea-section-intro { color: var(--ea-muted); font-size: 14px; line-height: 1.7; margin: 9px 0 0; }
        .ea-text-link { color: var(--ea-teal); font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
        .ea-category-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .ea-category {
          padding: 19px 12px; border: 1px solid var(--ea-line); border-radius: 13px;
          background: #fff; text-align: center; text-decoration: none; transition: .2s;
        }
        .ea-category:hover, .ea-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px #183f5510; }
        .ea-category-icon { font-size: 26px; }
        .ea-category b { display: block; margin: 10px 0 5px; color: var(--ea-navy); font-size: 13px; }
        .ea-category small { color: var(--ea-muted); font-size: 10px; line-height: 1.5; }
        .ea-muted-section { background: var(--ea-soft); }
        .ea-card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .ea-card {
          background: #fff; border: 1px solid var(--ea-line); border-radius: 15px;
          padding: 21px; display: flex; flex-direction: column; min-height: 230px;
          transition: .2s; text-decoration: none;
        }
        .ea-card-icon {
          width: 48px; height: 48px; border-radius: 13px;
          display: grid; place-items: center; font-size: 25px;
          background: #eaf5f5;
        }
        .ea-card h3 { color: var(--ea-navy); font: 800 17px Manrope; margin: 17px 0 8px; }
        .ea-card p { color: var(--ea-muted); font-size: 12px; line-height: 1.7; margin: 0 0 18px; }
        .ea-card-link { color: var(--ea-teal); font-size: 12px; font-weight: 800; margin-top: auto; }
        .ea-promo {
          background: linear-gradient(115deg, #102b46, #14566a);
          color: #fff; border-radius: 18px; padding: 35px;
          display: flex; align-items: center; justify-content: space-between; gap: 25px;
        }
        .ea-promo h2 { color: #fff; margin: 8px 0; font: 800 26px Manrope; }
        .ea-promo p { color: #d4e4ea; font-size: 13px; line-height: 1.7; max-width: 650px; }
        .ea-promo .ea-eyebrow { color: #82ded3; }
        .ea-promo .ea-button { background: #fff; color: var(--ea-navy); border-color: #fff; white-space: nowrap; }
        .ea-job-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 25px; }
        .ea-job-card {
          border: 1px solid var(--ea-line); border-radius: 13px;
          padding: 19px; background: #fff; text-decoration: none;
        }
        .ea-job-card b { display: block; color: var(--ea-navy); margin: 10px 0 5px; font: 800 14px Manrope; }
        .ea-job-card small { color: var(--ea-muted); font-size: 11px; }
        .ea-jobs-banner {
          margin-top: 23px; padding: 22px 25px; border-radius: 14px;
          background: #e9f6f8; border: 1px solid #cde7e9;
          display: flex; justify-content: space-between; align-items: center; gap: 18px;
        }
        .ea-jobs-banner b { color: var(--ea-navy); font: 800 16px Manrope; }
        .ea-jobs-banner p { color: var(--ea-muted); font-size: 12px; margin: 6px 0 0; line-height: 1.6; }
        .ea-pyq-panel {
          background: #fff; border: 1px solid var(--ea-line); border-radius: 17px;
          padding: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 25px; align-items: center;
        }
        .ea-pyq-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ea-pyq-item { background: var(--ea-soft); padding: 14px; border-radius: 10px; color: var(--ea-navy); font-size: 12px; font-weight: 700; }
        .ea-footer { background: #0b2035; color: #d7e3e9; padding: 45px 0 25px; }
        .ea-footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 28px; }
        .ea-footer h3 { color: #fff; font: 800 14px Manrope; margin: 0 0 15px; }
        .ea-footer p { color: #aabac4; font-size: 12px; line-height: 1.8; max-width: 300px; }
        .ea-footer a { display: block; color: #c8d5dc; font-size: 12px; margin: 10px 0; text-decoration: none; }
        .ea-footer a:hover { color: #fff; }
        .ea-footer-bottom { border-top: 1px solid #ffffff20; margin-top: 28px; padding-top: 18px; color: #9fb0bb; font-size: 11px; }
        .ea-contact-section {
          background: #f4f8fa;
          padding: 76px 0;
        }
        .ea-contact-grid {
          display: grid;
          grid-template-columns: .9fr 1.1fr;
          gap: 42px;
          align-items: center;
        }
        .ea-contact-copy h2 {
          color: var(--ea-navy);
          font: 800 clamp(28px, 3vw, 36px)/1.2 Manrope, sans-serif;
          letter-spacing: -1px;
          margin: 12px 0;
        }
        .ea-contact-copy > p {
          color: var(--ea-muted);
          font-size: 14px;
          line-height: 1.8;
          max-width: 470px;
        }
        .ea-contact-email {
          margin-top: 26px;
          padding: 19px;
          background: #fff;
          border: 1px solid var(--ea-line);
          border-radius: 13px;
        }
        .ea-contact-email span {
          display: block;
          color: var(--ea-muted);
          font-size: 11px;
          margin-bottom: 7px;
        }
        .ea-contact-email a {
          color: var(--ea-teal);
          font-size: 15px;
          font-weight: 800;
          text-decoration: none;
          overflow-wrap: anywhere;
        }
        .ea-feedback-form {
          background: #fff;
          border: 1px solid var(--ea-line);
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 15px 38px #183f550b;
        }
        .ea-feedback-form h3 {
          color: var(--ea-navy);
          font: 800 20px Manrope, sans-serif;
          margin: 0 0 20px;
        }
        .ea-feedback-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .ea-feedback-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-bottom: 15px;
        }
        .ea-feedback-field label {
          color: #344b60;
          font-size: 12px;
          font-weight: 700;
        }
        .ea-feedback-field input,
        .ea-feedback-field select,
        .ea-feedback-field textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 13px;
          border: 1px solid #d8e2e8;
          border-radius: 8px;
          background: #fbfdfe;
          color: var(--ea-ink);
          font: 13px "DM Sans", sans-serif;
          outline: none;
        }
        .ea-feedback-field input:focus,
        .ea-feedback-field select:focus,
        .ea-feedback-field textarea:focus {
          border-color: var(--ea-teal);
          box-shadow: 0 0 0 3px #129b9818;
        }
        .ea-feedback-field textarea {
          resize: vertical;
          min-height: 125px;
        }
        .ea-feedback-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--ea-teal);
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 13px 20px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }
        .ea-feedback-submit:hover { background: #087d7a; }
        .ea-feedback-submit:disabled { opacity: .65; cursor: not-allowed; }
        .ea-feedback-note {
          color: var(--ea-muted);
          font-size: 11px;
          line-height: 1.6;
          margin: 12px 0 0;
        }
        @media(max-width:950px) {
          .ea-nav-links { gap: 10px; }
          .ea-nav-links a { font-size: 11px; }
          .ea-category-grid { grid-template-columns: repeat(3, 1fr); }
          .ea-card-grid { grid-template-columns: repeat(2, 1fr); }
          .ea-job-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media(max-width:700px) {
          .ea-wrap { width: min(100% - 28px, 560px); }
          .ea-top-inner span:last-child { display: none; }
          .ea-nav-inner { min-height: 68px; flex-wrap: wrap; padding: 10px 0; }
          .ea-nav-links { order: 3; width: 100%; justify-content: flex-start; overflow-x: auto; padding: 8px 0 3px; flex-wrap: nowrap; }
          .ea-nav-links a { white-space: nowrap; font-size: 12px; }
          .ea-brand { font-size: 17px; }
          .ea-brand-mark { width: 38px; height: 38px; }
          .ea-login { padding: 9px 11px; font-size: 11px; }
          .ea-hero { padding: 48px 0; }
          .ea-hero-grid { grid-template-columns: 1fr; gap: 32px; }
          .ea-hero h1 { font-size: 39px; }
          .ea-hero-art { padding: 20px; }
          .ea-section { padding: 48px 0; }
          .ea-section-heading { align-items: flex-start; flex-direction: column; }
          .ea-category-grid { grid-template-columns: repeat(2, 1fr); }
          .ea-card-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ea-card { padding: 15px; min-height: 225px; }
          .ea-card h3 { font-size: 14px; }
          .ea-card p { font-size: 11px; }
          .ea-promo { padding: 25px; flex-direction: column; align-items: flex-start; }
          .ea-job-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
          .ea-job-card { padding: 14px; }
          .ea-jobs-banner { flex-direction: column; align-items: flex-start; }
          .ea-pyq-panel { grid-template-columns: 1fr; padding: 20px; }
          .ea-pyq-list { grid-template-columns: 1fr 1fr; }
          .ea-contact-grid { grid-template-columns: 1fr; gap: 28px; }
          .ea-feedback-form { padding: 22px; }
          .ea-footer-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
        }
        @media(max-width:390px) {
          .ea-card-grid { grid-template-columns: 1fr; }
          .ea-footer-grid { grid-template-columns: 1fr; }
          .ea-hero h1 { font-size: 34px; }
        }
      `}</style>

      <div className="ea-top">
        <div className="ea-wrap ea-top-inner">
          <span>Learn. Prepare. Progress. — Your learning journey starts here.</span>
          <span>Learning opportunities across India · Bihar focus</span>
        </div>
      </div>

      <header className="ea-nav">
        <div className="ea-wrap ea-nav-inner">
          <a href="/" className="ea-brand">
            <span className="ea-brand-mark">E</span>
            <span>EduAxis India<small>LEARN. PREPARE. PROGRESS.</small></span>
          </a>
          <nav className="ea-nav-links" aria-label="Main navigation">
            <a href="/courses">Courses</a>
            <a href="/mock-tests">Mock Tests</a>
            <a href="/study-materials">Study Materials</a>
            <a href="/government-jobs">Government Jobs</a>
            <a href="/blogs">Blogs</a>
          </nav>
          <a className="ea-login" href="/student/login">Student Login</a>
        </div>
      </header>

      <section className="ea-hero">
        <div className="ea-wrap ea-hero-grid">
          <div>
            <div className="ea-eyebrow">Your learning · Your preparation · Your future</div>
            <h1>Your destination for <span>learning, preparation</span> and career growth.</h1>
            <p className="ea-hero-copy">
              Explore mock tests, previous-year questions, online courses,
              study materials and the latest government job opportunities.
              Everything you need to take your next step with confidence.
            </p>
            <div className="ea-hero-actions">
              <a className="ea-button" href="/mock-tests">Explore Mock Tests →</a>
              <a className="ea-button ea-button-outline" href="/government-jobs">Latest Government Jobs</a>
            </div>
            <div className="ea-hero-points">
              <span>✓ Free learning previews</span>
              <span>✓ Exam-focused resources</span>
              <span>✓ Academic and career updates</span>
            </div>
          </div>
          <div className="ea-hero-art">
            <div className="ea-art-head">
              <strong>EduAxis Learning Hub</strong>
              <span className="ea-art-label">LEARN · PREPARE · PROGRESS</span>
            </div>
            <div className="ea-art-center">
              <strong>E</strong>
              <span className="ea-art-icon one">📚</span>
              <span className="ea-art-icon two">🎯</span>
              <span className="ea-art-icon three">🎓</span>
              <span className="ea-art-icon four">📈</span>
            </div>
            <div className="ea-art-bottom">
              <b>One platform. Many possibilities.</b>
              <p>Build knowledge, practise with purpose and stay informed about opportunities.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ea-section">
        <div className="ea-wrap">
          <div className="ea-section-heading">
            <div>
              <div className="ea-eyebrow">Find your examination</div>
              <h2>Explore popular exam categories</h2>
              <p className="ea-section-intro">Discover preparation resources for important academic and competitive examinations.</p>
            </div>
            <a className="ea-text-link" href="/mock-tests">Explore preparation →</a>
          </div>
          <div className="ea-category-grid">
            {examCategories.map((exam) => (
              <a className="ea-category" href="/mock-tests" key={exam.name}>
                <div className="ea-category-icon">{exam.icon}</div>
                <b>{exam.name}</b>
                <small>{exam.detail}</small>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="ea-section ea-muted-section">
        <div className="ea-wrap">
          <div className="ea-section-heading">
            <div>
              <div className="ea-eyebrow">Practise · Evaluate · Improve</div>
              <h2>Popular Mock Test Series</h2>
              <p className="ea-section-intro">Explore examination-wise practice opportunities and available test series.</p>
            </div>
            <a className="ea-text-link" href="/mock-tests">View all mock tests →</a>
          </div>
          <div className="ea-card-grid">
            {mockTests.map((test) => (
              <a className="ea-card" href="/mock-tests" key={test.name}>
                <div className="ea-card-icon">{test.icon}</div>
                <h3>{test.name} Mock Tests</h3>
                <p>{test.detail}. Explore available practice and test-series options.</p>
                <span className="ea-card-link">Explore test series →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="ea-section">
        <div className="ea-wrap">
          <div className="ea-pyq-panel">
            <div>
              <div className="ea-eyebrow">Learn from previous examinations</div>
              <h2>Previous Year Questions (PYQs)</h2>
              <p className="ea-section-intro">
                Strengthen your preparation with examination-oriented previous-year
                questions, practice resources and subject-wise learning material.
              </p>
              <div className="ea-hero-actions">
                <a className="ea-button ea-button-dark" href="/study-materials">Explore Study Materials →</a>
              </div>
            </div>
            <div className="ea-pyq-list">
              <div className="ea-pyq-item">📘 Examination-wise questions</div>
              <div className="ea-pyq-item">📝 Subject-wise practice</div>
              <div className="ea-pyq-item">📅 Previous exam papers</div>
              <div className="ea-pyq-item">🎯 Preparation resources</div>
            </div>
          </div>
        </div>
      </section>

      <section className="ea-section ea-muted-section">
        <div className="ea-wrap">
          <div className="ea-section-heading">
            <div>
              <div className="ea-eyebrow">Structured learning</div>
              <h2>Featured Online Courses</h2>
              <p className="ea-section-intro">Explore academic and competitive-examination courses from EduAxis India.</p>
            </div>
            <a className="ea-text-link" href="/courses">View all courses →</a>
          </div>
          <div className="ea-card-grid">
            <a className="ea-card" href="/courses">
              <div className="ea-card-icon">📒</div>
              <h3>Commerce Courses</h3>
              <p>Explore Accountancy, Business Studies and Economics learning opportunities.</p>
              <span className="ea-card-link">Explore courses →</span>
            </a>
            <a className="ea-card" href="/courses">
              <div className="ea-card-icon">🏫</div>
              <h3>School Education</h3>
              <p>Discover class-wise academic courses and structured learning resources.</p>
              <span className="ea-card-link">Explore courses →</span>
            </a>
            <a className="ea-card" href="/courses">
              <div className="ea-card-icon">🎯</div>
              <h3>Competitive Exams</h3>
              <p>Explore preparation programmes for competitive examinations.</p>
              <span className="ea-card-link">Explore courses →</span>
            </a>
            <a className="ea-card" href="/courses">
              <div className="ea-card-icon">💡</div>
              <h3>Skill Development</h3>
              <p>Discover practical learning and career-oriented skill development.</p>
              <span className="ea-card-link">Explore courses →</span>
            </a>
          </div>
        </div>
      </section>

      <section className="ea-section">
        <div className="ea-wrap">
          <div className="ea-section-heading">
            <div>
              <div className="ea-eyebrow">Learn at your own pace</div>
              <h2>Explore Learning Resources</h2>
              <p className="ea-section-intro">Start with available free resources and discover additional learning materials.</p>
            </div>
            <a className="ea-text-link" href="/study-materials">Browse materials →</a>
          </div>
          <div className="ea-card-grid">
            {services.slice(0, 3).map((service) => (
              <a className="ea-card" href={service.href} key={service.title}>
                <div className="ea-card-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <span className="ea-card-link">{service.link} →</span>
              </a>
            ))}
            <a className="ea-card" href="/blogs">
              <div className="ea-card-icon">📰</div>
              <h3>Educational Blogs</h3>
              <p>Read educational articles, career guidance and important academic updates.</p>
              <span className="ea-card-link">Read articles →</span>
            </a>
          </div>
        </div>
      </section>

      <section className="ea-section ea-muted-section" id="government-jobs">
        <div className="ea-wrap">
          <div className="ea-section-heading">
            <div>
              <div className="ea-eyebrow">Stay informed · Plan ahead</div>
              <h2>Government Jobs & Recruitment Updates</h2>
              <p className="ea-section-intro">
                Explore Central and State Government recruitment information,
                teaching vacancies, examination notices and important updates.
                This section is open to all visitors.
              </p>
            </div>
            <a className="ea-text-link" href="/government-jobs">View all updates →</a>
          </div>
          <div className="ea-job-grid">
            {jobCategories.map((category) => (
              <a className="ea-job-card" href="/government-jobs" key={category.name}>
                <div className="ea-card-icon">{category.icon}</div>
                <b>{category.name}</b>
                <small>{category.detail}</small>
              </a>
            ))}
          </div>
          <div className="ea-jobs-banner">
            <div>
              <b>Looking for your next opportunity?</b>
              <p>Browse recruitment information, eligibility details and official application links.</p>
            </div>
            <a className="ea-button" href="/government-jobs">Explore Government Jobs →</a>
          </div>
        </div>
      </section>

      <section className="ea-section">
        <div className="ea-wrap">
          <div className="ea-promo">
            <div>
              <div className="ea-eyebrow">Knowledge · Guidance · Growth</div>
              <h2>Stay informed with EduAxis India</h2>
              <p>Read educational articles, academic updates, career guidance and useful information for students, teachers and lifelong learners.</p>
            </div>
            <a className="ea-button" href="/blogs">Explore Educational Blogs →</a>
          </div>
        </div>
      </section>

      <section className="ea-section ea-muted-section">
        <div className="ea-wrap">
          <div className="ea-section-heading">
            <div>
              <div className="ea-eyebrow">Your learning ecosystem</div>
              <h2>Everything you need to move forward</h2>
              <p className="ea-section-intro">Explore the EduAxis India platform and choose the resources that support your goals.</p>
            </div>
          </div>
          <div className="ea-card-grid">
            {services.map((service) => (
              <a className="ea-card" href={service.href} key={service.title}>
                <div className="ea-card-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <span className="ea-card-link">{service.link} →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="ea-contact-section" id="contact">
        <div className="ea-wrap ea-contact-grid">
          <div className="ea-contact-copy">
            <div className="ea-eyebrow">We are here to help</div>
            <h2>We'd Love to Hear From You</h2>
            <p>
              Have a question, suggestion or feedback? Contact the EduAxis India
              team. Your thoughts help us make learning better.
            </p>
            <div className="ea-contact-email">
              <span>Official Contact Email</span>
              <a href="mailto:eduaxisindiateam@gmail.com">
                eduaxisindiateam@gmail.com
              </a>
            </div>
          </div>

          <form
            className="ea-feedback-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              setFeedbackStatus("");
              setFeedbackSubmitting(true);

              try {
                const response = await fetch("/api/feedback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: data.get("name"),
                    email: data.get("email"),
                    subject: data.get("subject"),
                    message: data.get("message"),
                  }),
                });

                const result = await response.json();
                if (!response.ok) {
                  throw new Error(result.error || "Your feedback could not be submitted.");
                }

                form.reset();
                setFeedbackStatus("success: Thank you! Your feedback has been submitted successfully.");
              } catch (error) {
                setFeedbackStatus(
                  `error: ${error instanceof Error ? error.message : "Something went wrong. Please try again."}`
                );
              } finally {
                setFeedbackSubmitting(false);
              }
            }}
          >
            <h3>Send Us a Message</h3>

            <div className="ea-feedback-row">
              <div className="ea-feedback-field">
                <label htmlFor="ea-feedback-name">Your Name</label>
                <input
                  id="ea-feedback-name"
                  name="name"
                  type="text"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className="ea-feedback-field">
                <label htmlFor="ea-feedback-email">Email Address</label>
                <input
                  id="ea-feedback-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="ea-feedback-field">
              <label htmlFor="ea-feedback-subject">Subject</label>
              <select id="ea-feedback-subject" name="subject" required defaultValue="">
                <option value="" disabled>Select a subject</option>
                <option value="General Enquiry">General Enquiry</option>
                <option value="Online Courses">Online Courses</option>
                <option value="Mock Tests">Mock Tests</option>
                <option value="Study Materials">Study Materials</option>
                <option value="Government Jobs">Government Jobs</option>
                <option value="Website Feedback">Website Feedback</option>
                <option value="Technical Support">Technical Support</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="ea-feedback-field">
              <label htmlFor="ea-feedback-message">Message</label>
              <textarea
                id="ea-feedback-message"
                name="message"
                rows={5}
                placeholder="Write your message or feedback..."
                required
              />
            </div>

            <button type="submit" className="ea-feedback-submit" disabled={feedbackSubmitting}>
              {feedbackSubmitting ? "Submitting..." : "Submit Feedback →"}
            </button>
            {feedbackStatus && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  fontWeight: 600,
                  color: feedbackStatus.startsWith("success:") ? "#087d55" : "#b42318",
                }}
              >
                {feedbackStatus.replace(/^(success|error): /, "")}
              </p>
            )}
            <p className="ea-feedback-note">
              Your message is submitted securely to the EduAxis India team. No login is required.
            </p>
          </form>
        </div>
      </section>

      <footer className="ea-footer">
        <div className="ea-wrap">
          <div className="ea-footer-grid">
            <div>
              <a href="/" className="ea-brand" style={{ color: "#fff" }}>
                <span className="ea-brand-mark">E</span>
                <span>EduAxis India<small style={{ color: "#aabac4" }}>LEARN. PREPARE. PROGRESS.</small></span>
              </a>
              <p>Empowering learners with knowledge, examination preparation and career opportunities through accessible educational resources.</p>
            </div>
            <div>
              <h3>Learning</h3>
              <a href="/courses">Online Courses</a>
              <a href="/study-materials">Study Materials</a>
              <a href="/mock-tests">Mock Tests</a>
            </div>
            <div>
              <h3>Information</h3>
              <a href="/government-jobs">Government Jobs</a>
              <a href="/blogs">Educational Blogs</a>
            </div>
            <div>
              <h3>Student Area</h3>
              <a href="/student/login">Student Login</a>
              <a href="/student/register">Create Account</a>
              <a href="/student/dashboard">My Dashboard</a>
            </div>
          </div>
          <div className="ea-footer-bottom">
            © {new Date().getFullYear()} EduAxis India. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
