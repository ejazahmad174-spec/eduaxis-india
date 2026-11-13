
"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type Test = {
  id: string;
  title: string;
  exam_category: string;
  duration_minutes: number;
  total_marks: number;
  access_type: string;
  status: string;
};

export default function AdminMockTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("Bihar SLET 2026 - Library Science - Mock Test 1");
  const [duration, setDuration] = useState("100");
  const [totalMarks, setTotalMarks] = useState("100");
  const [negative, setNegative] = useState("0");
  const [passMarks, setPassMarks] = useState("");
  const [instructions, setInstructions] = useState("Choose the most appropriate answer. Each question has four options.");
  const [questions, setQuestions] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadTests() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("mock_tests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else {
      setTests(data || []);
      if (data?.length && !selected) setSelected(data[0].id);
    }
    setLoading(false);
  }

  async function checkAdmin() {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      window.location.href = "/admin/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role !== "admin") {
      window.location.href = "/student/dashboard";
      return;
    }

    await loadTests();
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    async function loadQuestions() {
      if (!supabase || !selected) {
        setQuestions([]);
        return;
      }

      const { data, error } = await supabase
        .from("mock_test_questions")
        .select("*")
        .eq("mock_test_id", selected)
        .order("sort_order");

      if (error) setMessage(error.message);
      else setQuestions(data || []);
    }

    loadQuestions();
  }, [selected]);

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setMessage("");

    const { data: auth } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("mock_tests")
      .insert({
        title: title.trim(),
        exam_category: "SLET - Library Science",
        duration_minutes: Number(duration),
        total_marks: Number(totalMarks),
        access_type: "free",
        price: 0,
        negative_marking: Number(negative),
        pass_marks: passMarks === "" ? null : Number(passMarks),
        instructions,
        status: "draft",
        created_by: auth.user?.id
      })
      .select()
      .single();

    if (error) {
      setMessage("Could not create test: " + error.message);
    } else {
      setTests(current => [data, ...current]);
      setSelected(data.id);
      setMessage("Mock test created successfully. It is saved as Draft.");
    }

    setBusy(false);
  }

  async function readExcel(file: File) {
    setPreview([]);
    setErrors([]);
    setMessage("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) throw new Error("No worksheet found in the Excel file.");

      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      if (!rows.length) throw new Error("No questions found in the Excel file.");

      const required = [
        "Question", "Option A", "Option B", "Option C",
        "Option D", "Correct Option", "Explanation", "Marks"
      ];

      const headers = Object.keys(rows[0]).map(x => x.trim().toLowerCase());
      const missing = required.filter(x => !headers.includes(x.toLowerCase()));

      if (missing.length) {
        throw new Error("Missing column headings: " + missing.join(", "));
      }

      const parsed: any[] = [];
      const problems: string[] = [];
      const seen = new Set<string>();

      rows.forEach((row, index) => {
        const r: any = {};
        Object.entries(row).forEach(([key, value]) => {
          r[key.trim().toLowerCase()] = value;
        });

        const question = String(r.question || "").trim();
        const a = String(r["option a"] || "").trim();
        const b = String(r["option b"] || "").trim();
        const c = String(r["option c"] || "").trim();
        const d = String(r["option d"] || "").trim();
        const correct = String(r["correct option"] || "").trim().toUpperCase();
        const explanation = String(r.explanation || "").trim();
        const marks = r.marks === "" ? 1 : Number(r.marks);
        const rowNumber = index + 2;

        if (!question) problems.push(`Row ${rowNumber}: Question is missing.`);
        if (!a || !b || !c || !d) problems.push(`Row ${rowNumber}: All four options are required.`);
        if (!["A", "B", "C", "D"].includes(correct)) problems.push(`Row ${rowNumber}: Correct Option must be A, B, C or D.`);
        if (!Number.isFinite(marks) || marks <= 0) problems.push(`Row ${rowNumber}: Marks must be positive.`);

        const key = question.toLowerCase();
        if (key && seen.has(key)) problems.push(`Row ${rowNumber}: Duplicate question in this file.`);
        if (key) seen.add(key);

        if (question && a && b && c && d &&
          ["A", "B", "C", "D"].includes(correct) &&
          Number.isFinite(marks) && marks > 0) {
          parsed.push({
            question_text: question,
            options: { A: a, B: b, C: c, D: d },
            correct_option: correct,
            explanation: explanation || null,
            marks,
            sort_order: index + 1
          });
        }
      });

      setErrors(problems);
      setPreview(parsed);

      if (problems.length) setMessage("Please correct the errors in Excel and select the file again.");
      else setMessage(`${parsed.length} questions passed validation. Review before uploading.`);
    } catch (error: any) {
      setMessage(error.message || "Unable to read this Excel file.");
    }
  }

  async function uploadQuestions() {
    if (!supabase || !selected || !preview.length || errors.length) return;

    const test = tests.find(t => t.id === selected);
    if (!test) return;

    const existing = new Set(
      questions.map(q => q.question_text.trim().toLowerCase())
    );

    const fresh = preview.filter(
      q => !existing.has(q.question_text.trim().toLowerCase())
    );

    if (!fresh.length) {
      setMessage("All these questions already exist in this test.");
      return;
    }

    const start = questions.reduce(
      (max, q) => Math.max(max, q.sort_order || 0), 0
    ) + 1;

    setBusy(true);

    const { error } = await supabase
      .from("mock_test_questions")
      .insert(fresh.map((q, i) => ({
        ...q,
        mock_test_id: selected,
        sort_order: start + i
      })));

    if (error) {
      setMessage("Upload failed: " + error.message);
    } else {
      setMessage(`${fresh.length} questions uploaded successfully. ${preview.length - fresh.length} duplicates skipped.`);
      setPreview([]);

      const { data } = await supabase
        .from("mock_test_questions")
        .select("*")
        .eq("mock_test_id", selected)
        .order("sort_order");

      setQuestions(data || []);
    }

    setBusy(false);
  }

  async function changeStatus(test: Test, status: string) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("mock_tests")
      .update({ status })
      .eq("id", test.id)
      .select()
      .single();

    if (error) setMessage(error.message);
    else {
      setTests(current => current.map(t => t.id === test.id ? data : t));
      setMessage(status === "published" ? "Test published." : "Test moved to Draft.");
    }
  }

  async function deleteQuestion(id: string) {
    if (!supabase || !window.confirm("Delete this question?")) return;

    const { error } = await supabase
      .from("mock_test_questions")
      .delete()
      .eq("id", id);

    if (error) setMessage(error.message);
    else {
      setQuestions(current => current.filter(q => q.id !== id));
      setMessage("Question deleted.");
    }
  }

  if (loading) return <main style={{ padding: 30 }}>Loading Mock Test Admin...</main>;

  const selectedTest = tests.find(t => t.id === selected);

  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 24, color: "#172033" }}>
      <style jsx>{`
        .card{background:white;border:1px solid #ddd;border-radius:12px;padding:20px;margin:18px 0}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        label{display:block;font-weight:600;margin-bottom:5px}
        input,textarea,select{width:100%;padding:10px;border:1px solid #bbb;border-radius:7px;margin-bottom:12px}
        button{padding:10px 14px;border:0;border-radius:7px;background:#174ea6;color:white;cursor:pointer;margin:4px}
        button:disabled{opacity:.5}
        .notice{padding:12px;background:#eef5ff;border-radius:8px;margin:12px 0}
        .error{padding:12px;background:#fff0f0;color:#a00;border-radius:8px;margin:12px 0}
        table{width:100%;border-collapse:collapse}
        th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left;vertical-align:top}
        @media(max-width:650px){.grid{grid-template-columns:1fr}}
      `}</style>

      <h1>Mock Test Management</h1>
      <p>Create tests and upload questions in bulk using Excel.</p>
      <p><a href="/admin/dashboard">← Back to Admin Dashboard</a></p>

      {message && <div className="notice">{message}</div>}
      {errors.length > 0 && (
        <div className="error">
          <strong>Excel errors:</strong>
          <ul>{errors.slice(0, 30).map((x, i) => <li key={i}>{x}</li>)}</ul>
          {errors.length > 30 && <p>Only the first 30 errors are shown.</p>}
        </div>
      )}

      <section className="card">
        <h2>Create a New Mock Test</h2>
        <form onSubmit={createTest}>
          <label>Test title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required />

          <div className="grid">
            <div>
              <label>Duration (minutes)</label>
              <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} required />
            </div>
            <div>
              <label>Total marks</label>
              <input type="number" min="1" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} required />
            </div>
            <div>
              <label>Negative marking per wrong answer</label>
              <input type="number" min="0" step="0.01" value={negative} onChange={e => setNegative(e.target.value)} />
            </div>
            <div>
              <label>Pass marks (optional)</label>
              <input type="number" min="0" step="0.01" value={passMarks} onChange={e => setPassMarks(e.target.value)} />
            </div>
          </div>

          <label>Student instructions</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} />

          <p><strong>Examination:</strong> SLET - Library Science | <strong>Access:</strong> Free | <strong>Initial status:</strong> Draft</p>
          <button type="submit" disabled={busy}>{busy ? "Saving..." : "Create Mock Test"}</button>
        </form>
      </section>

      <section className="card">
        <h2>Existing Mock Tests</h2>
        {tests.length === 0 && <p>No tests created yet.</p>}
        {tests.map(test => (
          <div key={test.id} style={{ borderBottom: "1px solid #ddd", padding: "12px 0" }}>
            <strong>{test.title}</strong>
            <p>{test.exam_category} · {test.duration_minutes} minutes · {test.total_marks} marks · {test.status}</p>
            <button onClick={() => setSelected(test.id)}>Manage Questions</button>
            {test.status === "published"
              ? <button onClick={() => changeStatus(test, "draft")}>Unpublish</button>
              : <button onClick={() => changeStatus(test, "published")}>Publish</button>}
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Excel Bulk Question Upload</h2>
        {selectedTest ? (
          <>
            <p><strong>Selected test:</strong> {selectedTest.title}</p>
            <p>Use the EduAxis Excel template. Do not change its column headings.</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) readExcel(file);
                e.currentTarget.value = "";
              }}
            />

            {preview.length > 0 && (
              <>
                <h3>Preview: {preview.length} valid questions</h3>
                <table>
                  <thead><tr><th>#</th><th>Question</th><th>Correct answer</th><th>Marks</th></tr></thead>
                  <tbody>
                    {preview.slice(0, 5).map((q, i) => (
                      <tr key={i}><td>{i + 1}</td><td>{q.question_text}</td><td>{q.correct_option}</td><td>{q.marks}</td></tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={uploadQuestions} disabled={busy || errors.length > 0}>
                  {busy ? "Uploading..." : `Upload ${preview.length} Questions`}
                </button>
                <button onClick={() => { setPreview([]); setErrors([]); }}>Clear Preview</button>
              </>
            )}
          </>
        ) : <p>Create or select a test first.</p>}
      </section>

      <section className="card">
        <h2>Question Bank ({questions.length})</h2>
        {questions.map((q, i) => (
          <div key={q.id} style={{ borderBottom: "1px solid #ddd", padding: 10 }}>
            <strong>{i + 1}. {q.question_text}</strong>
            <p>Correct answer: {q.correct_option} | Marks: {q.marks}</p>
            <button onClick={() => deleteQuestion(q.id)}>Delete question</button>
          </div>
        ))}
        {selected && questions.length === 0 && <p>No questions uploaded yet.</p>}
      </section>
    </main>
  );
}
