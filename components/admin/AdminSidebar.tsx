'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  {
    label: 'WORKSPACE',
    links: [
      { href: '/admin/dashboard', title: 'Dashboard', icon: '▦' },
    ],
  },
  {
    label: 'CONTENT MANAGEMENT',
    links: [
      { href: '/admin/study-materials', title: 'Study Materials', icon: '▤' },
      { href: '/admin/government-jobs', title: 'Government Jobs', icon: '💼' },
      { href: '/admin/government-jobs/discoveries', title: 'Discovered Notices', icon: '↳', child: true },
      { href: '/admin/career-updates', title: 'Career Updates', icon: '▤' },
      { href: '/admin/courses', title: 'Online Courses', icon: '🎓' },
      { href: '/admin/mock-tests', title: 'Mock Tests', icon: '📝' },
    ],
  },
  {
    label: 'BLOG MANAGEMENT',
    links: [
      { href: '/admin/author-management', title: 'Author Management', icon: '✍️' },
      { href: '/admin/blogs', title: 'Blog Management', icon: '📖' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand">
        <span className="admin-brand-mark">E</span>
        <span>
          EduAxis <b>India</b>
          <small>ADMINISTRATION</small>
        </span>
      </Link>

      {sections.map((section) => (
        <div key={section.label}>
          <div className="admin-side-label">{section.label}</div>
          {section.links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href === '/admin/government-jobs' &&
                pathname.startsWith('/admin/government-jobs/') &&
                pathname !== '/admin/government-jobs/discoveries');

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-side-link${active ? ' active' : ''}${link.child ? ' admin-side-child' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {link.icon} &nbsp; {link.title}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="admin-sidebar-bottom">
        <Link href="/">← View public website</Link>
      </div>
    </aside>
  );
}
