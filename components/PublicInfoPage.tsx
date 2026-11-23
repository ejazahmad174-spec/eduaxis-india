import Link from "next/link";
import "./public-info.css";

type PublicInfoPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
};

export default function PublicInfoPage({ eyebrow, title, intro, children }: PublicInfoPageProps) {
  return (
    <main className="ea-info-page">
      <header className="ea-info-header">
        <div className="ea-info-wrap ea-info-brand-row">
          <Link href="/" className="ea-info-brand" aria-label="EduAxis India home">
            <span className="ea-info-brand-mark">E</span>
            <span>EduAxis India<small>LEARN. PREPARE. PROGRESS.</small></span>
          </Link>
          <Link href="/" className="ea-info-home-link">← Back to Home</Link>
        </div>
      </header>
      <section className="ea-info-hero">
        <div className="ea-info-wrap">
          <div className="ea-info-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </section>
      <article className="ea-info-wrap ea-info-content">
        {children}
        <div className="ea-info-contact">
          <strong>Need help?</strong>
          <p>Contact the EduAxis India team at <a href="mailto:eduaxisindiateam@gmail.com">eduaxisindiateam@gmail.com</a>.</p>
        </div>
      </article>
      <footer className="ea-info-footer">
        <div className="ea-info-wrap">
          <span>© {new Date().getFullYear()} EduAxis India. Learn. Prepare. Progress.</span>
          <nav aria-label="Footer links">
            <Link href="/about">About</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-and-conditions">Terms</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
