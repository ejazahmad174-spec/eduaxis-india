import Link from "next/link";

const categories = [
  { title: "National Affairs", detail: "Government, policies and important decisions", icon: "▤" },
  { title: "International Affairs", detail: "World events and global developments", icon: "◎" },
  { title: "Education & Exams", detail: "Education policies, examinations and schemes", icon: "⌂" },
  { title: "Bihar Special", detail: "State government and regional developments", icon: "⌖" },
];

export default function CurrentAffairsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f8fa", color: "#172b3d", padding: "48px 20px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#129b98", fontWeight: 700, textDecoration: "none" }}>← Back to EduAxis India</Link>
        <header style={{ margin: "28px 0 30px" }}>
          <p style={{ color: "#129b98", fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>EduAxis India · Daily Knowledge Update</p>
          <h1 style={{ color: "#102b46", fontSize: "clamp(30px, 5vw, 44px)", margin: "8px 0" }}>Daily Current Affairs</h1>
          <p style={{ color: "#657789", lineHeight: 1.7, maxWidth: 720 }}>A focused space for national and international developments, education and examination updates, and important news from Bihar.</p>
        </header>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {categories.map((category) => (
            <article key={category.title} style={{ background: "#e5f4f3", border: "1px solid #d4eae8", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#129b98", fontSize: 25, marginBottom: 12 }}>{category.icon}</div>
              <h2 style={{ color: "#102b46", fontSize: 17, margin: "0 0 7px" }}>{category.title}</h2>
              <p style={{ color: "#657789", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{category.detail}</p>
            </article>
          ))}
        </section>
        <section style={{ background: "#fff", border: "1px solid #e2eaed", borderRadius: 16, padding: 28, marginTop: 24 }}>
          <h2 style={{ color: "#102b46", fontSize: 20, marginTop: 0 }}>Daily updates</h2>
          <p style={{ color: "#657789", lineHeight: 1.7, marginBottom: 0 }}>No current-affairs articles have been published here yet. This page will display updates once they are reviewed and published by the EduAxis India team. No illustrative or unverified news is presented as fact.</p>
        </section>
      </div>
    </main>
  );
}
