import type { Metadata } from "next";
import Link from "next/link";
import PublicInfoPage from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact the EduAxis India team with questions, suggestions or feedback.",
};

export default function ContactPage() {
  return (
    <PublicInfoPage
      eyebrow="We are here to help"
      title="Contact EduAxis India"
      intro="Have a question, suggestion or feedback? We welcome your message and will review it as soon as reasonably possible."
    >
      <h2>Get in touch</h2>
      <p><strong>Email:</strong> <a href="mailto:eduaxisindiateam@gmail.com">eduaxisindiateam@gmail.com</a></p>
      <p>For a quicker message, you can also use the contact form on our homepage.</p>
      <p><Link href="/#contact">Go to the contact form →</Link></p>

      <h2>Follow our updates</h2>
      <ul>
        <li><a href="https://whatsapp.com/channel/0029Vb9hfdC9Gv7TbpnRxM3g" target="_blank" rel="noopener noreferrer">WhatsApp Channel</a></li>
        <li><a href="https://t.me/eduaxisindia" target="_blank" rel="noopener noreferrer">Telegram</a></li>
        <li><a href="https://www.instagram.com/eduaxisindiateam/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
        <li><a href="https://www.facebook.com/eduaxisindia/" target="_blank" rel="noopener noreferrer">Facebook</a></li>
      </ul>
    </PublicInfoPage>
  );
}
