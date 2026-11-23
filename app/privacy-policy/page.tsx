import type { Metadata } from "next";
import PublicInfoPage from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how EduAxis India collects, uses and protects information when you use our website and learning services.",
};

export default function PrivacyPolicyPage() {
  return (
    <PublicInfoPage
      eyebrow="Your information matters"
      title="Privacy Policy"
      intro="This policy explains how EduAxis India handles information when you browse our website, create a student account, contact us or use our learning services."
    >
      <div className="ea-info-updated">Last updated: 24 November 2026</div>

      <h2>1. About this policy</h2>
      <p>EduAxis India ("we", "us" or "our") operates eduaxisindia.com and related learning services. We aim to handle personal information responsibly and use it only for clear, legitimate website and service purposes. This policy should be read with our Terms &amp; Conditions.</p>

      <h2>2. Information we may collect</h2>
      <p>Depending on how you use the website, information may include:</p>
      <ul>
        <li><strong>Contact and feedback details:</strong> name, email address, subject and message that you submit through our website contact form.</li>
        <li><strong>Student account details:</strong> name, email address and account-related information that you provide when registering or using a student account.</li>
        <li><strong>Learning and service information:</strong> course, study-material or mock-test activity needed to provide the relevant feature, where that feature is enabled.</li>
        <li><strong>Technical information:</strong> basic device, browser, log and diagnostic information that may be processed by the website infrastructure to operate, secure and troubleshoot the service.</li>
      </ul>
      <p>Please do not include passwords, payment card details or other sensitive information in a feedback message.</p>

      <h2>3. How we use information</h2>
      <p>We may use the information described above to create and maintain accounts, respond to enquiries, provide requested learning features, administer courses or assessments, maintain website security, prevent misuse, troubleshoot problems and meet applicable legal obligations. We do not describe student marks, activity or account details publicly.</p>

      <h2>4. Contact form and account services</h2>
      <p>When you submit the website feedback form, the name, email address, subject and message you enter are sent to our application backend and stored in our website feedback database so the team can review and respond. Student registration and sign-in are provided through the website's account service. Please keep your login credentials confidential and notify us if you believe your account has been used without permission.</p>

      <h2>5. Service providers and sharing</h2>
      <p>We use third-party infrastructure and service providers to operate the website and its features. These may include hosting, database and authentication providers, and—if a payment feature is offered for a particular service—a payment provider shown during checkout. Such providers may process information needed to deliver their services under their own terms and privacy practices. We do not sell personal information.</p>
      <p>We may also disclose information where reasonably necessary to comply with law, respond to valid legal process, protect users or the website, or address fraud and security issues.</p>

      <h2>6. Payments</h2>
      <p>If a paid course or other paid feature is made available, the checkout page will identify the applicable payment provider and show the information required to complete the transaction. Payment processing may be handled by that provider. Please review the provider's privacy notice and terms before completing a payment. Do not send card numbers, UPI PINs, passwords or one-time passwords to EduAxis India by email or through the feedback form.</p>

      <h2>7. Cookies and similar technologies</h2>
      <p>The website or its infrastructure may use essential cookies or similar technologies for functions such as account sessions, security and service operation. If optional analytics, advertising or other non-essential tracking tools are introduced, this policy and any required notices or choices will be updated before or when those tools are used.</p>

      <h2>8. Data retention and security</h2>
      <p>We retain information for as long as reasonably necessary for the purpose for which it was collected, to provide the service, resolve disputes, maintain required records and meet legal obligations. Retention periods may differ by information type. We use reasonable technical and organisational measures intended to protect information, but no internet transmission or storage system can be guaranteed to be completely secure.</p>

      <h2>9. Your choices and requests</h2>
      <p>You may contact us to request access to, correction of or deletion of personal information associated with you, subject to applicable law, verification, technical feasibility and any record-retention obligations. You may also stop using the website or ask for your account to be closed. We will explain if a request cannot be fully completed and why.</p>

      <h2>10. Children and student users</h2>
      <p>Some learning resources may be used by school-age learners. If you are under 18, please use account, communication and payment features with the involvement of a parent or lawful guardian where required. Parents or guardians who have a concern about a child's information may contact us. We do not ask users to post a child's sensitive personal information in public areas.</p>

      <h2>11. External websites</h2>
      <p>Our pages may link to government portals, examination authorities, social networks, payment providers or other external websites. Those websites are operated independently and have their own policies. We are not responsible for their content, security or privacy practices.</p>

      <h2>12. Changes to this policy</h2>
      <p>We may update this policy when our services, technology or legal obligations change. The revised version will be posted on this page with an updated date. Please review it periodically.</p>

      <h2>13. Contact</h2>
      <p>For privacy questions or requests, email <a href="mailto:eduaxisindiateam@gmail.com">eduaxisindiateam@gmail.com</a> with the subject line “Privacy Request”. Please do not send passwords or payment credentials.</p>
      <p>This policy is intended as a clear description of current website practices, not a legal opinion. It should be reviewed by an Indian privacy professional before being treated as final legal compliance documentation.</p>
    </PublicInfoPage>
  );
}
