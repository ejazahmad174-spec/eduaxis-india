
const cards = [
  ['📘', 'Study Materials', 'Free and premium notes, PDFs and exam-wise resources.', '/study-materials'],
  ['🧪', 'Mock Tests', 'Practice with topic-wise and full-length tests.', '/mock-tests'],
  ['🎓', 'Online Courses', 'Structured learning for school and competitive exams.', '/courses'],
  ['💼', 'Government Jobs', 'Teaching and other government vacancy updates.', '/government-jobs'],
];

const exams = ['BPSC TRE', 'Bihar STET', 'CTET', 'DSSSB', 'KVS & NVS', 'BPSC', 'SSC', 'UPSC'];

export default function Home() {
  return (
    <main>
      <div className="top">
        <div className="wrap topin">
          <span>Learning opportunities for every student</span>
          <span>India-wide coverage · Bihar focus</span>
        </div>
      </div>

      <header className="wrap nav">
        <a href="/" className="brand">
          <i>E</i>
          <span>
            EduAxis <b>India</b>
            <small>LEARN. PREPARE. PROGRESS.</small>
          </span>
        </a>

        <nav>
          <a href="/government-jobs">Latest Government Jobs</a>
          <a href="/study-materials">Study Materials</a>
          <a href="/courses">Courses</a>
          <a href="/mock-tests">Mock Tests</a>
          <a href="/blogs">Educational Blogs</a>
        </nav>

        <a className="login" href="/student/login">Student Login</a>
      </header>

      <section className="hero">
        <div className="wrap heroGrid">
          <div>
            <label>YOUR LEARNING. YOUR FUTURE.</label>
            <h1>
              Your one-stop platform for smart preparation and career growth.
            </h1>
            <p>
              Find exam-ready study materials for school, college and competitive
              examinations, timely government job updates,
              career-focused educational blogs — all in one place. Learn smarter,
              stay informed and take confident steps towards your career goals
              with trusted, easy-to-understand content for every learner.
            </p>

            <div className="actions">
              <a className="btn" href="/study-materials">
                Explore Study Materials →
              </a>
              <a className="outline" href="/government-jobs">
                Latest Government Jobs
              </a>
            </div>

            <div className="checks">
              ✓ Exam-focused resources &nbsp;&nbsp; ✓ Free and premium learning
            </div>
          </div>

          <div className="visual">
            <div className="orbit">
              <strong>E</strong>
              <span>📚</span>
              <span>🎯</span>
              <span>🎓</span>
              <span>📈</span>
            </div>

            <h3>EduAxis India</h3>
            <p>Prepare with purpose.</p>
            <p>Build knowledge, confidence and a brighter future.</p>
            <div className="bar"><i /></div>
            <small>YOUR JOURNEY STARTS HERE</small>
          </div>
        </div>
      </section>

      <section className="wrap intro">
        <div>
          <b>All-in-one learning platform</b>
          <small>Resources for school, college and competitive examinations.</small>
        </div>
        <div><b>India</b><small>Wide coverage</small></div>
        <div><b>Bihar</b><small>Special focus</small></div>
        <div><b>Learn</b><small>At your pace</small></div>
      </section>

      <section className="wrap section" id="resources">
        <label>WHAT YOU NEED TO SUCCEED</label>
        <h2>Everything in one place</h2>
        <p className="sub">
          Explore learning and career resources designed to help you move forward.
        </p>

        <div className="cards">
          {cards.map((card) => (
            <article key={card[1]}>
              <div className="emoji">{card[0]}</div>
              <h3>{card[1]}</h3>
              <p>{card[2]}</p>
              <a href={card[3]}>Explore resources →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="exam" id="exams">
        <div className="wrap">
          <label>PREPARE FOR YOUR NEXT STEP</label>
          <h2>Popular exam categories</h2>
          <div className="pills">
            {exams.map((exam) => <span key={exam}>{exam} ↗</span>)}
          </div>
        </div>
      </section>

      <section className="wrap section" id="jobs">
        <label>STAY INFORMED</label>
        <h2>Latest Government Jobs</h2>
        <div className="notice">
          <b>Find the latest recruitment notifications</b>
          <p>
            Explore Central and State Government vacancies, teaching jobs and
            other recruitment updates. Check eligibility and important dates,
            then apply through official websites.
          </p>
          <a className="btn" href="/government-jobs">
            Explore Latest Government Jobs →
          </a>
        </div>
      </section>

      <section className="soft" id="courses">
        <div className="wrap section">
          <label>GROW YOUR KNOWLEDGE</label>
          <h2>Learning that moves you forward</h2>
          <p className="sub">
            Explore free and premium courses and structured learning opportunities.
          </p>
          <a className="btn" href="/courses">
            Explore Courses →
          </a>
        </div>
      </section>

      <section className="wrap section" id="mock-tests">
        <label>TEST YOUR PREPARATION</label>
        <h2>Practice with Mock Tests</h2>
        <p className="sub">
          Access free practice tests and premium examination test series.
        </p>
        <a className="btn" href="/mock-tests">
          Explore Mock Tests →
        </a>
      </section>

      <section className="wrap section" id="blogs">
        <label>KNOWLEDGE AND INFORMATION</label>
        <h2>Educational Blogs</h2>
        <p className="sub">
          Read educational articles, academic updates, career guidance and
          important information for students and teachers.
        </p>
        <a className="btn" href="/blogs">
          Read Educational Blogs →
        </a>
      </section>

      <footer>
        <div className="wrap">
          <b>EduAxis India</b>
          <p>Empowering learners with knowledge, preparation and opportunity.</p>
          <small>© {new Date().getFullYear()} EduAxis India. All rights reserved.</small>
        </div>
      </footer>
    </main>
  );
}
