import type { Metadata } from "next";
import PublicInfoPage from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about EduAxis India and its educational resources for learners, teachers and examination aspirants.",
};

export default function AboutPage() {
  return (
    <PublicInfoPage
      eyebrow="Learn · Prepare · Progress"
      title="About EduAxis India"
      intro="An education and learning platform bringing study resources, examination preparation and career information together in one place."
    >
      <h2>Our purpose</h2>
      <p>EduAxis India aims to make useful learning resources and education-related information easier to discover. The platform brings together academic support, examination practice and career updates so learners can find relevant resources in one place.</p>

      <h2>What you can explore</h2>
      <ul>
        <li><strong>Study Materials:</strong> notes, PDFs and subject-focused learning resources.</li>
        <li><strong>Mock Tests:</strong> practice opportunities to help learners assess their preparation.</li>
        <li><strong>Online Courses:</strong> structured learning opportunities as they become available.</li>
        <li><strong>Examination Resources:</strong> school and board examinations, competitive examinations, entrance examinations and model questions.</li>
        <li><strong>Government Jobs &amp; Updates:</strong> recruitment information and links to relevant official notices.</li>
        <li><strong>Educational Blogs and Current Affairs:</strong> articles, guidance and knowledge updates.</li>
      </ul>

      <h2>Our approach</h2>
      <p>We aim to present information in a clear, accessible and learner-friendly format. Examination aspirants should always check the relevant official authority for final eligibility conditions, schedules, application instructions and results.</p>

      <h2>Connect with us</h2>
      <p>Follow EduAxis India for announcements and learning updates:</p>
      <ul>
        <li><a href="https://whatsapp.com/channel/0029Vb9hfdC9Gv7TbpnRxM3g" target="_blank" rel="noopener noreferrer">WhatsApp Channel</a></li>
        <li><a href="https://t.me/eduaxisindia" target="_blank" rel="noopener noreferrer">Telegram</a></li>
        <li><a href="https://www.instagram.com/eduaxisindiateam/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
        <li><a href="https://www.facebook.com/eduaxisindia/" target="_blank" rel="noopener noreferrer">Facebook</a></li>
      </ul>
    </PublicInfoPage>
  );
}
