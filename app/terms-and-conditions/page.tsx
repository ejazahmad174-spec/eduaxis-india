import type { Metadata } from "next";
import PublicInfoPage from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Read the terms governing access to EduAxis India learning resources, courses, mock tests and website services.",
};

export default function TermsAndConditionsPage() {
  return (
    <PublicInfoPage
      eyebrow="Using EduAxis India"
      title="Terms & Conditions"
      intro="These terms explain the basic rules for accessing EduAxis India, using learning resources and student features, and communicating with our team."
    >
      <div className="ea-info-updated">Last updated: 24 November 2026</div>

      <h2>1. Acceptance of these terms</h2>
      <p>By accessing or using eduaxisindia.com and its related services, you agree to these Terms &amp; Conditions. If you do not agree, please do not use the website. Additional terms may apply to a specific course, assessment or paid service and will be shown with that service.</p>

      <h2>2. About EduAxis India</h2>
      <p>EduAxis India provides educational information and learning resources, which may include study materials, courses, mock tests, examination preparation content, educational articles and government-job or examination updates. The availability of individual features may change over time.</p>

      <h2>3. Educational information and no guarantee</h2>
      <p>Our materials are provided for general educational and informational purposes. They are not a substitute for official notifications, examination instructions, professional advice or the rules of the relevant authority. We make reasonable efforts to keep information useful and accurate, but we do not guarantee that every item is complete, current or error-free. Always verify eligibility, dates, fees, results and application instructions on the relevant official website before taking action.</p>
      <p>EduAxis India is an independent educational platform. Unless expressly stated, it is not affiliated with, endorsed by or operated by any government department, examination board, university or recruitment authority whose examinations or notices may be discussed on the website.</p>

      <h2>4. Student accounts</h2>
      <p>You are responsible for providing accurate registration information, keeping your login credentials secure and activity carried out through your account. Do not share your password or attempt to access another person's account. Please contact us promptly if you suspect unauthorised access. We may restrict or suspend access where reasonably necessary to protect the service, users or our systems.</p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the website for unlawful, fraudulent, abusive or misleading purposes.</li>
        <li>Attempt to disrupt, damage, probe or gain unauthorised access to the website, its accounts, databases or infrastructure.</li>
        <li>Upload malicious code, spam, unlawful material or content that infringes another person's rights.</li>
        <li>Copy, resell, redistribute or commercially exploit protected materials except where we have expressly permitted it or applicable law allows it.</li>
        <li>Misrepresent your identity, impersonate another person or interfere with another user's access.</li>
      </ul>

      <h2>6. Intellectual property</h2>
      <p>Unless a page states otherwise, the EduAxis India website design, branding, original text, graphics and materials made available by us are owned by or licensed to EduAxis India and are protected by applicable intellectual-property laws. You may use materials for personal, non-commercial learning where the relevant page permits it. You must not reproduce, publish, sell or distribute our protected content without prior permission, except as permitted by law. Third-party names, logos and materials remain the property of their respective owners and are used for identification or informational purposes.</p>

      <h2>7. Courses, tests and payments</h2>
      <p>Course contents, access periods, assessment availability, prices and other service-specific conditions will be shown with the relevant offering where applicable. If payment is required, review the price, description, payment provider and any refund or cancellation terms displayed before paying. A payment confirmation does not guarantee an examination result, selection, employment, admission or any particular academic outcome.</p>
      <p>Where a refund or cancellation policy is displayed for a particular paid service, that service-specific policy will apply. If no specific policy is displayed, contact us before making a purchase to clarify the applicable terms. Nothing in these terms limits rights that cannot lawfully be excluded under applicable consumer-protection law.</p>

      <h2>8. Third-party links and official notices</h2>
      <p>The website may link to external portals, including government and examination-authority websites. These links are provided for convenience and information. External websites are outside our control; you should read their own terms and privacy policies and rely on the relevant authority for official instructions.</p>

      <h2>9. Availability and changes</h2>
      <p>We may update, suspend or discontinue a page, feature or service for maintenance, security, operational or other legitimate reasons. We aim to keep the website available but do not promise uninterrupted or error-free access.</p>

      <h2>10. Limitation of liability</h2>
      <p>To the extent permitted by applicable law, EduAxis India will not be responsible for indirect or consequential loss arising from use of the website, reliance on third-party notices, temporary unavailability or user-generated content. Nothing in these terms excludes liability that cannot legally be excluded, including liability arising from fraud, wilful misconduct or other non-excludable obligations.</p>

      <h2>11. Privacy</h2>
      <p>Our handling of personal information is described in the <a href="/privacy-policy">Privacy Policy</a>, which forms part of these terms.</p>

      <h2>12. Changes to these terms</h2>
      <p>We may revise these terms as the website or applicable law changes. The updated version will be posted on this page with a new date. Continued use after an update takes effect indicates acceptance of the revised terms, to the extent permitted by law.</p>

      <h2>13. Governing law and contact</h2>
      <p>These terms are governed by the laws of India. Subject to applicable law and the jurisdiction of competent courts, disputes will be handled by the courts having jurisdiction under Indian law. For questions, contact <a href="mailto:eduaxisindiateam@gmail.com">eduaxisindiateam@gmail.com</a>.</p>
      <p>This is a practical website terms draft and is not a substitute for review by a qualified Indian lawyer, particularly before offering paid courses or services.</p>
    </PublicInfoPage>
  );
}
