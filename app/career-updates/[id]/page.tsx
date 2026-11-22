
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};


export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;

  const baseUrl = "https://eduaxisindia.com";

  if (!supabase) {
    return {
      title: "Career Update",
      description:
        "Latest government jobs, recruitment notices, admit cards, results and education updates from EduAxis India.",
    };
  }

  // Check published career updates
  const { data: update } = await supabase
    .from("career_updates")
    .select("title, description, category, organization, exam_name")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (update) {
    const description =
      update.description ||
      [
        update.title,
        update.organization,
        update.exam_name,
        update.category?.replaceAll("_", " "),
        "Check eligibility, important details and official links on EduAxis India.",
      ]
        .filter(Boolean)
        .join(" - ");

    return {
      title: update.title,
      description: description.replace(/\s+/g, " ").trim().slice(0, 160),
      const cleanDescription = description.replace(/\s+/g, " ").trim().slice(0, 160);
      alternates: {
        canonical: `${baseUrl}/career-updates/${id}`,
      },
      openGraph: {
        title: update.title,
        description: description.slice(0, 160),
        url: `${baseUrl}/career-updates/${id}`,
        type: "article",
        siteName: "EduAxis India",
      },
    };
  }

  // Check published government jobs
  const { data: job } = await supabase
    .from("government_jobs")
    .select("title, organization, qualification, post_name, state")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!job) {
    return {
      title: "Career Update",
      description:
        "Explore the latest government jobs and recruitment updates on EduAxis India.",
    };
  }

  const jobDescription = [
    job.title,
    job.organization,
    job.post_name,
    job.qualification,
    job.state,
    "Check eligibility and application details on EduAxis India.",
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    title: job.title,
    description: jobDescription.replace(/\s+/g, " ").trim().slice(0, 160),
    alternates: {
      canonical: `${baseUrl}/career-updates/${id}`,
    },
    openGraph: {
      title: job.title,
      description: jobDescription.replace(/\s+/g, " ").trim().slice(0, 160),
      url: `${baseUrl}/career-updates/${id}`,
      type: "article",
      siteName: "EduAxis India",
    },
  };
}

export default async function CareerUpdateDetail({
  params,
}: Props) {
  const { id } = await params;

  if (!supabase) notFound();

  const { data: update } = await supabase
    .from("career_updates")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (update) {
    return (
      <main style={styles.page}>
        <article style={styles.card}>
          <Link href="/career-updates" style={styles.back}>
            ← Back to Career Updates
          </Link>

          <p style={styles.category}>
            {update.category.replaceAll("_", " ").toUpperCase()}
          </p>

          <h1 style={styles.heading}>{update.title}</h1>

          {update.organization && (
            <p><strong>Organization:</strong> {update.organization}</p>
          )}

          {update.exam_name && (
            <p><strong>Exam:</strong> {update.exam_name}</p>
          )}

          {update.notice_date && (
            <p><strong>Notice Date:</strong> {update.notice_date}</p>
          )}

          {update.description && (
            <section style={styles.section}>
              <h2>Overview</h2>
              <p style={styles.preline}>{update.description}</p>
            </section>
          )}

          {update.post_details && (
            <section style={styles.section}>
              <h2>Post Details</h2>
              <p style={styles.preline}>{update.post_details}</p>
            </section>
          )}

          {update.vacancy_details && (
            <section style={styles.section}>
              <h2>Vacancy Details</h2>
              <p style={styles.preline}>{update.vacancy_details}</p>
            </section>
          )}

          {update.educational_qualification && (
            <section style={styles.section}>
              <h2>Educational Qualification</h2>
              <p className="preline">{update.educational_qualification}</p>
            </section>
          )}

          {update.eligibility_details && (
            <section style={styles.section}>
              <h2>Eligibility</h2>
              <p style={styles.preline}>{update.eligibility_details}</p>
            </section>
          )}

          {update.age_limit_details && (
            <section style={styles.section}>
              <h2>Age Limit</h2>
              <p style={styles.preline}>{update.age_limit_details}</p>
            </section>
          )}

          {update.application_fee && (
            <section style={styles.section}>
              <h2>Application Fee</h2>
              <p style={styles.preline}>{update.application_fee}</p>
            </section>
          )}

          {update.important_dates && (
            <section style={styles.section}>
              <h2>Important Dates</h2>
              <p style={styles.preline}>{update.important_dates}</p>
            </section>
          )}

          <div style={styles.buttons}>
            {update.official_url && (
              <a href={update.official_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
                Official Website ↗
              </a>
            )}

            {update.download_url && (
              <a href={update.download_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
                Download Notification ↗
              </a>
            )}

            {update.apply_url && (
              <a href={update.apply_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
                Apply Online ↗
              </a>
            )}

            {update.admit_card_url && (
              <a href={update.admit_card_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
                Admit Card ↗
              </a>
            )}

            {update.result_url && (
              <a href={update.result_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
                View Result ↗
              </a>
            )}
          </div>
        </article>
      </main>
    );
  }

  const { data: job } = await supabase
    .from("government_jobs")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!job) notFound();

  return (
    <main style={styles.page}>
      <article style={styles.card}>
        <Link href="/career-updates" style={styles.back}>
          ← Back to Government Jobs
        </Link>

        <p style={styles.category}>
          {job.job_category || "Government Jobs"}
        </p>

        <h1 style={styles.heading}>{job.title}</h1>

        <p><strong>Organization:</strong> {job.organization || "Not specified"}</p>
        <p><strong>Post:</strong> {job.post_name || "As per notification"}</p>
        <p><strong>State:</strong> {job.state || "Not specified"}</p>
        <p><strong>Vacancies:</strong> {job.vacancies || "As per notification"}</p>
        <p><strong>Qualification:</strong> {job.qualification || "As per notification"}</p>
        <p><strong>Age Limit:</strong> {job.age_limit || "As per notification"}</p>
        <p><strong>Application Fee:</strong> {job.application_fee || "As per notification"}</p>
        <p><strong>Application Start:</strong> {job.application_start_date || "Not specified"}</p>
        <p><strong>Last Date:</strong> {job.last_date || "Not specified"}</p>

        <div style={styles.buttons}>
          {job.notification_url && (
            <a href={job.notification_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
              Official Notification ↗
            </a>
          )}

          {job.official_website && (
            <a href={job.official_website} target="_blank" rel="noopener noreferrer" style={styles.button}>
              Official Website ↗
            </a>
          )}

          {job.apply_url && (
            <a href={job.apply_url} target="_blank" rel="noopener noreferrer" style={styles.button}>
              Apply Online ↗
            </a>
          )}
        </div>
      </article>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f8fc",
    padding: "35px 16px",
    color: "#17324d",
  },
  card: {
    maxWidth: "900px",
    margin: "auto",
    background: "#fff",
    padding: "30px",
    borderRadius: "12px",
    border: "1px solid #e1e8ef",
    lineHeight: 1.8,
  },
  back: {
    display: "inline-block",
    marginBottom: "22px",
    color: "#126b45",
    textDecoration: "none",
    fontWeight: 700,
  },
  category: {
    color: "#126b45",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  heading: {
    fontSize: "clamp(25px, 4vw, 36px)",
    lineHeight: 1.3,
    color: "#102d49",
  },
  section: {
    marginTop: "24px",
    paddingTop: "12px",
    borderTop: "1px solid #e5ebf0",
  },
  preline: {
    whiteSpace: "pre-line",
  },
  buttons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "25px",
  },
  button: {
    display: "inline-block",
    background: "#126b45",
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "13px",
  },
};
