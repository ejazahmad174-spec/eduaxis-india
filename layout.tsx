import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'EduAxis India | Learn. Prepare. Progress.', description: 'Study materials, exam preparation, government job updates and courses.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
