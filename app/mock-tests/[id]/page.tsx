"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudentNavigation from "@/components/student/StudentNavigation";

type Language = "en" | "hi";
type OptionKey = "A" | "B" | "C" | "D";
type ExamOptions = Record<OptionKey, string>;

type ExamQuestion = {
  id: string;
  question_text: string;
  question_text_hi?: string;
  options: ExamOptions;
  options_hi?: ExamOptions;
  marks: number;
  sort_order: number;
};

type SavedAnswer = {
  question_id: string;
  selected_option: OptionKey | null;
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
  expires_at: string;
  remaining_seconds: number;
  resumed?: boolean;
  saved_answers: SavedAnswer[];
  questions: ExamQuestion[];
};

type ReviewQuestion = {
  question_id: string;
  question_text: string;
  question_text_hi?: string;
  options: ExamOptions;
  options_hi?: ExamOptions;
  correct_option: OptionKey;
  explanation?: string | null;
  explanation_hi?: string | null;
  selected_option: OptionKey | null;
  is_correct: boolean;
  awarded_marks: number;
};

type ExamResult = {
  status: "submitted" | "time_expired";
  already_submitted?: boolean;
  score: number;
  total_marks: number;
  pass_marks: number | null;
  passed: boolean | null;
  review: ReviewQuestion[];
};

type ReviewFilter = "all" | "correct" | "incorrect" | "unanswered";
type StoredExamUi = { current?: number; marked?: string[]; visited?: string[] };

const optionKeys: OptionKey[] = ["A", "B", "C", "D"];

const labels = {
  en: {
    back: "Back to Mock Tests", instructions: "Examination Instructions", start: "Start Examination",
    starting: "Starting examination…", question: "Question", of: "of", answered: "Answered",
    remaining: "Remaining", previous: "Previous", next: "Next", saveNext: "Save & Next",
    clear: "Clear Response", mark: "Mark for Review & Next", marked: "Marked for review",
    unmark: "Remove review mark", navigator: "Question Palette", legend: "Question status",
    language: "Question Language", saved: "All changes saved", saving: "Saving answer…",
    saveError: "An answer could not be saved. Check your connection before continuing.",
    submit: "Submit Examination", submitTitle: "Submit your examination?",
    submitBody: "Review your attempt summary before final submission. You cannot change answers after submitting.",
    confirmSubmit: "Confirm & Submit", reviewUnanswered: "Review unanswered", cancel: "Continue Exam",
    correct: "Correct", incorrect: "Incorrect", unanswered: "Unanswered", visited: "Visited",
    notVisited: "Not visited", result: "Your Performance Report",
    resultSubtitle: "Your examination has been evaluated. Review your performance and every answer below.",
    passed: "You passed this mock test", notPassed: "You did not reach the pass mark", score: "Score",
    percentage: "Score percentage", attempted: "Attempted", accuracy: "Accuracy", attemptRate: "Attempt rate",
    timeTaken: "Time taken", positiveMarks: "Marks earned", negativeMarks: "Negative marks",
    passMark: "Pass mark", performanceBreakdown: "Performance Breakdown", answerAnalysis: "Answer Analysis",
    answerReview: "Question-wise Review",
    reviewHint: "Open any question to view your selected answer, the correct answer and its explanation.",
    all: "All", showCorrect: "Correct", showIncorrect: "Incorrect", showUnanswered: "Unanswered",
    yourAnswer: "Your answer", correctAnswer: "Correct answer", notAnswered: "Not answered",
    explanation: "Explanation", noExplanation: "No explanation has been provided for this question.",
    marksAwarded: "Marks awarded", timeExpired: "Time expired. Your saved answers were submitted automatically.",
    saveNotice: "Your answers are saved automatically as you work.", negative: "Negative marking",
    totalMarks: "Maximum marks", duration: "Duration", submitSummary: "Submission Summary",
    savedAnswers: "Saved answers", unansweredCount: "Unanswered questions",
    return: "Return to Mock Tests", retake: "Take another attempt", retrySubmit: "Retry submission",
    noQuestions: "No questions match this filter.", performanceTip: "Performance insight",
    strongAccuracy: "Good accuracy. Keep strengthening your consistency.",
    improveAccuracy: "Review the incorrect answers and revisit the underlying concepts.",
    unansweredAdvice: "You left some questions unanswered. Practise time allocation and question selection.",
  },
  hi: {
    back: "मॉक टेस्ट पर वापस जाएँ", instructions: "परीक्षा के निर्देश", start: "परीक्षा शुरू करें",
    starting: "परीक्षा शुरू हो रही है…", question: "प्रश्न", of: "में से", answered: "उत्तर दिए गए",
    remaining: "शेष", previous: "पिछला", next: "अगला", saveNext: "सहेजें और आगे बढ़ें",
    clear: "उत्तर हटाएँ", mark: "समीक्षा हेतु चिह्नित करें", marked: "समीक्षा हेतु चिह्नित",
    unmark: "समीक्षा चिह्न हटाएँ", navigator: "प्रश्न सूची", legend: "प्रश्न की स्थिति",
    language: "प्रश्नों की भाषा", saved: "सभी उत्तर सहेजे गए", saving: "उत्तर सहेजा जा रहा है…",
    saveError: "उत्तर सहेजा नहीं जा सका। आगे बढ़ने से पहले इंटरनेट जाँचें।",
    submit: "परीक्षा जमा करें", submitTitle: "क्या आप परीक्षा जमा करना चाहते हैं?",
    submitBody: "अंतिम रूप से जमा करने से पहले अपने उत्तरों की स्थिति जाँच लें। जमा करने के बाद उत्तर नहीं बदल सकेंगे।",
    confirmSubmit: "पुष्टि करें और जमा करें", reviewUnanswered: "अनुत्तरित प्रश्न देखें",
    cancel: "परीक्षा जारी रखें", correct: "सही", incorrect: "गलत", unanswered: "अनुत्तरित",
    visited: "देखा गया", notVisited: "नहीं देखा", result: "आपकी प्रदर्शन रिपोर्ट",
    resultSubtitle: "आपकी परीक्षा का मूल्यांकन हो चुका है। अपना प्रदर्शन और प्रत्येक उत्तर नीचे देखें।",
    passed: "आपने यह मॉक टेस्ट उत्तीर्ण किया", notPassed: "आप निर्धारित उत्तीर्ण अंक प्राप्त नहीं कर सके",
    score: "प्राप्त अंक", percentage: "अंकों का प्रतिशत", attempted: "हल किए गए", accuracy: "सटीकता",
    attemptRate: "प्रयास दर", timeTaken: "लगा समय", positiveMarks: "अर्जित अंक",
    negativeMarks: "नकारात्मक अंक", passMark: "उत्तीर्ण अंक", performanceBreakdown: "प्रदर्शन का विश्लेषण",
    answerAnalysis: "उत्तर विश्लेषण", answerReview: "प्रश्नवार समीक्षा",
    reviewHint: "अपने चुने गए उत्तर, सही उत्तर और व्याख्या देखने के लिए प्रश्न खोलें।",
    all: "सभी", showCorrect: "सही", showIncorrect: "गलत", showUnanswered: "अनुत्तरित",
    yourAnswer: "आपका उत्तर", correctAnswer: "सही उत्तर", notAnswered: "उत्तर नहीं दिया",
    explanation: "व्याख्या", noExplanation: "इस प्रश्न की व्याख्या उपलब्ध नहीं है।",
    marksAwarded: "प्राप्त अंक", timeExpired: "समय समाप्त हो गया। सहेजे गए उत्तर स्वतः जमा कर दिए गए।",
    saveNotice: "आपके उत्तर काम करते समय स्वतः सहेजे जाते हैं।", negative: "नकारात्मक अंक",
    totalMarks: "कुल अंक", duration: "अवधि", submitSummary: "जमा करने का सारांश",
    savedAnswers: "सहेजे गए उत्तर", unansweredCount: "अनुत्तरित प्रश्न",
    return: "मॉक टेस्ट पर वापस जाएँ", retake: "एक और प्रयास करें", retrySubmit: "दोबारा जमा करें",
    noQuestions: "इस फ़िल्टर से कोई प्रश्न नहीं मिला।", performanceTip: "प्रदर्शन सुझाव",
    strongAccuracy: "अच्छी सटीकता। इसी निरंतरता को बनाए रखें।",
    improveAccuracy: "गलत उत्तरों की समीक्षा करें और संबंधित अवधारणाओं को दोहराएँ।",
    unansweredAdvice: "कुछ प्रश्न अनुत्तरित रहे। समय प्रबंधन और प्रश्न चयन का अभ्यास करें।",
  },
};

function readStoredUi(attemptId: string): StoredExamUi {
  try {
    const raw = window.localStorage.getItem("eduaxis-exam-ui:" + attemptId);
    return raw ? (JSON.parse(raw) as StoredExamUi) : {};
  } catch {
    return {};
  }
}

function saveStoredUi(attemptId: string, state: StoredExamUi) {
  try {
    window.localStorage.setItem("eduaxis-exam-ui:" + attemptId, JSON.stringify(state));
  } catch {
    // Server-side answer storage remains authoritative when browser storage is unavailable.
  }
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  if (hours > 0) return [hours, minutes, remaining].map((n) => String(n).padStart(2, "0")).join(":");
  return [minutes, remaining].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatPercent(value: number) {
  return (Number.isFinite(value) ? value : 0).toFixed(1) + "%";
}

export default function MockTestExamPage() {
  const params = useParams();
  const testId = String(params.id);
  const [language, setLanguage] = useState<Language>("en");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [deadlineAtMs, setDeadlineAtMs] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [savingQuestionIds, setSavingQuestionIds] = useState<string[]>([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [timeTakenSeconds, setTimeTakenSeconds] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [expandedReviewIds, setExpandedReviewIds] = useState<string[]>([]);
  const saveRequestsRef = useRef<Map<string, Promise<void>>>(new Map());
  const autoSubmitStartedRef = useRef(false);

  const t = labels[language];

  useEffect(() => {
    let active = true;
    async function checkStudentLogin() {
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
        window.location.replace("/student/login?next=" + encodeURIComponent(nextPath));
        return;
      }
      setAuthChecking(false);
    }
    checkStudentLogin();
    return () => { active = false; };
  }, []);

  const startExam = async () => {
    if (!supabase || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        const nextPath = window.location.pathname + window.location.search;
        window.location.href = "/student/login?next=" + encodeURIComponent(nextPath);
        return;
      }
      const { data, error: startError } = await supabase.rpc("start_mock_test", {
        p_mock_test_id: testId,
      });
      if (startError) throw startError;

      const examData = data as ExamData;
      if (!examData || !examData.attempt_id || !Array.isArray(examData.questions) || examData.questions.length === 0) {
        throw new Error("The examination could not be loaded. Please contact support.");
      }
      setExam(examData);

      const restoredAnswers: Record<string, OptionKey> = {};
      for (const saved of examData.saved_answers || []) {
        if (saved.selected_option && optionKeys.includes(saved.selected_option)) {
          restoredAnswers[saved.question_id] = saved.selected_option;
        }
      }
      setAnswers(restoredAnswers);

      const stored = readStoredUi(examData.attempt_id);
      const restoredCurrent = Math.max(0, Math.min(examData.questions.length - 1, Number(stored.current) || 0));
      const knownIds = new Set(examData.questions.map((question) => question.id));
      const restoredMarked = (stored.marked || []).filter((id) => knownIds.has(id));
      const restoredVisited = (stored.visited || []).filter((id) => knownIds.has(id));
      const currentQuestionId = examData.questions[restoredCurrent].id;
      setCurrent(restoredCurrent);
      setMarked(restoredMarked);
      setVisited(Array.from(new Set([...restoredVisited, currentQuestionId])));

      const remainingSeconds = Math.max(0, Number(examData.remaining_seconds) || 0);
      setSecondsLeft(remainingSeconds);
      setDeadlineAtMs(Date.now() + remainingSeconds * 1000);
      autoSubmitStartedRef.current = false;
      setStarted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The examination could not be started.");
    } finally {
      setLoading(false);
    }
  };

  const persistAnswer = useCallback((questionId: string, option: OptionKey | null) => {
    const client = supabase;
    const currentExam = exam;
    if (!client || !currentExam) return Promise.reject(new Error("The answer service is unavailable."));

    setSaveError(false);
    setSavingQuestionIds((previous) => Array.from(new Set([...previous, questionId])));
    const previousRequest = saveRequestsRef.current.get(questionId);
    const request = (previousRequest || Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const { error: saveFailure } = await client.rpc("save_mock_test_answer", {
          p_attempt_id: currentExam.attempt_id,
          p_question_id: questionId,
          p_selected_option: option,
        });
        if (saveFailure) throw new Error(saveFailure.message);
      });
    saveRequestsRef.current.set(questionId, request);

    return request
      .then(() => {
        if (saveRequestsRef.current.get(questionId) === request) setSaveError(false);
      })
      .catch((caught) => {
        if (saveRequestsRef.current.get(questionId) === request) setSaveError(true);
        throw caught;
      })
      .finally(() => {
        if (saveRequestsRef.current.get(questionId) === request) {
          saveRequestsRef.current.delete(questionId);
          setSavingQuestionIds((previous) => previous.filter((id) => id !== questionId));
        }
      });
  }, [exam]);

  const selectAnswer = (questionId: string, option: OptionKey) => {
    setAnswers((previous) => ({ ...previous, [questionId]: option }));
    void persistAnswer(questionId, option).catch(() => undefined);
  };

  const clearResponse = () => {
    if (!exam) return;
    const questionId = exam.questions[current].id;
    setAnswers((previous) => {
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
    void persistAnswer(questionId, null).catch(() => undefined);
  };

  const goToQuestion = (index: number) => {
    if (!exam || index < 0 || index >= exam.questions.length) return;
    setCurrent(index);
    const id = exam.questions[index].id;
    setVisited((previous) => previous.includes(id) ? previous : [...previous, id]);
  };

  const saveAndNext = async () => {
    if (!exam) return;
    const questionId = exam.questions[current].id;
    const pending = saveRequestsRef.current.get(questionId);
    if (pending) {
      try { await pending; } catch { return; }
    }
    if (current < exam.questions.length - 1) goToQuestion(current + 1);
  };

  const markForReviewAndNext = () => {
    if (!exam) return;
    const questionId = exam.questions[current].id;
    setMarked((previous) => previous.includes(questionId)
      ? previous.filter((id) => id !== questionId)
      : [...previous, questionId]);
    if (current < exam.questions.length - 1) goToQuestion(current + 1);
  };

  const submitExam = useCallback(async (confirmed = false) => {
    if (!supabase || !exam || submitting || result) return;
    if (!confirmed) {
      setShowSubmitDialog(true);
      return;
    }

    setShowSubmitDialog(false);
    setSubmitting(true);
    setError("");
    await Promise.allSettled(Array.from(saveRequestsRef.current.values()));

    const submittedAt = Date.now();
    const startedAt = Date.parse(exam.expires_at) - exam.duration_minutes * 60 * 1000;
    setTimeTakenSeconds(Math.min(
      exam.duration_minutes * 60,
      Math.max(0, Math.floor((submittedAt - startedAt) / 1000))
    ));

    const answerList = exam.questions.map((question) => ({
      question_id: question.id,
      selected_option: answers[question.id] || null,
    }));

    const { data, error: submitError } = await supabase.rpc("submit_mock_test", {
      p_attempt_id: exam.attempt_id,
      p_answers: answerList,
    });

    if (submitError) {
      setError(submitError.message);
      setSubmitting(false);
      return;
    }

    setResult(data as ExamResult);
    setSubmitting(false);
    try { window.localStorage.removeItem("eduaxis-exam-ui:" + exam.attempt_id); } catch { /* ignore */ }
  }, [exam, answers, submitting, result]);

  useEffect(() => {
    if (!started || result || submitting || deadlineAtMs === null) return;
    const updateRemainingTime = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineAtMs - Date.now()) / 1000)));
    };
    updateRemainingTime();
    const timer = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(timer);
  }, [started, result, submitting, deadlineAtMs]);

  useEffect(() => {
    if (started && secondsLeft <= 0 && !result && !submitting && !autoSubmitStartedRef.current) {
      autoSubmitStartedRef.current = true;
      void submitExam(true);
    }
  }, [started, secondsLeft, result, submitting, submitExam]);

  useEffect(() => {
    if (!started || !exam) return;
    saveStoredUi(exam.attempt_id, { current, marked, visited });
  }, [started, exam, current, marked, visited]);

  const switchLanguage = () => (
    <div className="ea-language-control" aria-label={t.language}>
      <span>{t.language}</span>
      <button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>English</button>
      <button type="button" className={language === "hi" ? "is-active" : ""} onClick={() => setLanguage("hi")}>हिन्दी</button>
    </div>
  );

  const answeredCount = exam ? Object.keys(answers).length : 0;
  const unansweredCount = exam ? exam.questions.length - answeredCount : 0;
  const currentQuestion = exam?.questions[current];
  const saveStatus = saveError ? t.saveError : savingQuestionIds.length > 0 ? t.saving : t.saved;

  const style = [
    ".ea-exam-page{min-height:100vh;background:#f2f6fa;color:#142b43;padding:0 0 36px;font-family:inherit}",
    ".ea-exam-brandbar{background:#102b46;color:#fff;padding:13px 24px;display:flex;justify-content:space-between;align-items:center;gap:14px}",
    ".ea-exam-brand{font-size:17px;font-weight:850;letter-spacing:.1px}.ea-exam-brand span{color:#62d4c8}.ea-exam-mode{font-size:11px;letter-spacing:1.1px;color:#c9e3e5;font-weight:800}",
    ".ea-exam-container{max-width:1440px;margin:0 auto;padding:20px 24px}.ea-exam-back{display:inline-flex;color:#1760a6;text-decoration:none;font-weight:700;margin:0 0 16px}",
    ".ea-exam-card{background:#fff;border:1px solid #dce6ef;border-radius:16px;padding:22px;box-shadow:0 5px 18px rgba(17,48,75,.045)}.ea-exam-instructions{max-width:900px;margin:22px auto}",
    ".ea-exam-kicker{font-size:11px;text-transform:uppercase;letter-spacing:1.35px;color:#078e8d;font-weight:850}.ea-exam-h1{font-size:clamp(28px,4vw,42px);line-height:1.12;margin:9px 0 8px;color:#102b46}.ea-exam-muted{color:#637990;line-height:1.65}",
    ".ea-exam-instruction-list{padding-left:22px;line-height:1.9;color:#40576c}",
    ".ea-exam-primary,.ea-exam-secondary,.ea-exam-danger,.ea-exam-soft{border:0;border-radius:9px;padding:11px 16px;font-weight:750;font-size:14px;cursor:pointer;transition:transform .15s,box-shadow .15s,background .15s}",
    ".ea-exam-primary{background:#1557a6;color:#fff;box-shadow:0 4px 10px rgba(21,87,166,.16)}.ea-exam-primary:hover{background:#104987;transform:translateY(-1px)}",
    ".ea-exam-secondary{background:#e9f0f6;color:#18364f}.ea-exam-secondary:hover{background:#dce7f0}.ea-exam-danger{background:#13834b;color:#fff}.ea-exam-danger:hover{background:#0d6e3e}.ea-exam-soft{background:#fff;color:#31506a;border:1px solid #d5e0e9}",
    ".ea-exam-primary:disabled,.ea-exam-secondary:disabled,.ea-exam-danger:disabled,.ea-exam-soft:disabled{opacity:.45;cursor:not-allowed;transform:none}",
    ".ea-exam-language-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 16px}.ea-language-control{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:#496176;font-size:13px;font-weight:650}",
    ".ea-language-control button{background:#e7edf3;color:#28445d;border:1px solid transparent;border-radius:8px;padding:8px 13px;font-weight:750;cursor:pointer}.ea-language-control button.is-active{background:#1557a6;color:#fff;border-color:#1557a6}",
    ".ea-exam-sticky{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #dce6ef;box-shadow:0 4px 14px rgba(16,43,70,.06)}.ea-exam-sticky-inner{max-width:1440px;margin:auto;padding:12px 24px;display:grid;grid-template-columns:minmax(220px,1fr) auto auto;align-items:center;gap:22px}",
    ".ea-exam-title{font-size:15px;font-weight:850;color:#17324d;line-height:1.35}.ea-exam-subtitle{font-size:12px;color:#698095;margin-top:4px}.ea-exam-timer{border:1px solid #dce6ef;background:#f5f8fb;border-radius:11px;padding:8px 14px;text-align:center;min-width:105px}",
    ".ea-exam-timer-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#70869a;font-weight:800}.ea-exam-timer-value{font-variant-numeric:tabular-nums;font-size:23px;color:#153c61;font-weight:900}.ea-exam-timer.is-low{background:#fff3f1;border-color:#f4c9c2}.ea-exam-timer.is-low .ea-exam-timer-value{color:#c23b32}",
    ".ea-exam-save-state{font-size:11px;color:#16814b;font-weight:700;text-align:right;max-width:230px}.ea-exam-save-state.is-error{color:#b33b36}.ea-exam-progress{height:4px;background:#e8eef3}.ea-exam-progress>span{display:block;height:100%;background:linear-gradient(90deg,#087f88,#37c0ad);transition:width .2s}",
    ".ea-exam-workspace{max-width:1440px;margin:0 auto;padding:20px 24px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start}.ea-exam-question-panel{min-height:580px}",
    ".ea-exam-question-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:15px}.ea-exam-question-number{font-size:13px;color:#60798e;font-weight:750}.ea-exam-mark-value{font-size:11px;color:#60798e;background:#f2f6f9;border-radius:30px;padding:6px 10px;font-weight:750}",
    ".ea-exam-question-text{font-size:clamp(19px,2vw,24px);line-height:1.52;color:#112f4a;margin:12px 0 24px;font-weight:800}.ea-exam-option{display:flex;align-items:flex-start;gap:13px;border:1px solid #d7e2ec;border-radius:11px;padding:15px 16px;margin:11px 0;cursor:pointer;line-height:1.6;color:#29465f;transition:border .15s,background .15s}.ea-exam-option:hover{border-color:#8baecc;background:#f8fbfd}.ea-exam-option.is-selected{border:2px solid #1764b4;background:#edf5ff;padding:14px 15px;color:#153a61}",
    ".ea-exam-radio{width:18px;height:18px;margin-top:3px;accent-color:#1557a6;flex:0 0 auto}.ea-exam-option-letter{font-weight:900;color:#087f88;min-width:21px}.ea-exam-option-text{flex:1}",
    ".ea-exam-question-actions{border-top:1px solid #e8eef3;margin-top:28px;padding-top:18px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ea-exam-action-left,.ea-exam-action-right{display:flex;gap:9px;flex-wrap:wrap}.ea-exam-review-mark{border-color:#b6a0dc;color:#6e4a9f;background:#f5f0fc}.ea-exam-review-mark.is-marked{background:#6c4ba1;border-color:#6c4ba1;color:#fff}",
    ".ea-exam-sidebar{position:sticky;top:115px}.ea-exam-palette-heading{display:flex;justify-content:space-between;align-items:center;gap:8px}.ea-exam-palette-title{font-size:18px;margin:0;color:#17344e}.ea-exam-palette-count{font-size:12px;color:#657c90}",
    ".ea-exam-legend{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0;padding:13px;background:#f7f9fb;border-radius:10px}.ea-exam-legend-item{display:flex;align-items:center;gap:7px;font-size:11px;color:#536b80}.ea-exam-dot{width:11px;height:11px;border-radius:3px;display:inline-block;flex:0 0 auto}.ea-exam-dot.answered{background:#159b69}.ea-exam-dot.marked{background:#8a62b6}.ea-exam-dot.visited{background:#9aabb9}.ea-exam-dot.notvisited{background:#e5ebf1;border:1px solid #cbd6e0}",
    ".ea-exam-palette{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-height:390px;overflow:auto;padding:2px 4px 4px 2px}.ea-exam-palette-btn{position:relative;min-height:39px;border:1px solid #d7e1ea;border-radius:8px;background:#eef2f6;color:#324b61;font-weight:800;font-size:12px;cursor:pointer}.ea-exam-palette-btn.is-visited{background:#e2eaf1}.ea-exam-palette-btn.is-answered{background:#159b69;color:#fff;border-color:#159b69}.ea-exam-palette-btn.is-marked{background:#8a62b6;color:#fff;border-color:#8a62b6}.ea-exam-palette-btn.is-answered-marked{background:#159b69;color:#fff;border:2px solid #8a62b6}.ea-exam-palette-btn.is-current{outline:3px solid #8fc0f2;outline-offset:1px}.ea-exam-review-dot{position:absolute;width:7px;height:7px;border-radius:50%;background:#e9d9ff;right:4px;top:4px}",
    ".ea-exam-sidebar-summary{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:17px}.ea-exam-mini-stat{background:#f6f9fb;border:1px solid #e7edf2;border-radius:9px;padding:10px}.ea-exam-mini-stat strong{display:block;font-size:20px;color:#173a59}.ea-exam-mini-stat span{font-size:11px;color:#6a8093}.ea-exam-submit-button{width:100%;margin-top:15px;padding:13px}.ea-exam-error{padding:12px 14px;border-radius:9px;background:#fff0ef;color:#a6312c;border:1px solid #f2cfca;margin:12px 0;font-size:13px}.ea-exam-save-note{font-size:11px;color:#70859a;margin-top:10px;line-height:1.5}",
    ".ea-exam-overlay{position:fixed;inset:0;z-index:60;background:rgba(9,27,44,.58);display:grid;place-items:center;padding:18px}.ea-exam-dialog{width:min(100%,620px);background:#fff;border-radius:16px;padding:25px;box-shadow:0 22px 70px rgba(0,0,0,.23)}.ea-exam-dialog h2{margin:0 0 8px;color:#122e49}.ea-exam-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.ea-exam-summary-cell{padding:13px;border:1px solid #e0e8ef;background:#f7f9fb;border-radius:10px}.ea-exam-summary-cell strong{display:block;font-size:24px;color:#183d5d}.ea-exam-summary-cell span{font-size:11px;color:#6a8093}.ea-exam-dialog-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:22px}",
    ".ea-report-page{min-height:100vh;background:#f2f6fa;color:#142b43;padding-bottom:50px}.ea-report-wrap{max-width:1260px;margin:0 auto;padding:26px 24px}.ea-report-hero{border-radius:18px;background:linear-gradient(125deg,#102b46,#126d71);padding:30px;color:#fff;display:grid;grid-template-columns:1.2fr .8fr;gap:22px;align-items:center;box-shadow:0 12px 28px rgba(16,43,70,.16)}.ea-report-hero h1{font-size:clamp(27px,3vw,40px);margin:7px 0 8px}.ea-report-hero p{color:#d6e9ef;margin:0;line-height:1.6}",
    ".ea-report-scorebox{justify-self:end;text-align:center;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);border-radius:15px;padding:19px 28px;min-width:205px}.ea-report-scorebox strong{display:block;font-size:42px;line-height:1.15}.ea-report-scorebox span{font-size:12px;color:#d5e8eb}.ea-report-status{display:inline-flex;border-radius:30px;padding:7px 12px;font-size:12px;font-weight:850;background:rgba(255,255,255,.14);margin-top:15px}.ea-report-status.is-pass{background:#d7f6e6;color:#096c3e}.ea-report-status.is-fail{background:#ffe6e2;color:#a1352e}",
    ".ea-report-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin:17px 0}.ea-report-stat{background:#fff;border:1px solid #dce6ef;border-radius:13px;padding:17px}.ea-report-stat span{display:block;font-size:12px;color:#6c8195}.ea-report-stat strong{display:block;font-size:26px;color:#173a59;margin-top:6px}.ea-report-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}.ea-report-panel{background:#fff;border:1px solid #dce6ef;border-radius:14px;padding:21px}.ea-report-panel h2{font-size:19px;margin:0 0 5px;color:#17344e}.ea-report-panel>p{font-size:12px;color:#6b8195;line-height:1.6;margin:5px 0 18px}",
    ".ea-report-bar{height:16px;border-radius:30px;background:#edf1f4;overflow:hidden;display:flex;margin:18px 0 14px}.ea-report-bar span{height:100%;display:block}.ea-report-bar .correct{background:#169b68}.ea-report-bar .incorrect{background:#d85b55}.ea-report-bar .unanswered{background:#dce4eb}.ea-report-breakdown{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ea-report-breakdown-item{display:flex;align-items:center;gap:7px;font-size:12px;color:#536b80}.ea-report-breakdown-item strong{margin-left:auto;color:#183b59}.ea-report-breakdown-item i{display:inline-block;width:9px;height:9px;border-radius:3px}.ea-report-breakdown-item .correct{background:#169b68}.ea-report-breakdown-item .incorrect{background:#d85b55}.ea-report-breakdown-item .unanswered{background:#dce4eb}",
    ".ea-report-line{display:flex;align-items:center;gap:10px;margin:14px 0}.ea-report-line-label{width:120px;font-size:12px;color:#576f84}.ea-report-line-track{flex:1;height:9px;border-radius:20px;background:#edf1f5;overflow:hidden}.ea-report-line-fill{height:100%;border-radius:20px;background:linear-gradient(90deg,#087f88,#35b9a6)}.ea-report-line-value{width:52px;text-align:right;font-size:12px;font-weight:800;color:#1a405e}.ea-report-insight{background:#edf7f6;border:1px solid #cfe9e5;color:#285b60;border-radius:10px;padding:14px;font-size:13px;line-height:1.6;margin-top:14px}",
    ".ea-review-header{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap}.ea-review-filters{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}.ea-review-filter{border:1px solid #d7e2eb;background:#f5f8fa;color:#38536b;padding:8px 12px;border-radius:30px;font-size:12px;font-weight:750;cursor:pointer}.ea-review-filter.is-active{background:#1557a6;color:#fff;border-color:#1557a6}.ea-review-list{display:grid;gap:10px;margin-top:15px}.ea-review-item{background:#fff;border:1px solid #dce6ef;border-radius:12px;overflow:hidden}.ea-review-item summary{cursor:pointer;list-style:none;display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px}.ea-review-item summary::-webkit-details-marker{display:none}.ea-review-index{width:34px;height:34px;border-radius:9px;background:#eff3f7;display:grid;place-items:center;font-weight:850;color:#294863}.ea-review-index.is-correct{background:#dff6eb;color:#13734b}.ea-review-index.is-incorrect{background:#ffebe8;color:#b33a32}.ea-review-question{font-size:13px;line-height:1.5;font-weight:800;color:#1b3853}.ea-review-status{font-size:11px;font-weight:850;padding:6px 9px;border-radius:30px;white-space:nowrap}.ea-review-status.is-correct{background:#def5e8;color:#14744a}.ea-review-status.is-incorrect{background:#ffebe8;color:#ac3c35}.ea-review-status.is-unanswered{background:#edf1f5;color:#5d7184}",
    ".ea-review-detail{border-top:1px solid #e9eef2;padding:16px 18px 18px}.ea-review-option{padding:9px 11px;border:1px solid #e1e8ee;border-radius:8px;font-size:12px;color:#4e657a;margin:7px 0}.ea-review-option.is-selected{border-color:#7ba8d2;background:#eff6fc;color:#193d5e}.ea-review-option.is-correct{border-color:#9ad7b9;background:#edfaf3;color:#176a45}.ea-review-explanation{margin-top:14px;padding:13px;background:#f4f8fb;border-radius:9px;color:#526a7e;font-size:12px;line-height:1.65}.ea-report-actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}",
    "@media(max-width:980px){.ea-exam-workspace{grid-template-columns:minmax(0,1fr) 300px}.ea-report-stats{grid-template-columns:repeat(2,1fr)}}",
    "@media(max-width:760px){.ea-exam-sticky-inner{grid-template-columns:1fr auto;padding:10px 14px;gap:10px}.ea-exam-save-state{grid-column:1/-1;text-align:left;max-width:none}.ea-exam-workspace{grid-template-columns:1fr;padding:12px}.ea-exam-sidebar{position:static;order:2}.ea-exam-container{padding:14px}.ea-exam-card{padding:16px}.ea-exam-question-panel{min-height:0}.ea-exam-question-actions{gap:8px}.ea-exam-action-left,.ea-exam-action-right{width:100%}.ea-exam-action-left button,.ea-exam-action-right button{flex:1}.ea-report-wrap{padding:16px 12px}.ea-report-hero{grid-template-columns:1fr;padding:22px}.ea-report-scorebox{justify-self:start}.ea-report-grid{grid-template-columns:1fr}.ea-report-breakdown{grid-template-columns:1fr}.ea-exam-summary-grid{grid-template-columns:repeat(3,1fr)}}",
    "@media(max-width:440px){.ea-report-stats{grid-template-columns:repeat(2,1fr)}.ea-exam-summary-cell strong{font-size:20px}.ea-exam-summary-cell{padding:9px}.ea-exam-brandbar{padding:11px 14px}.ea-exam-brand{font-size:15px}.ea-exam-mode{font-size:9px}}",
  ].join("\n");

  if (authChecking) {
    return <main className="ea-exam-page"><style>{style}</style><StudentNavigation /><div className="ea-exam-container"><div className="ea-exam-card">Checking your student account…</div></div></main>;
  }

  if (result && exam) {
    const review = result.review || [];
    const attempted = review.filter((item) => item.selected_option !== null).length;
    const correct = review.filter((item) => item.is_correct).length;
    const incorrect = attempted - correct;
    const unanswered = review.length - attempted;
    const accuracy = attempted > 0 ? correct / attempted * 100 : 0;
    const attemptRate = review.length > 0 ? attempted / review.length * 100 : 0;
    const scorePercent = result.total_marks > 0 ? result.score / result.total_marks * 100 : 0;
    const positiveMarks = review.reduce((sum, item) => sum + Math.max(0, Number(item.awarded_marks) || 0), 0);
    const negativeMarks = review.reduce((sum, item) => sum + Math.abs(Math.min(0, Number(item.awarded_marks) || 0)), 0);
    const filteredReview = review.filter((item) => {
      if (reviewFilter === "correct") return item.is_correct;
      if (reviewFilter === "incorrect") return item.selected_option !== null && !item.is_correct;
      if (reviewFilter === "unanswered") return item.selected_option === null;
      return true;
    });
    const insight = accuracy >= 75 ? labels[language].strongAccuracy : incorrect > correct ? labels[language].improveAccuracy : unanswered > 0 ? labels[language].unansweredAdvice : labels[language].strongAccuracy;

    return (
      <main className="ea-report-page">
        <style>{style}</style>
        <StudentNavigation />
        <div className="ea-report-wrap">
          <div className="ea-report-hero">
            <div>
              <div className="ea-exam-kicker" style={{ color: "#72ded4" }}>EDUAXIS INDIA · MOCK TEST REPORT</div>
              <h1>{t.result}</h1>
              <p>{language === "hi" ? exam.test_title_hi || exam.test_title : exam.test_title}</p>
              <p style={{ marginTop: 8, fontSize: 12 }}>{t.resultSubtitle}</p>
              <span className={"ea-report-status " + (result.passed === null ? "" : result.passed ? "is-pass" : "is-fail")}>
                {result.passed === null ? result.status === "time_expired" ? t.timeExpired : t.result : result.passed ? t.passed : t.notPassed}
              </span>
            </div>
            <div className="ea-report-scorebox">
              <strong>{Number(result.score).toFixed(2)}</strong>
              <span>{t.score} / {Number(result.total_marks).toFixed(2)}</span>
              <div style={{ fontSize: 14, fontWeight: 850, marginTop: 10 }}>{formatPercent(scorePercent)}</div>
            </div>
          </div>

          {result.status === "time_expired" && <div className="ea-exam-error" style={{ marginTop: 15 }}>{t.timeExpired}</div>}

          <div className="ea-report-stats">
            <div className="ea-report-stat"><span>{t.attempted}</span><strong>{attempted} / {review.length}</strong></div>
            <div className="ea-report-stat"><span>{t.accuracy}</span><strong>{formatPercent(accuracy)}</strong></div>
            <div className="ea-report-stat"><span>{t.attemptRate}</span><strong>{formatPercent(attemptRate)}</strong></div>
            <div className="ea-report-stat"><span>{t.timeTaken}</span><strong>{formatTime(timeTakenSeconds)}</strong></div>
          </div>

          <div className="ea-report-grid">
            <section className="ea-report-panel">
              <h2>{t.performanceBreakdown}</h2>
              <p>Your results are calculated from the submitted answers and the test marking rules.</p>
              <div className="ea-report-bar" aria-label="Answer distribution">
                <span className="correct" style={{ width: (review.length ? correct / review.length * 100 : 0) + "%" }} />
                <span className="incorrect" style={{ width: (review.length ? incorrect / review.length * 100 : 0) + "%" }} />
                <span className="unanswered" style={{ width: (review.length ? unanswered / review.length * 100 : 0) + "%" }} />
              </div>
              <div className="ea-report-breakdown">
                <div className="ea-report-breakdown-item"><i className="correct" />{t.correct}<strong>{correct}</strong></div>
                <div className="ea-report-breakdown-item"><i className="incorrect" />{t.incorrect}<strong>{incorrect}</strong></div>
                <div className="ea-report-breakdown-item"><i className="unanswered" />{t.unanswered}<strong>{unanswered}</strong></div>
              </div>
              <div className="ea-report-insight"><strong>{t.performanceTip}: </strong>{insight}</div>
            </section>

            <section className="ea-report-panel">
              <h2>{t.answerAnalysis}</h2>
              <p>Understand your marks, accuracy and test coverage at a glance.</p>
              <div className="ea-report-line">
                <span className="ea-report-line-label">{t.percentage}</span>
                <div className="ea-report-line-track"><div className="ea-report-line-fill" style={{ width: Math.max(0, Math.min(100, scorePercent)) + "%" }} /></div>
                <strong className="ea-report-line-value">{formatPercent(scorePercent)}</strong>
              </div>
              <div className="ea-report-line">
                <span className="ea-report-line-label">{t.accuracy}</span>
                <div className="ea-report-line-track"><div className="ea-report-line-fill" style={{ width: accuracy + "%" }} /></div>
                <strong className="ea-report-line-value">{formatPercent(accuracy)}</strong>
              </div>
              <div className="ea-report-line">
                <span className="ea-report-line-label">{t.attemptRate}</span>
                <div className="ea-report-line-track"><div className="ea-report-line-fill" style={{ width: attemptRate + "%" }} /></div>
                <strong className="ea-report-line-value">{formatPercent(attemptRate)}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
                <div className="ea-exam-mini-stat"><strong>{positiveMarks.toFixed(2)}</strong><span>{t.positiveMarks}</span></div>
                <div className="ea-exam-mini-stat"><strong>{negativeMarks.toFixed(2)}</strong><span>{t.negativeMarks}</span></div>
                {result.pass_marks !== null && <div className="ea-exam-mini-stat"><strong>{Number(result.pass_marks).toFixed(2)}</strong><span>{t.passMark}</span></div>}
                <div className="ea-exam-mini-stat"><strong>{Number(exam.negative_marking).toFixed(2)}</strong><span>{t.negative}</span></div>
              </div>
            </section>
          </div>

          <section className="ea-report-panel">
            <div className="ea-review-header">
              <div><h2>{t.answerReview}</h2><p style={{ marginBottom: 0 }}>{t.reviewHint}</p></div>
              <span style={{ color: "#60798e", fontSize: 12, fontWeight: 750 }}>{filteredReview.length} / {review.length} questions</span>
            </div>
            <div className="ea-review-filters" aria-label="Filter question review">
              {([
                ["all", t.all, review.length],
                ["correct", t.showCorrect, correct],
                ["incorrect", t.showIncorrect, incorrect],
                ["unanswered", t.showUnanswered, unanswered],
              ] as Array<[ReviewFilter, string, number]>).map(([key, label, count]) => (
                <button key={key} type="button" className={"ea-review-filter " + (reviewFilter === key ? "is-active" : "")} onClick={() => setReviewFilter(key)}>
                  {label} ({count})
                </button>
              ))}
            </div>
            {filteredReview.length === 0 ? <div className="ea-exam-muted">{t.noQuestions}</div> : (
              <div className="ea-review-list">
                {filteredReview.map((item) => {
                  const index = review.findIndex((q) => q.question_id === item.question_id);
                  const isCorrect = item.is_correct;
                  const isAnswered = item.selected_option !== null;
                  const statusClass = isCorrect ? "is-correct" : isAnswered ? "is-incorrect" : "is-unanswered";
                  const statusLabel = isCorrect ? t.correct : isAnswered ? t.incorrect : t.unanswered;
                  const questionText = language === "hi" ? item.question_text_hi || item.question_text : item.question_text;
                  const optionText = language === "hi" ? item.options_hi || item.options : item.options;
                  return (
                    <details key={item.question_id} className="ea-review-item" open={review.length <= 8}>
                      <summary>
                        <span className={"ea-review-index " + statusClass}>{index + 1}</span>
                        <span className="ea-review-question">{questionText}</span>
                        <span className={"ea-review-status " + statusClass}>{statusLabel} · {Number(item.awarded_marks).toFixed(2)}</span>
                      </summary>
                      <div className="ea-review-detail">
                        {optionKeys.map((key) => (
                          <div key={key} className={"ea-review-option" + (item.selected_option === key ? " is-selected" : "") + (item.correct_option === key ? " is-correct" : "")}>
                            <strong>{key}.</strong> {optionText?.[key] || ""}
                            {item.selected_option === key ? " · " + t.yourAnswer : ""}
                            {item.correct_option === key ? " · " + t.correctAnswer : ""}
                          </div>
                        ))}
                        <div className="ea-report-breakdown" style={{ marginTop: 12 }}>
                          <div className="ea-report-breakdown-item">{t.yourAnswer}<strong>{item.selected_option || t.notAnswered}</strong></div>
                          <div className="ea-report-breakdown-item">{t.correctAnswer}<strong>{item.correct_option}</strong></div>
                          <div className="ea-report-breakdown-item">{t.marksAwarded}<strong>{Number(item.awarded_marks).toFixed(2)}</strong></div>
                        </div>
                        <div className="ea-review-explanation"><strong>{t.explanation}: </strong>{language === "hi" ? item.explanation_hi || item.explanation || t.noExplanation : item.explanation || t.noExplanation}</div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          <div className="ea-report-actions">
            <a className="ea-exam-primary" href="/mock-tests" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{t.return}</a>
            <a className="ea-exam-secondary" href={"/mock-tests/" + testId} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{t.retake}</a>
          </div>
        </div>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="ea-exam-page">
        <style>{style}</style>
        <StudentNavigation />
        <div className="ea-exam-container">
          <a className="ea-exam-back" href="/mock-tests">← {t.back}</a>
          <section className="ea-exam-card ea-exam-instructions">
            {switchLanguage()}
            <div className="ea-exam-kicker" style={{ marginTop: 24 }}>EDUAXIS INDIA · EXAMINATION MODE</div>
            <h1 className="ea-exam-h1">{t.instructions}</h1>
            <h2 style={{ fontSize: 23, color: "#28445d", marginTop: 15 }}>{exam ? (language === "hi" ? exam.test_title_hi || exam.test_title : exam.test_title) : t.start}</h2>
            {exam?.instructions && <p className="ea-exam-muted">{language === "hi" ? exam.instructions_hi || exam.instructions : exam.instructions}</p>}
            <div className="ea-exam-summary-grid">
              <div className="ea-exam-summary-cell"><strong>{exam?.questions.length || "—"}</strong><span>Questions</span></div>
              <div className="ea-exam-summary-cell"><strong>{exam?.duration_minutes || "—"}</strong><span>{t.duration} (min)</span></div>
              <div className="ea-exam-summary-cell"><strong>{exam ? Number(exam.total_marks).toFixed(0) : "—"}</strong><span>{t.totalMarks}</span></div>
            </div>
            <ul className="ea-exam-instruction-list">
              <li>All questions are multiple-choice questions with four options.</li>
              <li>Select one option. Your answers are saved automatically as you work.</li>
              <li>Move between questions using the question palette.</li>
              <li>Use Mark for Review to flag a question and return to it later.</li>
              <li>The countdown follows the server-side deadline and continues if you refresh.</li>
              <li>After submission, your score and question-wise answer analysis will be available.</li>
            </ul>
            {error && <div className="ea-exam-error" role="alert">{error}</div>}
            <button type="button" className="ea-exam-primary" onClick={startExam} disabled={loading}>{loading ? t.starting : t.start}</button>
          </section>
        </div>
      </main>
    );
  }

  if (!exam || !currentQuestion) {
    return <main className="ea-exam-page"><style>{style}</style><div className="ea-exam-container">Loading examination…</div></main>;
  }

  const progressPercent = exam.questions.length > 0 ? answeredCount / exam.questions.length * 100 : 0;
  const questionText = language === "hi" ? currentQuestion.question_text_hi || currentQuestion.question_text : currentQuestion.question_text;
  const questionOptions = language === "hi" ? currentQuestion.options_hi || currentQuestion.options : currentQuestion.options;
  const currentIsMarked = marked.includes(currentQuestion.id);

  return (
    <main className="ea-exam-page">
      <style>{style}</style>
      <header className="ea-exam-brandbar">
        <div className="ea-exam-brand">EduAxis <span>India</span></div>
        <div className="ea-exam-mode">SECURE EXAMINATION MODE</div>
      </header>

      <div className="ea-exam-sticky">
        <div className="ea-exam-sticky-inner">
          <div>
            <div className="ea-exam-title">{language === "hi" ? exam.test_title_hi || exam.test_title : exam.test_title}</div>
            <div className="ea-exam-subtitle">{t.answered}: {answeredCount} / {exam.questions.length} · {t.remaining}: {unansweredCount}</div>
          </div>
          <div className={"ea-exam-timer " + (secondsLeft <= 300 ? "is-low" : "")}>
            <span className="ea-exam-timer-label">Time remaining</span>
            <span className="ea-exam-timer-value">{formatTime(secondsLeft)}</span>
          </div>
          <div className={"ea-exam-save-state " + (saveError ? "is-error" : "")} role="status">{savingQuestionIds.length > 0 && "● "}{saveStatus}</div>
        </div>
        <div className="ea-exam-progress"><span style={{ width: progressPercent + "%" }} /></div>
      </div>

      <div className="ea-exam-language-row" style={{ maxWidth: 1440, margin: "15px auto 0", padding: "0 24px" }}>
        {switchLanguage()}
        <span className="ea-exam-muted" style={{ fontSize: 12 }}>{t.saveNotice}</span>
      </div>

      <div className="ea-exam-workspace">
        <section className="ea-exam-card ea-exam-question-panel">
          <div className="ea-exam-question-meta">
            <span className="ea-exam-question-number">{t.question} {current + 1} {t.of} {exam.questions.length}</span>
            <span className="ea-exam-mark-value">{Number(currentQuestion.marks).toFixed(2)} marks</span>
          </div>
          <h1 className="ea-exam-question-text">{questionText}</h1>
          <div role="radiogroup" aria-label={"Question " + (current + 1) + " answers"}>
            {optionKeys.map((option) => (
              <label key={option} className={"ea-exam-option " + (answers[currentQuestion.id] === option ? "is-selected" : "")}>
                <input className="ea-exam-radio" type="radio" name={currentQuestion.id} value={option}
                  checked={answers[currentQuestion.id] === option}
                  disabled={submitting || secondsLeft <= 0}
                  onChange={() => selectAnswer(currentQuestion.id, option)} />
                <span className="ea-exam-option-letter">{option}.</span>
                <span className="ea-exam-option-text">{questionOptions?.[option] || ""}</span>
              </label>
            ))}
          </div>

          <div className="ea-exam-question-actions">
            <div className="ea-exam-action-left">
              <button type="button" className="ea-exam-secondary" onClick={clearResponse} disabled={!answers[currentQuestion.id] || submitting}>{t.clear}</button>
              <button type="button" className={"ea-exam-soft ea-exam-review-mark " + (currentIsMarked ? "is-marked" : "")} onClick={markForReviewAndNext} disabled={submitting}>
                {currentIsMarked ? t.unmark : t.mark}
              </button>
            </div>
            <div className="ea-exam-action-right">
              <button type="button" className="ea-exam-secondary" onClick={() => goToQuestion(current - 1)} disabled={current === 0 || submitting}>{t.previous}</button>
              <button type="button" className="ea-exam-primary" onClick={saveAndNext} disabled={current === exam.questions.length - 1 || submitting}>{t.saveNext}</button>
            </div>
          </div>
          {error && <div className="ea-exam-error" role="alert">{error}</div>}
        </section>

        <aside className="ea-exam-card ea-exam-sidebar">
          <div className="ea-exam-palette-heading"><h2 className="ea-exam-palette-title">{t.navigator}</h2><span className="ea-exam-palette-count">{current + 1} / {exam.questions.length}</span></div>
          <div className="ea-exam-legend">
            <div className="ea-exam-legend-item"><i className="ea-exam-dot answered" />{t.answered}</div>
            <div className="ea-exam-legend-item"><i className="ea-exam-dot marked" />{t.marked}</div>
            <div className="ea-exam-legend-item"><i className="ea-exam-dot visited" />{t.visited}</div>
            <div className="ea-exam-legend-item"><i className="ea-exam-dot notvisited" />{t.notVisited}</div>
          </div>
          <div className="ea-exam-palette" aria-label="Question navigation">
            {exam.questions.map((question, index) => {
              const isAnswered = Boolean(answers[question.id]);
              const isMarked = marked.includes(question.id);
              const isVisited = visited.includes(question.id);
              const statusClass = isAnswered && isMarked ? "is-answered-marked" : isMarked ? "is-marked" : isAnswered ? "is-answered" : isVisited ? "is-visited" : "";
              return (
                <button key={question.id} type="button" className={"ea-exam-palette-btn " + statusClass + (current === index ? " is-current" : "")}
                  onClick={() => goToQuestion(index)}
                  aria-label={"Question " + (index + 1) + (isAnswered ? ", answered" : ", unanswered") + (isMarked ? ", marked for review" : "")}
                  aria-current={current === index ? "step" : undefined}>
                  {index + 1}{isAnswered && isMarked && <i className="ea-exam-review-dot" />}
                </button>
              );
            })}
          </div>
          <div className="ea-exam-sidebar-summary">
            <div className="ea-exam-mini-stat"><strong>{answeredCount}</strong><span>{t.answered}</span></div>
            <div className="ea-exam-mini-stat"><strong>{unansweredCount}</strong><span>{t.remaining}</span></div>
            <div className="ea-exam-mini-stat"><strong>{marked.length}</strong><span>{t.marked}</span></div>
            <div className="ea-exam-mini-stat"><strong>{visited.length}</strong><span>{t.visited}</span></div>
          </div>
          <button type="button" className="ea-exam-danger ea-exam-submit-button" onClick={() => submitExam(false)} disabled={submitting}>{submitting ? "Submitting…" : t.submit}</button>
          <div className="ea-exam-save-note">{t.saveNotice}</div>
          {saveError && <div className="ea-exam-error" role="alert">{t.saveError}</div>}
        </aside>
      </div>

      {showSubmitDialog && (
        <div className="ea-exam-overlay" role="presentation">
          <section className="ea-exam-dialog" role="dialog" aria-modal="true" aria-labelledby="ea-submit-title">
            <div className="ea-exam-kicker">{t.submitSummary}</div>
            <h2 id="ea-submit-title">{t.submitTitle}</h2>
            <p className="ea-exam-muted">{t.submitBody}</p>
            <div className="ea-exam-summary-grid">
              <div className="ea-exam-summary-cell"><strong>{answeredCount}</strong><span>{t.savedAnswers}</span></div>
              <div className="ea-exam-summary-cell"><strong>{unansweredCount}</strong><span>{t.unansweredCount}</span></div>
              <div className="ea-exam-summary-cell"><strong>{marked.length}</strong><span>{t.marked}</span></div>
            </div>
            <div className="ea-exam-dialog-actions">
              {unansweredCount > 0 && <button type="button" className="ea-exam-soft" onClick={() => {
                const firstUnanswered = exam.questions.findIndex((question) => !answers[question.id]);
                setShowSubmitDialog(false);
                if (firstUnanswered >= 0) goToQuestion(firstUnanswered);
              }}>{t.reviewUnanswered}</button>}
              <button type="button" className="ea-exam-secondary" onClick={() => setShowSubmitDialog(false)}>{t.cancel}</button>
              <button type="button" className="ea-exam-danger" onClick={() => void submitExam(true)} disabled={submitting}>{submitting ? "Submitting…" : t.confirmSubmit}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
