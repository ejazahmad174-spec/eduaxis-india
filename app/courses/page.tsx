
'use client';

import { useEffect, useState } from 'react';
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
};

type BoardMapping = {
  course_id: string;
  board: string;
  academic_session: string;
  is_active: boolean;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [mappings, setMappings] = useState<BoardMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedBoard, setSelectedBoard] = useState('all');

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('courses')
      .select(
        'id, title, description, category, price, is_free, thumbnail_url, course_type, class_level, subject'
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Course loading error:', error);
      setCourses([]);
      setMappings([]);
      setLoading(false);
      return;
    }

    const courseList = (data || []) as Course[];
    setCourses(courseList);

    if (courseList.length > 0) {
      const courseIds = courseList.map((course) => course.id);

      const { data: boardData, error: boardError } = await supabase
        .from('course_board_mappings')
        .select('course_id, board, academic_session, is_active')
        .in('course_id', courseIds)
        .eq('is_active', true);

      if (!boardError) {
        setMappings((boardData || []) as BoardMapping[]);
      }
    }

    setLoading(false);
  }

  const filteredCourses = courses.filter((course) => {
    const query = search.toLowerCase();

    const matchesSearch =
      course.title.toLowerCase().includes(query) ||
      (course.subject || '').toLowerCase().includes(query) ||
      (course.description || '').toLowerCase().includes(query);

    const matchesClass =
      selectedClass === 'all' ||
      String(course.class_level) === selectedClass;

    const matchesSubject =
      selectedSubject === 'all' ||
      course.subject === selectedSubject;

    const courseBoards = mappings.filter(
      (mapping) => mapping.course_id === course.id
    );

    const matchesBoard =
      selectedBoard === 'all' ||
      courseBoards.some((mapping) => mapping.board === selectedBoard);

    return (
      matchesSearch &&
      matchesClass &&
      matchesSubject &&
      matchesBoard
    );
  });

  const subjects = Array.from(
    new Set(courses.map((course) => course.subject).filter(Boolean))
  ) as string[];

  function getBoards(courseId: string) {
    return mappings.filter((mapping) => mapping.course_id === courseId);
  }

  return (
    <main className="coursePage">
      <style jsx global>{`
        .coursePage {
          min-height: 100vh;
          background: #f5f8fa;
          color: #172b3d;
          font-family: Arial, sans-serif;
        }

        .courseHeader {
          background: #102b46;
          color: white;
          padding: 20px 5%;
        }

        .courseHeaderInner {
          max-width: 1180px;
          margin: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .courseBrand {
          color: white;
          text-decoration: none;
          font-size: 22px;
          font-weight: 800;
        }

        .courseNav {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .courseNav a {
          color: white;
          text-decoration: none;
          font-size: 14px;
        }

        .courseHero {
          background: linear-gradient(120deg, #102b46, #176a79);
          color: white;
          padding: 55px 20px;
          text-align: center;
        }

        .courseHero h1 {
          font-size: clamp(28px, 4vw, 42px);
          margin: 0 0 12px;
        }

        .courseHero p {
          font-size: 16px;
          line-height: 1.7;
          max-width: 650px;
          margin: auto;
          color: #e2eff3;
        }

        .courseContainer {
          max-width: 1180px;
          width: calc(100% - 40px);
          margin: 35px auto 60px;
        }

        .courseFilters {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 28px;
        }

        .courseFilters input,
        .courseFilters select {
          width: 100%;
          padding: 13px;
          border: 1px solid #dce5e9;
          border-radius: 8px;
          background: white;
          color: #172b3d;
          font-size: 14px;
          min-width: 0;
        }

        .courseGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }

        .courseCard {
          background: white;
          border: 1px solid #e2eaed;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 15px rgba(16, 43, 70, 0.05);
        }

        .courseImage {
          height: 175px;
          background: #e8f0f3;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .courseImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .coursePlaceholder {
          font-size: 42px;
          color: #18a5a0;
          font-weight: 800;
        }

        .courseCardBody {
          padding: 20px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .courseTag {
          display: inline-block;
          width: fit-content;
          background: #e7f5f4;
          color: #087b77;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .courseCard h2 {
          font-size: 19px;
          margin: 0 0 10px;
          line-height: 1.4;
        }

        .courseDescription {
          font-size: 13px;
          line-height: 1.7;
          color: #657789;
          margin-bottom: 15px;
          flex: 1;
        }

        .courseMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 15px;
        }

        .courseMeta span {
          background: #f0f4f6;
          padding: 6px 9px;
          border-radius: 5px;
          font-size: 11px;
          color: #43596b;
        }

        .courseBoards {
          color: #657789;
          font-size: 12px;
          margin-bottom: 15px;
          line-height: 1.6;
        }

        .courseBottom {
          border-top: 1px solid #edf1f3;
          padding-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .coursePrice {
          font-size: 19px;
          font-weight: 800;
          color: #102b46;
        }

        .courseButton {
          background: #18a5a0;
          color: white;
          text-decoration: none;
          padding: 10px 15px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
        }

        .courseButton:hover {
          background: #128b87;
        }

        .courseEmpty {
          background: white;
          border: 1px solid #e2eaed;
          padding: 45px 20px;
          text-align: center;
          border-radius: 12px;
          color: #657789;
          grid-column: 1 / -1;
        }

        .courseFooter {
          text-align: center;
          padding: 25px;
          color: #657789;
          font-size: 13px;
          border-top: 1px solid #e2eaed;
        }

        @media (max-width: 850px) {
          .courseGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .courseFilters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .courseGrid {
            grid-template-columns: 1fr;
          }

          .courseFilters {
            grid-template-columns: 1fr;
          }

          .courseHero {
            padding: 40px 18px;
          }

          .courseContainer {
            width: calc(100% - 28px);
          }
        }
      `}</style>

      <header className="courseHeader">
        <div className="courseHeaderInner">
          <Link href="/" className="courseBrand">
            EduAxis India
          </Link>

          <nav className="courseNav">
            <Link href="/">Home</Link>
            <Link href="/blogs">Blogs</Link>
            <Link href="/government-jobs">Government Jobs</Link>
            <Link href="/student/login">Student Login</Link>
          </nav>
        </div>
      </header>

      <section className="courseHero">
        <h1>Explore Our Courses</h1>
        <p>
          Learn at your own pace with structured courses, expert learning
          resources and practice materials from EduAxis India.
        </p>
      </section>

      <section className="courseContainer">
        <div className="courseFilters">
          <input
            type="search"
            placeholder="Search courses or subjects..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
          >
            <option value="all">All Classes</option>
            <option value="6">Class 6</option>
            <option value="7">Class 7</option>
            <option value="8">Class 8</option>
            <option value="9">Class 9</option>
            <option value="10">Class 10</option>
            <option value="11">Class 11</option>
            <option value="12">Class 12</option>
          </select>

          <select
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
          >
            <option value="all">All Subjects</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>

          <select
            value={selectedBoard}
            onChange={(event) => setSelectedBoard(event.target.value)}
          >
            <option value="all">All Boards</option>
            <option value="BSEB">BSEB</option>
            <option value="CBSE">CBSE</option>
          </select>
        </div>

        {loading ? (
          <div className="courseEmpty">Loading courses...</div>
        ) : (
          <div className="courseGrid">
            {filteredCourses.length === 0 ? (
              <div className="courseEmpty">
                <h2>No courses available yet</h2>
                <p>
                  New courses are being prepared. Please check again soon.
                </p>
              </div>
            ) : (
              filteredCourses.map((course) => {
                const boards = getBoards(course.id);

                return (
                  <article className="courseCard" key={course.id}>
                    <div className="courseImage">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                        />
                      ) : (
                        <div className="coursePlaceholder">
                          EduAxis
                        </div>
                      )}
                    </div>

                    <div className="courseCardBody">
                      <span className="courseTag">
                        {course.course_type === 'academic'
                          ? 'ACADEMIC COURSE'
                          : course.course_type === 'competitive'
                            ? 'COMPETITIVE EXAM'
                            : 'SKILL DEVELOPMENT'}
                      </span>

                      <h2>{course.title}</h2>

                      <p className="courseDescription">
                        {course.description ||
                          'Explore the course syllabus, lessons and learning resources.'}
                      </p>

                      <div className="courseMeta">
                        {course.class_level && (
                          <span>Class {course.class_level}</span>
                        )}
                        {course.subject && (
                          <span>{course.subject}</span>
                        )}
                        {course.category && (
                          <span>{course.category}</span>
                        )}
                      </div>

                      {boards.length > 0 && (
                        <div className="courseBoards">
                          <strong>Available for:</strong>{' '}
                          {boards
                            .map(
                              (board) =>
                                `${board.board} (${board.academic_session})`
                            )
                            .join(' · ')}
                        </div>
                      )}

                      <div className="courseBottom">
                        <div className="coursePrice">
                          {course.is_free || Number(course.price || 0) === 0
                            ? 'FREE'
                            : `₹${Number(course.price).toLocaleString('en-IN')}`}
                        </div>

                        <Link
                          href={`/courses/${course.id}`}
                          className="courseButton"
                        >
                          View Course →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>

      <footer className="courseFooter">
        © {new Date().getFullYear()} EduAxis India. Learn. Prepare. Progress.
      </footer>
    </main>
  );
}
