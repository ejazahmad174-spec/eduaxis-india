
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Language = "en" | "hi";

type ExamQuestion = {
  id: string;
  question_text: string;
  question_text_hi?: string;
  options: { A: string; B: string; C: string; D: string };
  options_hi?: { A: string; B: string; C: string; D: string };
  marks: number;
  sort_order: number;
};

type ExamData = {
  attempt_id: string;
  test_title: string;
  test_title_hi?: string;
  instructions?: string;
  instructions_hi?: string;
  duration_minutes: number;
  total_marks: number;
  negative_marking: number;
  questions: ExamQuestion[];
};

const labels = {
  en: {
    back: "Back to Mock Tests",
    instructions: "Mock Test Instructions",
    title: "Bihar SLET 2026 – Library Science",
    points: [
      "All questions are multiple-choice questions.",
      "Each question has four options.",
      "Select one correct option for each question.",
      "Total questions are as configured in this test.",
      "Your answers will be evaluated automatically.",
      "You can review your answers after submission.",
    ],
    important: "Important:",
    timerStart: "The timer begins when you start the examination.",
    start: "Start Examination",
    starting: "Starting Test...",
    answered: "Answered",
    question: "Question",
    previous: "Previous",
    next: "Next",
    navigator: "Question Navigator",
    legend: "Green = Answered | Grey = Not answered",
    remaining: "Remaining",
    submit: "Submit Examination",
    submitting: "Submitting...",
    result: "Test Result",
    congratulations: "Congratulations! You passed.",
    failed: "You did not reach the pass mark.",
    attempted: "Questions attempted",
    correct: "Correct answers",
    incorrect: "Incorrect answers",
    unanswered: "Unanswered",
    review: "Answer Review",
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    notAnswered: "Not answered",
    noExplanation: "No explanation provided.",
    marksAwarded: "Marks awarded",
    return: "Return to Mock Tests",
    confirm: "Are you sure you want to submit your test?",
    unansweredConfirm: (n: number) =>
      `You have ${n} unanswered questions. Submit the test anyway?`,
    expired: "Time expired. Your test was submitted.",
    language: "Question Language",
    free: "Select the most appropriate answer.",
  },
  hi: {
    back: "मॉक टेस्ट पर वापस जाएँ",
    instructions: "मॉक टेस्ट के निर्देश",
    title: "बिहार SLET 2026 – पुस्तकालय विज्ञान",
    points: [
      "सभी प्रश्न बहुविकल्पीय हैं।",
      "प्रत्येक प्रश्न के चार विकल्प हैं।",
      "प्रत्येक प्रश्न के लिए एक सही विकल्प चुनें।",
      "प्रश्नों की कुल संख्या इस टेस्ट के अनुसार होगी।",
      "आपके उत्तरों का मूल्यांकन स्वतः किया जाएगा।",
      "टेस्ट जमा करने के बाद आप अपने उत्तरों की समीक्षा कर सकते हैं।",
    ],
    important: "महत्वपूर्ण:",
    timerStart: "परीक्षा शुरू करते ही समय की गणना शुरू हो जाएगी।",
    start: "परीक्षा शुरू करें",
    starting: "परीक्षा शुरू हो रही है...",
    answered: "उत्तर दिए गए",
    question: "प्रश्न",
    previous: "पिछला",
    next: "अगला",
    navigator: "प्रश्न सूची",
    legend: "हरा = उत्तर दिया गया | धूसर = उत्तर नहीं दिया गया",
    remaining: "शेष",
    submit: "परीक्षा जमा करें",
    submitting: "जमा हो रहा है...",
    result: "परीक्षा परिणाम",
    congratulations: "बधाई हो! आपने परीक्षा उत्तीर्ण की।",
    failed: "आप उत्तीर्ण होने के निर्धारित अंक प्राप्त नहीं कर सके।",
    attempted: "हल किए गए प्रश्न",
    correct: "सही उत्तर",
    incorrect: "गलत उत्तर",
    unanswered: "अनुत्तरित प्रश्न",
    review: "उत्तर की समीक्षा",
    yourAnswer: "आपका उत्तर",
    correctAnswer: "सही उत्तर",
    notAnswered: "उत्तर नहीं दिया",
    noExplanation: "कोई व्याख्या उपलब्ध नहीं है।",
    marksAwarded: "प्राप्त अंक",
    return: "मॉक टेस्ट पर वापस जाएँ",
    confirm: "क्या आप परीक्षा जमा करना चाहते हैं?",
    unansweredConfirm: (n: number) =>
      `${n} प्रश्नों के उत्तर नहीं दिए गए हैं। क्या आप फिर भी परीक्षा जमा करना चाहते हैं?`,
    expired: "समय समाप्त हो गया। आपकी परीक्षा जमा कर दी गई है।",
    language: "प्रश्नों की भाषा",
    free: "सबसे उपयुक्त उत्तर चुनें।",
  },
};

export default function MockTestExamPage() {
  const params = useParams();
  const testId = String(params.id);

  const [language, setLanguage] = useState<Language>("en");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [authChecking, setAuthChecking] = useState(true);

  const t = labels[language];

  // Protect the individual test URL: require login before showing the test page.
  useEffect(() => {
    let active = true;

    const checkStudentLogin = async () => {
      if (!supabase) {
        if (active) {
          setError("Unable to connect. Please refresh the page and try again.");
          setAuthChecking(false);
        }
        return;
      }

      const { data, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !data.user) {
        const nextPath = window.location.pathname + window.location.search;
        window.location.replace(
          `/student/login?next=${encodeURIComponent(nextPath)}`
        );
        return;
      }

      setAuthChecking(false);
    };

    checkStudentLogin();

    return () => {
      active = false;
    };
  }, []);

  const startExam = async () => {
    if (!supabase) return;

    setLoading(true);
    setError("");

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      const nextPath = window.location.pathname + window.location.search;
      window.location.href = `/student/login?next=${encodeURIComponent(nextPath)}`;
      return;
    }

    const { data, error } = await supabase.rpc("start_mock_test", {
      p_mock_test_id: testId,
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

  const submitExam = useCallback(
    async (automatic = false) => {
      if (!supabase || !exam || submitting || result) return;

      if (!automatic) {
        const unanswered = exam.questions.filter(
          (q) => !answers[q.id]
        ).length;

        const confirmed = window.confirm(
          unanswered > 0
            ? t.unansweredConfirm(unanswered)
            : t.confirm
        );

        if (!confirmed) return;
      }

      setSubmitting(true);
      setError("");

      const answerList = exam.questions.map((q) => ({
        question_id: q.id,
        selected_option: answers[q.id] || null,
      }));

      const { data, error } = await supabase.rpc("submit_mock_test", {
        p_attempt_id: exam.attempt_id,
        p_answers: answerList,
      });

      if (error) {
        setError(error.message);
      } else {
        setResult(data);
      }

      setSubmitting(false);
    },
    [exam, answers, submitting, result, t]
  );

  useEffect(() => {
    if (!started || result || submitting || secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1));
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

  const switchLanguage = () => (
    <div className="language-control">
      <span>{t.language}: </span>
      <button
        type="button"
        className={language === "en" ? "active-language" : "language-button"}
        onClick={() => setLanguage("en")}
      >
        English
      </button>
      <button
        type="button"
        className={language === "hi" ? "active-language" : "language-button"}
        onClick={() => setLanguage("hi")}
      >
        हिन्दी
      </button>
    </div>
  );

  const style = `
    .page { max-width:1100px; margin:auto; padding:20px; color:#172033; }
    .card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:22px; margin:18px 0; }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#f1f5f9; padding:15px; border-radius:10px; }
    .timer { font-size:23px; font-weight:800; color:#b91c1c; }
    .layout { display:grid; grid-template-columns:minmax(0,1fr) 260px; gap:18px; margin-top:20px; }
    .option { display:block; border:1px solid #cbd5e1; border-radius:9px; padding:13px; margin:10px 0; cursor:pointer; line-height:1.7; }
    .option.selected { border:2px solid #174ea6; background:#eff6ff; }
    .option input { margin-right:10px; }
    .actions { display:flex; justify-content:space-between; gap:10px; margin-top:22px; flex-wrap:wrap; }
    button { padding:10px 15px; border:0; border-radius:7px; background:#174ea6; color:white; font-weight:650; cursor:pointer; }
    button:disabled { opacity:.4; cursor:not-allowed; }
    .numbers { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; margin-top:12px; }
    .number { padding:9px 4px; border-radius:6px; background:#e2e8f0; color:#172033; }
    .number.answered { background:#bbf7d0; }
    .number.current { outline:2px solid #174ea6; }
    .submit { background:#15803d; width:100%; margin-top:18px; }
    .language-control { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
    .language-button { background:#e2e8f0; color:#172033; }
    .active-language { background:#174ea6; color:white; outline:2px solid #93c5fd; }
    .correct { color:#15803d; font-weight:700; }
    .wrong { color:#b91c1c; font-weight:700; }
    .review-item { border:1px solid #e2e8f0; padding:16px; border-radius:10px; margin:14px 0; }
    .notice { color:#b91c1c; }
    @media(max-width:750px) { .layout { grid-template-columns:1fr; } }
  `;

  if (authChecking) {
    return (
      <main className="page">
        <style>{style}</style>
        <div className="card">Checking your login...</div>
      </main>
    );
  }

  if (result) {
    const review = result.review || [];

    return (
      <main className="page">
        <style>{style}</style>

        {switchLanguage()}

        <div className="card">
          <h1>{t.result}</h1>
          <h2>
            {language === "hi"
              ? exam?.test_title_hi || exam?.test_title
              : exam?.test_title}
          </h2>

          {result.status === "time_expired" && (
            <p className="notice">{t.expired}</p>
          )}

          <h2 style={{ fontSize: 34, color: "#174ea6" }}>
            {result.score} / {result.total_marks}
          </h2>

          {result.passed !== null && result.passed !== undefined && (
            <p className={result.passed ? "correct" : "wrong"}>
              {result.passed ? t.congratulations : t.failed}
            </p>
          )}

          <p>
            {t.attempted}: {review.filter((q: any) => q.selected_option).length} / {exam?.questions.length}
          </p>
          <p>
            {t.correct}: {review.filter((q: any) => q.is_correct).length}
          </p>
          <p>
            {t.incorrect}: {review.filter((q: any) => q.selected_option && !q.is_correct).length}
          </p>
          <p>
            {t.unanswered}: {review.filter((q: any) => !q.selected_option).length}
          </p>
        </div>

        {review.length > 0 && (
          <section className="card">
            <h2>{t.review}</h2>

            {review.map((q: any, index: number) => (
              <div className="review-item" key={q.question_id}>
                <strong>
                  {index + 1}.{" "}
                  {language === "hi"
                    ? q.question_text_hi || q.question_text
                    : q.question_text}
                </strong>

                <p className={q.is_correct ? "correct" : "wrong"}>
                  {t.yourAnswer}: {q.selected_option || t.notAnswered}
                </p>

                <p className="correct">
                  {t.correctAnswer}: {q.correct_option}
                </p>

                <p>
                  {language === "hi"
                    ? q.explanation_hi || q.explanation || t.noExplanation
                    : q.explanation || t.noExplanation}
                </p>

                <p>{t.marksAwarded}: {q.awarded_marks}</p>
              </div>
            ))}
          </section>
        )}

        <a href="/mock-tests">{t.return}</a>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="page" style={{ maxWidth: 850 }}>
        <style>{style}</style>

        <a href="/mock-tests">← {t.back}</a>

        <div className="card">
          {switchLanguage()}

          <h1>{t.instructions}</h1>
          <h2>{t.title}</h2>

          <ul style={{ lineHeight: 2 }}>
            {t.points.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>

          <p>
            <strong>{t.important}</strong> {t.timerStart}
          </p>

          {error && <p className="notice">{error}</p>}

          <button onClick={startExam} disabled={loading}>
            {loading ? t.starting : t.start}
          </button>
        </div>
      </main>
    );
  }

  const question = exam?.questions[current];

  if (!exam || !question) {
    return <main className="page">Loading questions...</main>;
  }

  const answeredCount = Object.keys(answers).length;

  const displayedQuestion =
    language === "hi"
      ? question.question_text_hi || question.question_text
      : question.question_text;

  const displayedOptions =
    language === "hi"
      ? question.options_hi || question.options
      : question.options;

  return (
    <main className="page">
      <style>{style}</style>

      <div className="topbar">
        <div>
          <strong>
            {language === "hi"
              ? exam.test_title_hi || exam.test_title
              : exam.test_title}
          </strong>
          <div>{t.answered}: {answeredCount} / {exam.questions.length}</div>
        </div>

        <div className="timer">{formatTime(secondsLeft)}</div>
      </div>

      <div style={{ marginTop: 15 }}>
        {switchLanguage()}
      </div>

      <div className="layout">
        <section className="card">
          <p>
            {t.question} {current + 1} {language === "en" ? "of" : "में से"}{" "}
            {exam.questions.length}
          </p>

          <h2 style={{ fontSize: 21, lineHeight: 1.7 }}>
            {displayedQuestion}
          </h2>

          {(["A", "B", "C", "D"] as const).map((option) => (
            <label
              key={option}
              className={`option ${
                answers[question.id] === option ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === option}
                onChange={() =>
                  setAnswers((previous) => ({
                    ...previous,
                    [question.id]: option,
                  }))
                }
              />

              <strong>{option}.</strong> {displayedOptions[option]}
            </label>
          ))}

          <div className="actions">
            <button
              disabled={current === 0}
              onClick={() => setCurrent((value) => value - 1)}
            >
              {t.previous}
            </button>

            <button
              disabled={current === exam.questions.length - 1}
              onClick={() => setCurrent((value) => value + 1)}
            >
              {t.next}
            </button>
          </div>
        </section>

        <aside className="card">
          <h3>{t.navigator}</h3>

          <p style={{ fontSize: 13, color: "#64748b" }}>
            {t.legend}
          </p>

          <div className="numbers">
            {exam.questions.map((q, index) => (
              <button
                key={q.id}
                className={`number ${
                  answers[q.id] ? "answered" : ""
                } ${current === index ? "current" : ""}`}
                onClick={() => setCurrent(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <p style={{ marginTop: 15 }}>
            {t.answered}: <strong>{answeredCount}</strong>
          </p>

          <p>
            {t.remaining}:{" "}
            <strong>{exam.questions.length - answeredCount}</strong>
          </p>

          {error && <p className="notice">{error}</p>}

          <button
            className="submit"
            disabled={submitting}
            onClick={() => submitExam(false)}
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </aside>
      </div>
    </main>
  );
}
