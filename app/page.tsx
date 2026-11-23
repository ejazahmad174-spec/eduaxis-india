
"use client";
import './home.css';
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
  <a href="/career-updates">Government Jobs & Updates</a>
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
          <div className="ea-hero-art ea-hero-showcase">
            <div className="ea-art-head">
              <div>
                <span className="ea-showcase-kicker">WELCOME TO EDUAXIS INDIA</span>
                <strong>One platform. Many possibilities.</strong>
              </div>
              <span className="ea-art-label">LEARN · PREPARE · PROGRESS</span>
            </div>
            <p className="ea-showcase-copy">Choose where you want to begin. Explore learning, practise for exams and stay connected with opportunities.</p>
            <div className="ea-showcase-grid">
              <a className="ea-showcase-item" href="/courses">
                <span className="ea-showcase-icon">🎓</span>
                <span><b>Online Courses</b><small>Structured learning</small></span>
                <span className="ea-showcase-arrow">↗</span>
              </a>
              <a className="ea-showcase-item" href="/mock-tests">
                <span className="ea-showcase-icon">📝</span>
                <span><b>Mock Tests</b><small>Practise & evaluate</small></span>
                <span className="ea-showcase-arrow">↗</span>
              </a>
              <a className="ea-showcase-item" href="/government-jobs">
                <span className="ea-showcase-icon">💼</span>
                <span><b>Jobs & Updates</b><small>Career opportunities</small></span>
                <span className="ea-showcase-arrow">↗</span>
              </a>
              <a className="ea-showcase-item" href="/blogs">
                <span className="ea-showcase-icon">📚</span>
                <span><b>Educational Blogs</b><small>Ideas & guidance</small></span>
                <span className="ea-showcase-arrow">↗</span>
              </a>
            </div>
            <div className="ea-showcase-foot"><span className="ea-showcase-pulse"></span> Explore at your own pace · Open learning resources</div>
          </div>
        </div>
      </section>

      <section className="ea-current-affairs">
        <div className="ea-wrap ea-current-affairs-inner">
          <div className="ea-current-affairs-icon">📰</div>
          <div className="ea-current-affairs-copy">
            <span className="ea-eyebrow">Stay informed · Learn every day</span>
            <h2>Daily Current Affairs & Learning Updates</h2>
            <p>Explore educational insights, exam-related explainers and important updates through our open-access articles.</p>
          </div>
          <a className="ea-button ea-current-affairs-link" href="/blogs">Explore Latest Articles →</a>
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
