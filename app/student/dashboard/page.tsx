'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StudentNavigation from '@/components/student/StudentNavigation';
import './dashboard.css';

type StudentProfile = {
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  course_type: string | null;
  class_level: number | null;
  subject: string | null;
  is_free: boolean | null;
  price: number | null;
};

type CourseEnrollment = {
  id: string;
  enrolled_at: string;
  course: Course | Course[] | null;
};

type MockTest = {
  id: string;
  title: string;
  exam_category: string | null;
  duration_minutes: number | null;
  total_marks: number | null;
  access_type: string;
  price: number | null;
  created_at: string;
};

type TestAttempt = {
  id: string;
  mock_test_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_marks: number | null;
  mock_test: { title: string; exam_category: string | null } | null;
};

type StudyMaterial = {
  id: string;
  title: string;
  exam_category: string;
  subject: string | null;
  class_level: string | null;
  access_type: string;
  created_at: string;
};

type CareerUpdate = {
  id: string;
  category: string;
  title: string;
  organization: string | null;
  exam_name: string | null;
  notice_date: string | null;
  last_date: string | null;
  created_at: string;
};

type StudentNotification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

function resolveCourse(value: Course | Course[] | null): Course | null {
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function scorePercentage(score: number | null, total: number | null) {
  if (score === null || total === null || total <= 0) return null;
  return Math.round((Number(score) / Number(total)) * 100);
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<CourseEnrollment[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<TestAttempt[]>([]);
  const [completedTestCount, setCompletedTestCount] = useState(0);
  const [availableTests, setAvailableTests] = useState<MockTest[]>([]);
  const [availableTestCount, setAvailableTestCount] = useState(0);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [materialCount, setMaterialCount] = useState(0);
  const [updates, setUpdates] = useState<CareerUpdate[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!supabase) {
        if (active) {
          setErrorMessage('The student service is not configured. Please try again later.');
          setLoading(false);
        }
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace('/student/login');
        return;
      }

      const user = authData.user;
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (profileError) {
        setErrorMessage('We could not load your profile. Please refresh the page or sign in again.');
        setLoading(false);
        return;
      }

      if (profileData.role === 'admin') {
        router.replace('/admin/dashboard');
        return;
      }

      setProfile({
        full_name: profileData.full_name || user.user_metadata?.full_name || 'Student',
        email: profileData.email || user.email || '',
        role: profileData.role || 'student',
      });

      const [
        enrolmentsResult,
        attemptsResult,
        testsResult,
        materialsResult,
        updatesResult,
        notificationsResult,
      ] = await Promise.all([
        supabase
          .from('course_enrollments')
          .select('id, enrolled_at, course:courses!course_enrollments_course_id_fkey(id, title, description, thumbnail_url, course_type, class_level, subject, is_free, price)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('enrolled_at', { ascending: false }),

        supabase
          .from('mock_test_attempts')
          .select('id, mock_test_id, started_at, submitted_at, score, total_marks, mock_test:mock_tests!mock_test_attempts_mock_test_id_fkey(title, exam_category)', { count: 'exact' })
          .eq('student_id', user.id)
          .eq('status', 'submitted')
          .order('submitted_at', { ascending: false })
          .limit(5),

        supabase
          .from('mock_tests')
          .select('id, title, exam_category, duration_minutes, total_marks, access_type, price, created_at', { count: 'exact' })
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(4),

        supabase
          .from('study_materials')
          .select('id, title, exam_category, subject, class_level, access_type, created_at', { count: 'exact' })
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(4),

        supabase
          .from('career_updates')
          .select('id, category, title, organization, exam_name, notice_date, last_date, created_at')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(4),

        supabase
          .from('student_notifications')
          .select('id, title, message, notification_type, link_url, is_read, created_at')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (!active) return;

      const warnings: string[] = [];

      if (enrolmentsResult.error) warnings.push('Your enrolled courses could not be loaded.');
      else setCourses((enrolmentsResult.data || []) as unknown as CourseEnrollment[]);

      if (attemptsResult.error) warnings.push('Your recent test results could not be loaded.');
      else {
        setRecentAttempts((attemptsResult.data || []) as unknown as TestAttempt[]);
        setCompletedTestCount(attemptsResult.count || 0);
      }

      if (testsResult.error) warnings.push('Available mock tests could not be loaded.');
      else {
        setAvailableTests((testsResult.data || []) as MockTest[]);
        setAvailableTestCount(testsResult.count || 0);
      }

      if (materialsResult.error) warnings.push('Study materials could not be loaded.');
      else {
        setMaterials((materialsResult.data || []) as StudyMaterial[]);
        setMaterialCount(materialsResult.count || 0);
      }

      if (updatesResult.error) warnings.push('Latest career updates could not be loaded.');
      else setUpdates((updatesResult.data || []) as CareerUpdate[]);

      if (notificationsResult.error) warnings.push('Your notifications could not be loaded.');
      else setNotifications((notificationsResult.data || []) as StudentNotification[]);

      setLoadWarnings(warnings);
      setLoading(false);
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  async function markNotificationRead(id: string) {
    if (!supabase) return;

    const { error } = await supabase
      .from('student_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setErrorMessage('We could not update that notification. Please try again.');
      return;
    }

    setNotifications(current =>
      current.map(notification =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    );
  }

  const averageRecentScore = useMemo(() => {
    const scored = recentAttempts.filter(
      attempt => attempt.score !== null && attempt.total_marks !== null && Number(attempt.total_marks) > 0
    );
    if (scored.length === 0) return null;
    const scoreTotal = scored.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);
    const marksTotal = scored.reduce((sum, attempt) => sum + Number(attempt.total_marks || 0), 0);
    if (marksTotal <= 0) return null;
    return Math.round((scoreTotal / marksTotal) * 100);
  }, [recentAttempts]);

  if (loading) {
    return (
      <main className="student-dashboard-loading">
        <div className="dashboard-loading-card">
          <div className="dashboard-spinner" aria-hidden="true" />
          <p>Preparing your learning dashboard…</p>
        </div>
      </main>
    );
  }

  if (errorMessage && !profile) {
    return (
      <main className="student-dashboard-loading">
        <section className="dashboard-error-card">
          <h1>Student Dashboard</h1>
          <p role="alert">{errorMessage}</p>
          <Link href="/student/login">Return to Student Login</Link>
        </section>
      </main>
    );
  }

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Student';

  return (
    <main className="student-dashboard-page">
      <StudentNavigation />

      <div className="student-dashboard-container">
        <section className="dashboard-welcome">
          <div className="dashboard-welcome-copy">
            <div className="dashboard-eyebrow">YOUR LEARNING SPACE</div>
            <h1>Welcome back, {firstName}!</h1>
            <p>Continue your learning journey with your courses, practice tests and study resources.</p>
            <Link className="dashboard-primary-link" href="/courses">Explore learning opportunities <span aria-hidden="true">→</span></Link>
          </div>
          <div className="dashboard-welcome-side">
            <div className="dashboard-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{profile?.full_name || 'Student'}</strong>
              <span>{profile?.email || 'Student account'}</span>
              <Link href="/student/profile">Manage profile</Link>
            </div>
          </div>
        </section>

        {errorMessage && <div className="dashboard-alert" role="alert">{errorMessage}</div>}
        {loadWarnings.length > 0 && (
          <div className="dashboard-warning" role="status">
            Some dashboard information is temporarily unavailable: {loadWarnings.join(' ')}
          </div>
        )}

        <section className="dashboard-stats" aria-label="Your learning summary">
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon">▣</span>
            <div><strong>{courses.length}</strong><span>Active Courses</span></div>
            <Link href="/courses" aria-label="Explore courses">View courses</Link>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon">✓</span>
            <div><strong>{completedTestCount}</strong><span>Tests Completed</span></div>
            <Link href="/mock-tests" aria-label="View mock tests">Practice more</Link>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon">%</span>
            <div><strong>{averageRecentScore === null ? '—' : String(averageRecentScore) + '%'}</strong><span>Average of Recent Tests</span></div>
            <span className="dashboard-stat-note">Based on latest 5 results</span>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-icon">✎</span>
            <div><strong>{availableTestCount}</strong><span>Available Mock Tests</span></div>
            <Link href="/mock-tests">Browse tests</Link>
          </article>
        </section>

        <section className="dashboard-panel dashboard-notifications-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="dashboard-kicker">IMPORTANT UPDATES</span>
              <h2>Notification Centre</h2>
              <p className="dashboard-notification-summary">
                {notifications.filter(notification => !notification.is_read).length} unread notification(s)
              </p>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="dashboard-empty">
              <strong>You are all caught up</strong>
              <p>Important course, test and platform announcements will appear here.</p>
            </div>
          ) : (
            <div className="dashboard-notification-list">
              {notifications.map(notification => (
                <article
                  className={'dashboard-notification-item' + (notification.is_read ? ' is-read' : '')}
                  key={notification.id}
                >
                  <div className="dashboard-notification-copy">
                    <div className="dashboard-notification-meta">
                      <span>{notification.notification_type.replace(/_/g, ' ')}</span>
                      <time>{formatDate(notification.created_at)}</time>
                    </div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    {notification.link_url && (
                      <a href={notification.link_url} target="_blank" rel="noreferrer">
                        Open related page →
                      </a>
                    )}
                  </div>
                  {!notification.is_read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-kicker">KEEP LEARNING</span><h2>My Courses</h2></div>
              <Link href="/courses">Explore courses →</Link>
            </div>
            {courses.length === 0 ? (
              <div className="dashboard-empty">
                <strong>No active course enrolments yet</strong>
                <p>Browse available courses and enrol in a course to see it here.</p>
                <Link href="/courses">Find a course</Link>
              </div>
            ) : (
              <div className="dashboard-course-list">
                {courses.slice(0, 4).map(enrolment => {
                  const course = resolveCourse(enrolment.course);
                  if (!course) return null;
                  return (
                    <article className="dashboard-course-item" key={enrolment.id}>
                      <div className="dashboard-course-thumb">
                        {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" /> : <span aria-hidden="true">EA</span>}
                      </div>
                      <div className="dashboard-course-info">
                        <strong>{course.title}</strong>
                        <span>{[course.subject, course.class_level ? 'Class ' + course.class_level : null].filter(Boolean).join(' · ') || (course.course_type || 'Learning course')}</span>
                        <small>Enrolled {formatDate(enrolment.enrolled_at)}</small>
                      </div>
                      <Link href={'/courses/' + course.id} aria-label={'Open ' + course.title}>Open course →</Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-kicker">PRACTISE & IMPROVE</span><h2>Available Mock Tests</h2></div>
              <Link href="/mock-tests">View all →</Link>
            </div>
            {availableTests.length === 0 ? (
              <div className="dashboard-empty">
                <strong>No published mock tests right now</strong>
                <p>New practice tests will appear here when they are published.</p>
              </div>
            ) : (
              <div className="dashboard-list">
                {availableTests.map(test => (
                  <article className="dashboard-list-item" key={test.id}>
                    <div className="dashboard-list-main">
                      <strong>{test.title}</strong>
                      <span>{test.exam_category || 'General practice'} · {test.duration_minutes || '—'} min · {test.total_marks ?? '—'} marks</span>
                    </div>
                    <span className={test.access_type === 'paid' ? 'dashboard-tag dashboard-tag-paid' : 'dashboard-tag'}>{test.access_type === 'paid' ? 'Paid · ₹' + Number(test.price || 0).toLocaleString('en-IN') : 'Free'}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-kicker">YOUR PERFORMANCE</span><h2>Recent Test Results</h2></div>
              <Link href="/mock-tests">Practise again →</Link>
            </div>
            {recentAttempts.length === 0 ? (
              <div className="dashboard-empty">
                <strong>Your test results will appear here</strong>
                <p>Complete a mock test to start tracking your recent performance.</p>
                <Link href="/mock-tests">Start a mock test</Link>
              </div>
            ) : (
              <div className="dashboard-list">
                {recentAttempts.map(attempt => {
                  const percent = scorePercentage(attempt.score, attempt.total_marks);
                  return (
                    <article className="dashboard-result-item" key={attempt.id}>
                      <div className="dashboard-list-main">
                        <strong>{attempt.mock_test?.title || 'Mock Test'}</strong>
                        <span>Submitted {formatDate(attempt.submitted_at)}</span>
                      </div>
                      <div className="dashboard-result-score">
                        <strong>{attempt.score ?? '—'} / {attempt.total_marks ?? '—'}</strong>
                        <span>{percent === null ? '—' : String(percent) + '%'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-kicker">LEARNING RESOURCES</span><h2>Recently Added Study Materials</h2></div>
              <Link href="/study-materials">Browse materials →</Link>
            </div>
            {materials.length === 0 ? (
              <div className="dashboard-empty">
                <strong>No published materials available</strong>
                <p>New study resources will be listed here after publication.</p>
              </div>
            ) : (
              <div className="dashboard-list">
                {materials.map(material => (
                  <article className="dashboard-list-item" key={material.id}>
                    <div className="dashboard-list-main">
                      <strong>{material.title}</strong>
                      <span>{[material.exam_category, material.subject, material.class_level ? 'Class ' + material.class_level : null].filter(Boolean).join(' · ')}</span>
                    </div>
                    <span className={material.access_type === 'paid' ? 'dashboard-tag dashboard-tag-paid' : 'dashboard-tag'}>{material.access_type === 'paid' ? 'Premium' : 'Free'}</span>
                  </article>
                ))}
              </div>
            )}
            <div className="dashboard-panel-footnote">{materialCount} published study material(s) on EduAxis India</div>
          </section>

          <section className="dashboard-panel dashboard-updates-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-kicker">STAY INFORMED</span><h2>Latest Career Updates</h2></div>
              <Link href="/career-updates">All updates →</Link>
            </div>
            {updates.length === 0 ? (
              <div className="dashboard-empty">
                <strong>No new career updates</strong>
                <p>Visit the updates page to check the latest information.</p>
              </div>
            ) : (
              <div className="dashboard-list">
                {updates.map(update => (
                  <article className="dashboard-update-item" key={update.id}>
                    <span className="dashboard-update-category">{update.category.replace(/_/g, ' ')}</span>
                    <div className="dashboard-list-main">
                      <strong>{update.title}</strong>
                      <span>{update.organization || update.exam_name || 'EduAxis India update'} · {formatDate(update.notice_date || update.created_at)}</span>
                    </div>
                    {update.last_date && <small>Last date: {formatDate(update.last_date)}</small>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel dashboard-profile-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-kicker">ACCOUNT</span><h2>Keep Your Profile Updated</h2></div>
            </div>
            <p>Make sure your contact details and location are current so your student account stays up to date.</p>
            <Link href="/student/profile" className="dashboard-secondary-link">View or edit profile →</Link>
            <div className="dashboard-profile-email">{profile?.email}</div>
          </section>
        </div>

        <footer className="dashboard-footer">© {new Date().getFullYear()} EduAxis India · Learn. Prepare. Progress.</footer>
      </div>
    </main>
  );
}
