
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  is_free: boolean | null;
  thumbnail_url: string | null;
  course_type: string;
  class_level: number | null;
  subject: string | null;
  status: string;
};

type Mapping = {
  id: string;
  board: string;
  academic_session: string;
  is_active: boolean;
};

type Unit = {
  id: string;
  board_mapping_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type Chapter = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type Lesson = {
  id: string;
  chapter_id: string;
  title: string;
  description: string | null;
  lesson_type: 'video' | 'text' | 'live';
  video_url: string | null;
  content: string | null;
  duration_minutes: number | null;
  is_free_preview: boolean;
  status: string;
  sort_order: number;
};

type LessonProgress = {
  lesson_id: string;
  status: 'in_progress' | 'completed';
};

type Resource = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  access_level: 'free' | 'paid';
  file_path: string | null;
  external_url: string | null;
  status: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (response: any) => void) => void;
};

type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions
) => RazorpayInstance;

// Local type only. No global Window declaration.
function getRazorpayConstructor(): RazorpayConstructor | undefined {
  return (
    window as unknown as {
      Razorpay?: RazorpayConstructor;
    }
  ).Razorpay;
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, 'in_progress' | 'completed'>>({});
  const [progressSavingId, setProgressSavingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [expandedLessons, setExpandedLessons] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function loadCourse() {
    if (!supabase || !courseId) {
      setError('Unable to connect to the course service.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const studentId = authData.user?.id || null;
      let hasActiveEnrollment = false;
      setUserId(studentId);

      if (studentId) {
        const { data: enrollmentData, error: enrollmentError } =
          await supabase
            .from('course_enrollments')
            .select('id, status')
            .eq('user_id', authData.user.id)
            .eq('course_id', courseId)
            .eq('status', 'active')
            .maybeSingle();

        if (enrollmentError) throw enrollmentError;
        hasActiveEnrollment = Boolean(enrollmentData);
        setIsEnrolled(hasActiveEnrollment);
      } else {
        setIsEnrolled(false);
      }
      setLessonProgress({});

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(
          'id, title, description, category, price, is_free, thumbnail_url, course_type, class_level, subject, status'
        )
        .eq('id', courseId)
        .eq('status', 'published')
        .maybeSingle();

      if (courseError || !courseData) {
        setError('This course is not available.');
        setLoading(false);
        return;
      }

      setCourse(courseData as Course);

      const { data: mappingData, error: mappingError } = await supabase
        .from('course_board_mappings')
        .select('id, board, academic_session, is_active')
        .eq('course_id', courseId)
        .eq('is_active', true);

      if (mappingError) throw mappingError;

      const mappingList = (mappingData || []) as Mapping[];
      setMappings(mappingList);

      if (mappingList.length === 0) {
        setUnits([]);
        setChapters([]);
        setLessons([]);
        setResources([]);
        setLoading(false);
        return;
      }

      const { data: unitData, error: unitError } = await supabase
        .from('course_units')
        .select('id, board_mapping_id, title, description, sort_order')
        .in('board_mapping_id', mappingList.map((item) => item.id))
        .order('sort_order', { ascending: true });

      if (unitError) throw unitError;

      const unitList = (unitData || []) as Unit[];
      setUnits(unitList);

      if (unitList.length === 0) {
        setChapters([]);
        setLessons([]);
        setResources([]);
        setLoading(false);
        return;
      }

      const { data: chapterData, error: chapterError } = await supabase
        .from('course_chapters')
        .select('id, unit_id, title, description, sort_order')
        .in('unit_id', unitList.map((item) => item.id))
        .order('sort_order', { ascending: true });

      if (chapterError) throw chapterError;

      const chapterList = (chapterData || []) as Chapter[];
      setChapters(chapterList);

      if (chapterList.length === 0) {
        setLessons([]);
        setResources([]);
        setLoading(false);
        return;
      }

      const { data: lessonData, error: lessonError } = await supabase
        .from('course_lessons')
        .select(
          'id, chapter_id, title, description, lesson_type, video_url, content, duration_minutes, is_free_preview, status, sort_order'
        )
        .in('chapter_id', chapterList.map((item) => item.id))
        .eq('status', 'published')
        .order('sort_order', { ascending: true });

      if (lessonError) throw lessonError;

      const lessonList = (lessonData || []) as Lesson[];
      setLessons(lessonList);

      if (lessonList.length === 0) {
        setResources([]);
        setLessonProgress({});
        setLoading(false);
        return;
      }

      if (studentId && hasActiveEnrollment) {
        const { data: progressRows, error: progressError } = await supabase
          .from('course_lesson_progress')
          .select('lesson_id, status')
          .eq('student_id', studentId)
          .in('lesson_id', lessonList.map((lesson) => lesson.id));

        if (progressError) throw progressError;

        const progressMap: Record<string, 'in_progress' | 'completed'> = {};
        (progressRows || []).forEach((row: LessonProgress) => {
          progressMap[row.lesson_id] = row.status;
        });
        setLessonProgress(progressMap);
      } else {
        setLessonProgress({});
      }

      const { data: resourceData, error: resourceError } = await supabase
        .from('course_resources')
        .select(
          'id, lesson_id, title, description, resource_type, access_level, file_path, external_url, status'
        )
        .in('lesson_id', lessonList.map((item) => item.id))
        .eq('status', 'published');

      if (resourceError) throw resourceError;

      setResources((resourceData || []) as Resource[]);
      setLoading(false);
    } catch (err) {
      console.error('Course detail loading error:', err);
      setError('Unable to load course content. Please try again.');
      setLoading(false);
    }
  }

  async function loadRazorpayScript() {
    if (getRazorpayConstructor()) return;

    const scriptUrl = 'https://checkout.razorpay.com/v1/checkout.js';

    const existingScript =
      document.querySelector<HTMLScriptElement>(
        `script[src="${scriptUrl}"]`
      );

    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        if (getRazorpayConstructor()) {
          resolve();
          return;
        }

        existingScript.addEventListener('load', () => resolve(), {
          once: true,
        });

        existingScript.addEventListener(
          'error',
          () => reject(new Error('Unable to load Razorpay Checkout.')),
          { once: true }
        );
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Unable to load Razorpay Checkout.'));
        document.body.appendChild(script);
      });
    }

    if (!getRazorpayConstructor()) {
      throw new Error('Razorpay Checkout could not be initialized.');
    }
  }

  async function purchaseCourse() {
    if (!supabase || !course) return;

    if (!userId) {
      window.location.href =
        `/student/login?next=${encodeURIComponent(`/courses/${courseId}`)}`;
      return;
    }

    if (isEnrolled) {
      setMessage('You are already enrolled in this course.');
      return;
    }

    setPaymentProcessing(true);
    setMessage('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        window.location.href =
          `/student/login?next=${encodeURIComponent(`/courses/${courseId}`)}`;
        return;
      }

      await loadRazorpayScript();

      const RazorpayCheckout = getRazorpayConstructor();

      if (!RazorpayCheckout) {
        throw new Error('Razorpay Checkout could not be initialized.');
      }

      // Create payment order on the server.
      const orderResponse = await fetch('/api/courses/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ courseId }),
        cache: 'no-store',
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        if (orderResponse.status === 401) {
          window.location.href =
            `/student/login?next=${encodeURIComponent(`/courses/${courseId}`)}`;
          return;
        }

        throw new Error(
          orderData.error || 'Could not start course payment.'
        );
      }

      if (
        !orderData.orderId ||
        !orderData.keyId ||
        !orderData.amount ||
        !orderData.currency
      ) {
        throw new Error('Invalid payment order response.');
      }

      const checkout = new RazorpayCheckout({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'EduAxis India',
        description: orderData.courseTitle || course.title,
        order_id: orderData.orderId,
        theme: { color: '#102b46' },

        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch('/api/courses/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(paymentResponse),
              cache: 'no-store',
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.error ||
                  'Payment was received but enrolment could not be confirmed. Please contact support.'
              );
            }

            setIsEnrolled(true);
            setMessage(
              'Payment successful! You are now enrolled in this course.'
            );

            await loadCourse();
          } catch (verificationError) {
            setMessage(
              verificationError instanceof Error
                ? verificationError.message
                : 'Payment verification could not be completed. Please contact support.'
            );
          } finally {
            setPaymentProcessing(false);
          }
        },

        modal: {
          ondismiss: () => setPaymentProcessing(false),
        },
      });

      checkout.on('payment.failed', (failure) => {
        setMessage(
          failure?.error?.description ||
            'Payment failed. Please try again.'
        );
        setPaymentProcessing(false);
      });

      checkout.open();
    } catch (purchaseError) {
      setMessage(
        purchaseError instanceof Error
          ? purchaseError.message
          : 'Unable to start course payment. Please try again.'
      );

      setPaymentProcessing(false);
    }
  }

  function toggleChapter(id: string) {
    setExpandedChapters((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  async function toggleLesson(id: string) {
    const willOpen = !expandedLessons.includes(id);

    setExpandedLessons((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );

    if (!willOpen || !supabase || !userId || !isEnrolled || lessonProgress[id]) return;

    setProgressSavingId(id);
    const { data, error } = await supabase
      .from('course_lesson_progress')
      .insert({ student_id: userId, lesson_id: id, status: 'in_progress' })
      .select('status')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('course_lesson_progress')
          .select('status')
          .eq('student_id', userId)
          .eq('lesson_id', id)
          .maybeSingle();
        if (existing) {
          setLessonProgress(current => ({ ...current, [id]: existing.status }));
        }
      } else {
        setMessage('Your lesson progress could not be saved. Please try again.');
      }
    } else if (data) {
      setLessonProgress(current => ({ ...current, [id]: data.status }));
    }

    setProgressSavingId(null);
  }

  async function completeLesson(id: string) {
    if (!supabase || !userId || !isEnrolled || lessonProgress[id] === 'completed') return;

    setProgressSavingId(id);
    const completedAt = new Date().toISOString();
    let saveError: { message: string } | null = null;

    if (lessonProgress[id] === 'in_progress') {
      const { error } = await supabase
        .from('course_lesson_progress')
        .update({ status: 'completed', completed_at: completedAt, updated_at: completedAt })
        .eq('student_id', userId)
        .eq('lesson_id', id);
      saveError = error;
    } else {
      const { error } = await supabase
        .from('course_lesson_progress')
        .insert({
          student_id: userId,
          lesson_id: id,
          status: 'completed',
          completed_at: completedAt,
        });
      saveError = error;
    }

    if (saveError) {
      setMessage('Lesson completion could not be saved. Please try again.');
    } else {
      setLessonProgress(current => ({ ...current, [id]: 'completed' }));
    }

    setProgressSavingId(null);
  }

  async function downloadResource(resource: Resource) {
    if (!supabase) return;

    setDownloadingId(resource.id);
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const headers: HeadersInit = {};

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `/api/courses/resources/${resource.id}/download`,
        {
          method: 'GET',
          headers,
          cache: 'no-store',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href =
            `/student/login?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }

        throw new Error(
          result.error || 'Unable to access this resource.'
        );
      }

      if (!result.url) {
        throw new Error('Download link was not provided.');
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Unable to download this resource.'
      );
    } finally {
      setDownloadingId(null);
    }
  }

  function getChapterLessons(chapterId: string) {
    return lessons.filter((lesson) => lesson.chapter_id === chapterId);
  }

  function getLessonResources(lessonId: string) {
    return resources.filter((resource) => resource.lesson_id === lessonId);
  }

  function getUnitChapters(unitId: string) {
    return chapters.filter((chapter) => chapter.unit_id === unitId);
  }

  function formatPrice() {
    if (!course) return '';

    if (Number(course.price || 0) <= 0) {
      return 'FREE';
    }

    return `₹${Number(course.price).toLocaleString('en-IN')}`;
  }

  const completedLessonCount = lessons.filter(
    (lesson) => lessonProgress[lesson.id] === 'completed'
  ).length;
  const courseProgressPercent = lessons.length
    ? Math.round((completedLessonCount / lessons.length) * 100)
    : 0;

  return (
    <main className="studentCoursePage">
      <style jsx global>{`
        .studentCoursePage {
          min-height: 100vh;
          background: #f5f8fa;
          color: #172b3d;
          font-family: Arial, sans-serif;
        }

        .studentCourseHeader {
          background: #102b46;
          color: white;
          padding: 18px 5%;
        }

        .studentCourseHeaderInner {
          max-width: 1180px;
          margin: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
        }

        .studentCourseBrand {
          color: white;
          font-size: 21px;
          font-weight: 800;
          text-decoration: none;
        }

        .studentCourseNav {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
        }

        .studentCourseNav a {
          color: white;
          text-decoration: none;
          font-size: 13px;
        }

        .studentCourseHero {
          background: linear-gradient(120deg, #102b46, #176a79);
          color: white;
          padding: 42px 20px;
        }

        .studentCourseHeroInner {
          max-width: 1180px;
          margin: auto;
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          align-items: center;
          gap: 30px;
        }

        .studentCourseHero h1 {
          font-size: clamp(26px, 4vw, 38px);
          line-height: 1.3;
          margin: 12px 0;
        }

        .studentCourseHero p {
          color: #e2eff3;
          line-height: 1.7;
        }

        .studentCourseHeroImage {
          width: 100%;
          height: 220px;
          object-fit: cover;
          border-radius: 12px;
        }

        .studentCoursePriceBox {
          background: white;
          color: #102b46;
          padding: 20px;
          border-radius: 10px;
          display: inline-block;
          margin-top: 10px;
        }

        .studentCoursePriceBox strong {
          font-size: 25px;
        }

        .studentBuyButton {
          display: inline-block;
          margin-top: 14px;
          border: 0;
          border-radius: 7px;
          background: #18a5a0;
          color: #ffffff;
          padding: 13px 22px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .studentBuyButton:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .studentEnrolledTag {
          display: inline-block;
          margin-top: 14px;
          padding: 11px 16px;
          border-radius: 7px;
          background: #e3f6ee;
          color: #16734b;
          font-size: 13px;
          font-weight: 700;
        }

        .studentProgressCard {
          margin-top: 16px;
          max-width: 430px;
          padding: 13px 15px;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 9px;
          background: rgba(255,255,255,.1);
        }
        .studentProgressCard strong { display: block; margin-top: 4px; font-size: 12px; color: #fff; }
        .studentProgressTrack { height: 7px; margin-top: 10px; border-radius: 20px; background: rgba(255,255,255,.24); overflow: hidden; }
        .studentProgressTrack span { display: block; height: 100%; border-radius: inherit; background: #69dfca; }
        .studentLessonStatus { background: #e3f6ee; color: #16734b; }
        .studentCompleteLessonButton {
          border: 0;
          border-radius: 6px;
          padding: 9px 13px;
          background: #102b46;
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .studentCompleteLessonButton:disabled { opacity: .6; cursor: wait; }
        .studentLessonDone { color: #16734b; font-size: 12px; font-weight: 800; }

        .studentCourseContainer {
          max-width: 1180px;
          width: calc(100% - 40px);
          margin: 35px auto 60px;
        }

        .studentCourseInfo {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-bottom: 28px;
        }

        .studentCourseInfo span {
          background: #e8f1f4;
          color: #38556a;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
        }

        .studentCourseSectionTitle {
          font-size: 25px;
          color: #102b46;
          margin: 30px 0 18px;
        }

        .studentMappingCard {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 22px;
        }

        .studentMappingTitle {
          color: #087b77;
          font-size: 17px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .studentUnit {
          border: 1px solid #e2eaed;
          border-radius: 9px;
          overflow: hidden;
          margin-bottom: 13px;
        }

        .studentUnitHeader {
          background: #edf4f6;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .studentUnitHeader h3 {
          margin: 0;
          font-size: 16px;
          color: #102b46;
        }

        .studentUnitBody {
          padding: 13px;
        }

        .studentChapter {
          border: 1px solid #e7edef;
          border-radius: 8px;
          margin-bottom: 10px;
          overflow: hidden;
        }

        .studentChapterButton {
          width: 100%;
          border: 0;
          background: white;
          color: #172b3d;
          padding: 14px;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
        }

        .studentChapterContent {
          padding: 12px;
          background: #fbfcfd;
          border-top: 1px solid #e7edef;
        }

        .studentLesson {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 8px;
          margin-bottom: 10px;
          overflow: hidden;
        }

        .studentLessonHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 13px;
        }

        .studentLessonTitle {
          font-size: 14px;
          font-weight: 700;
          color: #102b46;
        }

        .studentLessonMeta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 6px;
        }

        .studentSmallTag {
          font-size: 10px;
          padding: 4px 7px;
          border-radius: 4px;
          background: #edf2f5;
          color: #526779;
        }

        .studentFreeTag {
          background: #e3f6ee;
          color: #16734b;
        }

        .studentPaidTag {
          background: #fff1dd;
          color: #a45b00;
        }

        .studentLessonButton {
          border: 0;
          background: #18a5a0;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .studentLessonContent {
          padding: 16px;
          background: #fbfcfd;
          border-top: 1px solid #e2eaed;
          line-height: 1.8;
          font-size: 14px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .studentLessonContent a {
          color: #087b77;
        }

        .studentResource {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 7px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 9px;
        }

        .studentResourceTitle {
          font-size: 13px;
          font-weight: 700;
        }

        .studentDownloadButton {
          border: 0;
          background: #102b46;
          color: white;
          padding: 8px 11px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
        }

        .studentDownloadButton:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .studentMessage {
          padding: 13px;
          background: #fff4e4;
          border: 1px solid #f0d6ae;
          color: #87500c;
          border-radius: 8px;
          margin: 15px 0;
          font-size: 13px;
        }

        .studentEmpty {
          background: white;
          padding: 30px;
          text-align: center;
          border-radius: 9px;
          color: #657789;
          border: 1px solid #e2eaed;
        }

        .studentCourseFooter {
          text-align: center;
          padding: 25px;
          border-top: 1px solid #e2eaed;
          color: #657789;
          font-size: 13px;
        }

        @media (max-width: 750px) {
          .studentCourseHeroInner {
            grid-template-columns: 1fr;
          }

          .studentCourseHeroImage {
            height: 190px;
          }
        }

        @media (max-width: 520px) {
          .studentCourseContainer {
            width: calc(100% - 26px);
          }

          .studentLessonHeader,
          .studentResource {
            align-items: flex-start;
            flex-direction: column;
          }

          .studentCourseHero {
            padding: 32px 18px;
          }
        }
      `}</style>

      <header className="studentCourseHeader">
        <div className="studentCourseHeaderInner">
          <Link href="/" className="studentCourseBrand">
            EduAxis India
          </Link>

          <nav className="studentCourseNav">
            <Link href="/">Home</Link>
            <Link href="/courses">All Courses</Link>
            <Link href="/blogs">Blogs</Link>
            <Link href="/student/dashboard">My Dashboard</Link>
          </nav>
        </div>
      </header>

      {loading ? (
        <div className="studentCourseContainer">
          <div className="studentEmpty">Loading course details...</div>
        </div>
      ) : error || !course ? (
        <div className="studentCourseContainer">
          <div className="studentEmpty">
            <h2>Course unavailable</h2>
            <p>{error || 'This course could not be found.'}</p>
            <Link href="/courses">Browse all courses</Link>
          </div>
        </div>
      ) : (
        <>
          <section className="studentCourseHero">
            <div className="studentCourseHeroInner">
              <div>
                <span className="studentSmallTag">
                  {(course.course_type || 'academic').toUpperCase()}
                </span>

                <h1>{course.title}</h1>

                <p>
                  {course.description ||
                    'Explore the syllabus, lessons and learning resources in this course.'}
                </p>

                <div className="studentCoursePriceBox">
                  <div style={{ fontSize: 12, color: '#657789' }}>
                    Course Fee
                  </div>
                  <strong>{formatPrice()}</strong>
                </div>

                {Number(course.price || 0) > 0 ? (
                  isEnrolled ? (
                    <div className="studentEnrolledTag">
                      ✓ Already Enrolled
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="studentBuyButton"
                      onClick={purchaseCourse}
                      disabled={paymentProcessing}
                    >
                      {paymentProcessing
                        ? 'Preparing Payment...'
                        : `Buy Now · ₹${Number(course.price).toLocaleString('en-IN')}`}
                    </button>
                  )
                ) : (
                  <div className="studentEnrolledTag">Free Course</div>
                )}

                {isEnrolled && lessons.length > 0 && (
                  <div className="studentProgressCard">
                    <span>YOUR COURSE PROGRESS</span>
                    <strong>
                      {completedLessonCount} of {lessons.length} lessons completed · {courseProgressPercent}%
                    </strong>
                    <div className="studentProgressTrack">
                      <span style={{ width: courseProgressPercent + '%' }} />
                    </div>
                  </div>
                )}
              </div>

              {course.thumbnail_url && (
                <img
                  className="studentCourseHeroImage"
                  src={course.thumbnail_url}
                  alt={course.title}
                />
              )}
            </div>
          </section>

          <section className="studentCourseContainer">
            <div className="studentCourseInfo">
              {course.class_level && (
                <span>Class {course.class_level}</span>
              )}
              {course.subject && <span>{course.subject}</span>}
              {course.category && <span>{course.category}</span>}

              {mappings.map((mapping) => (
                <span key={mapping.id}>
                  {mapping.board} · {mapping.academic_session}
                </span>
              ))}
            </div>

            <h2 className="studentCourseSectionTitle">
              Course Curriculum
            </h2>

            {message && (
              <div className="studentMessage">{message}</div>
            )}

            {units.length === 0 ? (
              <div className="studentEmpty">
                <h3>Course content is being prepared</h3>
                <p>Lessons and learning materials will appear here soon.</p>
              </div>
            ) : (
              mappings.map((mapping) => {
                const mappingUnits = units.filter(
                  (unit) => unit.board_mapping_id === mapping.id
                );

                if (mappingUnits.length === 0) return null;

                return (
                  <div className="studentMappingCard" key={mapping.id}>
                    <div className="studentMappingTitle">
                      {mapping.board} · {mapping.academic_session} Syllabus
                    </div>

                    {mappingUnits.map((unit, unitIndex) => {
                      const unitChapters = getUnitChapters(unit.id);

                      return (
                        <div className="studentUnit" key={unit.id}>
                          <div className="studentUnitHeader">
                            <h3>
                              Unit {unitIndex + 1}: {unit.title}
                            </h3>
                            <span className="studentSmallTag">
                              {unitChapters.length} Chapters
                            </span>
                          </div>

                          <div className="studentUnitBody">
                            {unitChapters.length === 0 ? (
                              <p>No chapters added yet.</p>
                            ) : (
                              unitChapters.map((chapter, chapterIndex) => {
                                const chapterLessons =
                                  getChapterLessons(chapter.id);

                                const isChapterOpen =
                                  expandedChapters.includes(chapter.id);

                                return (
                                  <div
                                    className="studentChapter"
                                    key={chapter.id}
                                  >
                                    <button
                                      className="studentChapterButton"
                                      onClick={() =>
                                        toggleChapter(chapter.id)
                                      }
                                    >
                                      <span>
                                        Chapter {chapterIndex + 1}: {chapter.title}
                                      </span>
                                      <span>
                                        {isChapterOpen ? '−' : '+'}
                                      </span>
                                    </button>

                                    {isChapterOpen && (
                                      <div className="studentChapterContent">
                                        {chapter.description && (
                                          <p>{chapter.description}</p>
                                        )}

                                        {chapterLessons.length === 0 ? (
                                          <p>Lessons are being prepared.</p>
                                        ) : (
                                          chapterLessons.map((lesson) => {
                                            const lessonResources =
                                              getLessonResources(lesson.id);

                                            const isLessonOpen =
                                              expandedLessons.includes(
                                                lesson.id
                                              );

                                            return (
                                              <div
                                                className="studentLesson"
                                                key={lesson.id}
                                              >
                                                <div className="studentLessonHeader">
                                                  <div>
                                                    <div className="studentLessonTitle">
                                                      {lesson.title}
                                                    </div>

                                                    <div className="studentLessonMeta">
                                                      <span className="studentSmallTag">
                                                        {lesson.lesson_type.toUpperCase()}
                                                      </span>

                                                      {lesson.duration_minutes && (
                                                        <span className="studentSmallTag">
                                                          {lesson.duration_minutes} min
                                                        </span>
                                                      )}

                                                      {lesson.is_free_preview ? (
                                                        <span className="studentSmallTag studentFreeTag">
                                                          FREE PREVIEW
                                                        </span>
                                                      ) : (
                                                        <span className="studentSmallTag studentPaidTag">
                                                          ENROLMENT REQUIRED
                                                        </span>
                                                      )}
                                                      {isEnrolled && lessonProgress[lesson.id] && (
                                                        <span className="studentSmallTag studentLessonStatus">
                                                          {lessonProgress[lesson.id] === 'completed' ? '✓ COMPLETED' : 'IN PROGRESS'}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>

                                                  <button
                                                    className="studentLessonButton"
                                                    onClick={() =>
                                                      toggleLesson(lesson.id)
                                                    }
                                                  >
                                                    {isLessonOpen
                                                      ? 'Close Lesson'
                                                      : 'Open Lesson'}
                                                  </button>
                                                </div>

                                                {isLessonOpen && (
                                                  <div className="studentLessonContent">
                                                    {isEnrolled && (
                                                      <div style={{ marginBottom: 14 }}>
                                                        {lessonProgress[lesson.id] === 'completed' ? (
                                                          <span className="studentLessonDone">✓ Lesson completed</span>
                                                        ) : (
                                                          <button
                                                            type="button"
                                                            className="studentCompleteLessonButton"
                                                            disabled={progressSavingId === lesson.id}
                                                            onClick={() => completeLesson(lesson.id)}
                                                          >
                                                            {progressSavingId === lesson.id ? 'Saving...' : 'Mark lesson as completed'}
                                                          </button>
                                                        )}
                                                      </div>
                                                    )}
                                                    {lesson.description && (
                                                      <p>{lesson.description}</p>
                                                    )}

                                                    {lesson.lesson_type === 'video' &&
                                                      lesson.video_url && (
                                                        <p>
                                                          <a
                                                            href={lesson.video_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                          >
                                                            Watch Video
                                                          </a>
                                                        </p>
                                                      )}

                                                    {lesson.lesson_type === 'live' &&
                                                      lesson.video_url && (
                                                        <p>
                                                          <a
                                                            href={lesson.video_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                          >
                                                            Join Live Class
                                                          </a>
                                                        </p>
                                                      )}

                                                    {lesson.content && (
                                                      <div>{lesson.content}</div>
                                                    )}

                                                    {lessonResources.length > 0 && (
                                                      <div>
                                                        <h4>Learning Resources</h4>

                                                        {lessonResources.map(
                                                          (resource) => (
                                                            <div
                                                              className="studentResource"
                                                              key={resource.id}
                                                            >
                                                              <div>
                                                                <div className="studentResourceTitle">
                                                                  {resource.title}
                                                                </div>

                                                                <div className="studentLessonMeta">
                                                                  <span className="studentSmallTag">
                                                                    {resource.resource_type.toUpperCase()}
                                                                  </span>

                                                                  <span
                                                                    className={`studentSmallTag ${
                                                                      resource.access_level === 'free'
                                                                        ? 'studentFreeTag'
                                                                        : 'studentPaidTag'
                                                                    }`}
                                                                  >
                                                                    {resource.access_level.toUpperCase()}
                                                                  </span>
                                                                </div>
                                                              </div>

                                                              <button
                                                                className="studentDownloadButton"
                                                                disabled={
                                                                  downloadingId === resource.id
                                                                }
                                                                onClick={() =>
                                                                  downloadResource(resource)
                                                                }
                                                              >
                                                                {downloadingId === resource.id
                                                                  ? 'Preparing...'
                                                                  : resource.resource_type === 'external_link'
                                                                    ? 'Open Resource'
                                                                    : 'Download'}
                                                              </button>
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            {!userId && (
              <div className="studentEmpty" style={{ marginTop: 25 }}>
                <h3>Want to continue learning?</h3>
                <p>
                  Log in to access your enrolled courses and learning
                  resources.
                </p>
                <Link
                  href={`/student/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}
                >
                  Student Login
                </Link>
              </div>
            )}
          </section>
        </>
      )}

      <footer className="studentCourseFooter">
        © {new Date().getFullYear()} EduAxis India. Learn. Prepare. Progress.
      </footer>
    </main>
  );
}
