
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ExamQuestion = {
  id: string;
  question_text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  marks: number;
  sort_order: number;
};

type ExamData = {
  attempt_id: string;
  test_title: string;
  duration_minutes: number;
  total_marks: number;
  negative_marking: number;
  questions: ExamQuestion[];
};

export default function MockTestExamPage() {
  const params = useParams();
  const testId = String(params.id);

  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const startExam = async () => {
    if (!supabase) return;

    setLoading(true);
    setError("");

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      window.location.href = "/student/login";
      return;
    }

    const { data, error } = await supabase.rpc("start_mock_test", {
      p_mock_test_id: testId
    });

    if (error) {
      setError(error.message);
    } else {
      const examData = data as ExamData;

      setExam(examData);
      setSecondsLeft(examData.duration_minutes * 60);
      setStarted(true);
    }

    setLoading(false);
  };

  const submitExam = useCallback(async (automatic = false) => {
    if (!supabase || !exam || submitting || result) return;

    if (!automatic) {
      const unanswered = exam.questions.filter(q => !answers[q.id]).length;

      const confirmed = window.confirm(
        unanswered > 0
          ? `You have ${unanswered} unanswered questions. Submit the test anyway?`
          : "Are you sure you want to submit your test?"
      );

      if (!confirmed) return;
    }

    setSubmitting(true);
    setError("");

    const answerList = exam.questions.map(q => ({
      question_id: q.id,
      selected_option: answers[q.id] || null
    }));

    const { data, error } = await supabase.rpc("submit_mock_test", {
      p_attempt_id: exam.attempt_id,
      p_answers: answerList
    });

    if (error) {
      setError(error.message);
    } else {
      setResult(data);
    }

    setSubmitting(false);
  }, [exam, answers, submitting, result]);

  useEffect(() => {
    if (!started || result || submitting || secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft(previous => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [started, result, submitting, secondsLeft]);

  useEffect(() => {
    if (started && secondsLeft === 0 && !result && !submitting) {
      submitExam(true);
    }
  }, [started, secondsLeft, result, submitting, submitExam]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  };

  if (result) {
    const review = result.review || [];

    return (
      <main style={{ maxWidth: 950, margin: "auto", padding: 24, color: "#172033" }}>
        <style jsx>{`
          .result-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 24px;
            margin: 20px 0;
          }
          .review-item {
            border: 1px solid #e2e8f0;
            padding: 16px;
            border-radius: 10px;
            margin: 14px 0;
          }
          .correct { color: #15803d; font-weight: 700; }
          .wrong { color: #b91c1c; font-weight: 700; }
        `}</style>

        <div className="result-card">
          <h1>Test Result</h1>
          <h2>{exam?.test_title}</h2>

          {result.status === "time_expired" && (
            <p style={{ color: "#b91c1c" }}>{result.message}</p>
          )}

          <h2 style={{ fontSize: 34, color: "#174ea6" }}>
            {result.score} / {result.total_marks}
          </h2>

          {result.passed !== null && result.passed !== undefined && (
            <p className={result.passed ? "correct" : "wrong"}>
              {result.passed ? "Congratulations! You passed." : "You did not reach the pass mark."}
            </p>
          )}

          <p>Questions attempted: {Object.keys(answers).length} / {exam?.questions.length}</p>
          <p>Correct answers: {review.filter((q: any) => q.is_correct).length}</p>
          <p>Incorrect answers: {review.filter((q: any) => q.selected_option && !q.is_correct).length}</p>
          <p>Unanswered: {review.filter((q: any) => !q.selected_option).length}</p>
        </div>

        {review.length > 0 && (
          <section className="result-card">
            <h2>Answer Review</h2>
            {review.map((q: any, index: number) => (
              <div className="review-item" key={q.question_id}>
                <strong>{index + 1}. {q.question_text}</strong>
                <p className={q.is_correct ? "correct" : "wrong"}>
                  Your answer: {q.selected_option || "Not answered"}
                </p>
                <p className="correct">Correct answer: {q.correct_option}</p>
                <p>{q.explanation || "No explanation provided."}</p>
                <p>Marks awarded: {q.awarded_marks}</p>
              </div>
            ))}
          </section>
        )}

        <a href="/mock-tests">Return to Mock Tests</a>
      </main>
    );
  }

  if (!started) {
    return (
      <main style={{ maxWidth: 850, margin: "auto", padding: 24, color: "#172033" }}>
        <style jsx>{`
          .card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 25px;
            margin-top: 25px;
          }
          button {
            background: #174ea6;
            color: white;
            border: 0;
            border-radius: 8px;
            padding: 13px 22px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
          }
          button:disabled { opacity: .5; }
        `}</style>

        <a href="/mock-tests">← Back to Mock Tests</a>

        <div className="card">
          <h1>Mock Test Instructions</h1>
          <h2>Bihar SLET 2026 – Library Science</h2>

          <ul style={{ lineHeight: 2 }}>
            <li>All questions are multiple-choice questions.</li>
            <li>Each question has four options.</li>
            <li>Select one correct option for each question.</li>
            <li>Total questions: 100 (as configured in this test).</li>
            <li>Duration: 100 minutes.</li>
            <li>Total marks: 100.</li>
            <li>Negative marking: None.</li>
            <li>Your answers will be evaluated automatically.</li>
            <li>You can review your answers after submission.</li>
          </ul>

          <p><strong>Important:</strong> The timer begins when you start the examination.</p>

          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

          <button onClick={startExam} disabled={loading}>
            {loading ? "Starting Test..." : "Start Examination"}
          </button>
        </div>
      </main>
    );
  }

  const question = exam?.questions[current];

  if (!exam || !question) {
    return <main style={{ padding: 30 }}>Loading questions...</main>;
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 20, color: "#172033" }}>
      <style jsx>{`
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          background: #f1f5f9;
          padding: 15px;
          border-radius: 10px;
        }
        .timer {
          font-size: 23px;
          font-weight: 800;
          color: #b91c1c;
        }
        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 18px;
          margin-top: 20px;
        }
        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 22px;
        }
        .option {
          display: block;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 13px;
          margin: 10px 0;
          cursor: pointer;
        }
        .option.selected {
          border: 2px solid #174ea6;
          background: #eff6ff;
        }
        .option input { margin-right: 10px; }
        .actions {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 22px;
          flex-wrap: wrap;
        }
        button {
          padding: 10px 15px;
          border: 0;
          border-radius: 7px;
          background: #174ea6;
          color: white;
          font-weight: 650;
          cursor: pointer;
        }
        button:disabled { opacity: .4; cursor: not-allowed; }
        .numbers {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 7px;
          margin-top: 12px;
        }
        .number {
          padding: 9px 4px;
          border-radius: 6px;
          background: #e2e8f0;
          color: #172033;
        }
        .number.answered { background: #bbf7d0; }
        .number.current { outline: 2px solid #174ea6; }
        .submit { background: #15803d; width: 100%; margin-top: 18px; }
        @media(max-width:750px) {
          .layout { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="topbar">
        <div>
          <strong>{exam.test_title}</strong>
          <div>Answered: {answeredCount} / {exam.questions.length}</div>
        </div>
        <div className="timer">{formatTime(secondsLeft)}</div>
      </div>

      <div className="layout">
        <section className="card">
          <p>Question {current + 1} of {exam.questions.length}</p>

          <h2 style={{ fontSize: 21, lineHeight: 1.6 }}>
            {question.question_text}
          </h2>

          {(["A", "B", "C", "D"] as const).map(option => (
            <label
              key={option}
              className={`option ${answers[question.id] === option ? "selected" : ""}`}
            >
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === option}
                onChange={() => setAnswers(previous => ({
                  ...previous,
                  [question.id]: option
                }))}
              />
              <strong>{option}.</strong> {question.options[option]}
            </label>
          ))}

          <div className="actions">
            <button
              disabled={current === 0}
              onClick={() => setCurrent(current - 1)}
            >
              Previous
            </button>

            <button
              disabled={current === exam.questions.length - 1}
              onClick={() => setCurrent(current + 1)}
            >
              Next
            </button>
          </div>
        </section>

        <aside className="card">
          <h3>Question Navigator</h3>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Green = Answered | Grey = Not answered
          </p>

          <div className="numbers">
            {exam.questions.map((q, index) => (
              <button
                key={q.id}
                className={`number ${answers[q.id] ? "answered" : ""} ${current === index ? "current" : ""}`}
                onClick={() => setCurrent(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <p style={{ marginTop: 15 }}>
            Answered: <strong>{answeredCount}</strong>
          </p>
          <p>
            Remaining: <strong>{exam.questions.length - answeredCount}</strong>
          </p>

          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

          <button
            className="submit"
            disabled={submitting}
            onClick={() => submitExam(false)}
          >
            {submitting ? "Submitting..." : "Submit Examination"}
          </button>
        </aside>
      </div>
    </main>
  );
}
