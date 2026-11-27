"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import "../admin.css";
import styles from "./current-affairs.module.css";

type ItemStatus = "pending" | "published" | "rejected";

type CurrentAffairsItem = {
  id: string;
  title: string;
  title_hi: string | null;
  summary: string | null;
  summary_hi: string | null;
  source_excerpt: string | null;
  key_facts: string[] | null;
  exam_relevance: string | null;
  editorial_note: string | null;
  ai_generation_status: "not_generated" | "generated" | "manual" | "edited" | "needs_review";
  ai_model: string | null;
  ai_generated_at: string | null;
  category: string | null;
  source_name: string | null;
  source_url: string;
  original_published_at: string | null;
  fetched_at: string;
  status: ItemStatus;
  approved_at: string | null;
};

type EditorialDraft = {
  headlineEn: string;
  headlineHi: string;
  summaryEn: string;
  summaryHi: string;
  keyFactsText: string;
  examRelevance: string;
  editorialNote: string;
  aiModel: string;
  aiGenerated: boolean;
  needsManualVerification: boolean;
  verifiedByAdmin: boolean;
};

type CurrentAffairsSource = {
  id: string;
  source_name: string;
  source_url: string;
  is_active: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function labelCategory(value: string | null) {
  if (value === "education") return "Education & Exams";
  if (value === "international") return "International";
  if (value === "bihar") return "Bihar Special";
  return "National Affairs";
}

function readableExcerpt(value: string | null) {
  return (value || "")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&ensp;|&emsp;|&thinsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminCurrentAffairsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CurrentAffairsItem[]>([]);
  const [sources, setSources] = useState<CurrentAffairsSource[]>([]);
  const [filter, setFilter] = useState<"all" | ItemStatus>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [draft, setDraft] = useState<EditorialDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editorError, setEditorError] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const [itemResult, sourceResult] = await Promise.all([
      supabase
        .from("current_affairs_items")
        .select("id,title,title_hi,summary,summary_hi,source_excerpt,key_facts,exam_relevance,editorial_note,ai_generation_status,ai_model,ai_generated_at,category,source_name,source_url,original_published_at,fetched_at,status,approved_at")
        .order("fetched_at", { ascending: false })
        .limit(150),
      supabase
        .from("current_affairs_sources")
        .select("id,source_name,source_url,is_active,last_checked_at,last_success_at,last_error")
        .order("source_name", { ascending: true }),
    ]);

    if (itemResult.error || sourceResult.error) {
      setError("Could not load the Current Affairs queue. Check administrator permissions.");
      setLoading(false);
      return;
    }

    setItems((itemResult.data || []) as CurrentAffairsItem[]);
    setSources((sourceResult.data || []) as CurrentAffairsSource[]);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function verifyAndLoad() {
      if (!supabase) {
        router.replace("/admin/login");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace("/admin/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError || profile?.role !== "admin") {
        router.replace("/student/dashboard");
        return;
      }

      if (active) await loadData();
    }

    verifyAndLoad();
    return () => { active = false; };
  }, [router, loadData]);

  const counts = useMemo(() => ({
    pending: items.filter((item) => item.status === "pending").length,
    published: items.filter((item) => item.status === "published").length,
    rejected: items.filter((item) => item.status === "rejected").length,
  }), [items]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!term) return true;
      return [item.title, item.summary, item.source_name, item.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, filter, search]);

  function openEditor(item: CurrentAffairsItem) {
    setEditingItemId(item.id);
    setDraft({
      headlineEn: item.title || "",
      headlineHi: item.title_hi || "",
      summaryEn: ["generated", "edited", "manual", "needs_review"].includes(item.ai_generation_status) ? item.summary || "" : "",
      summaryHi: ["generated", "edited", "manual", "needs_review"].includes(item.ai_generation_status) ? item.summary_hi || "" : "",
      keyFactsText: (item.key_facts || []).join("\n"),
      examRelevance: item.exam_relevance || "",
      editorialNote: item.editorial_note || "",
      aiModel: item.ai_model || "",
      aiGenerated: ["generated", "edited", "needs_review"].includes(item.ai_generation_status),
      needsManualVerification: item.ai_generation_status === "needs_review",
      verifiedByAdmin: item.ai_generation_status === "manual" || item.ai_generation_status === "edited",
    });
    setEditorError("");
    setMessage("");
    document.getElementById("current-affairs-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function generateSummary() {
    if (!supabase || !editingItemId || generating) return;

    setGenerating(true);
    setEditorError("");
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("Your admin session has expired. Please sign in again.");

      const response = await fetch("/api/admin/current-affairs/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ id: editingItemId }),
        cache: "no-store",
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.code === "AI_KEY_MISSING") {
          throw new Error("AI is not connected yet. Add OPENAI_API_KEY to the Vercel Production environment. You can still write and save the summary manually.");
        }
        throw new Error(result.error || "Could not generate the summary.");
      }

      const generated = result.draft;
      setDraft((current) => current ? {
        ...current,
        headlineEn: generated.headline_en,
        headlineHi: generated.headline_hi,
        summaryEn: generated.summary_en,
        summaryHi: generated.summary_hi,
        keyFactsText: (generated.key_facts || []).join("\n"),
        examRelevance: generated.exam_relevance,
        editorialNote: generated.editorial_note,
        aiModel: result.model || "",
        aiGenerated: true,
        needsManualVerification: !!generated.needs_manual_verification || !generated.suitable_for_publication,
        verifiedByAdmin: false,
      } : current);
      setMessage(
        generated.needs_manual_verification || !generated.suitable_for_publication
          ? "AI created a draft but flagged this source for manual verification. Check the original before saving for publication."
          : "AI draft generated. Review every fact and edit it before saving."
      );
    } catch (generationError) {
      setEditorError(generationError instanceof Error ? generationError.message : "Could not generate the summary.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEditorialDraft() {
    if (!supabase || !editingItemId || !draft || savingDraft) return;

    const facts = draft.keyFactsText.split("\n").map((fact) => fact.trim()).filter(Boolean);
    const englishSentences = draft.summaryEn.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
    const hindiSentences = draft.summaryHi.split(/[.!?।]+/).filter((sentence) => sentence.trim().length > 0);
    const englishWords = draft.summaryEn.trim().split(/\s+/).filter(Boolean).length;

    if (!draft.headlineEn.trim() || !draft.headlineHi.trim()) {
      setEditorError("Enter both English and Hindi headlines.");
      return;
    }
    if (englishSentences.length < 4 || englishSentences.length > 5 || hindiSentences.length < 4 || hindiSentences.length > 5) {
      setEditorError("Both English and Hindi summaries must contain 4–5 sentences.");
      return;
    }
    if (englishWords < 40 || englishWords > 100) {
      setEditorError("Keep the English summary between 40 and 100 words (target: 50–80).");
      return;
    }
    if (facts.length < 3 || facts.length > 5) {
      setEditorError("Add 3–5 key facts, one per line.");
      return;
    }
    if (!draft.examRelevance.trim()) {
      setEditorError("Add exam relevance, or write 'General awareness; limited direct exam relevance'.");
      return;
    }
    if (!draft.verifiedByAdmin) {
      setEditorError("Open the original source, verify the headline, dates, figures and summary, then tick the verification confirmation before saving.");
      return;
    }

    setSavingDraft(true);
    setEditorError("");
    setError("");

    const generationStatus = draft.aiGenerated
      ? (draft.verifiedByAdmin ? "edited" : "generated")
      : "manual";

    const { data, error: saveError } = await supabase
      .from("current_affairs_items")
      .update({
        title: draft.headlineEn.trim(),
        title_hi: draft.headlineHi.trim(),
        summary: draft.summaryEn.trim(),
        summary_hi: draft.summaryHi.trim(),
        key_facts: facts,
        exam_relevance: draft.examRelevance.trim(),
        editorial_note: draft.editorialNote.trim() || null,
        ai_generation_status: generationStatus,
        ai_model: draft.aiGenerated ? draft.aiModel || null : null,
        ai_generated_at: draft.aiGenerated ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingItemId)
      .select("id,title,title_hi,summary,summary_hi,source_excerpt,key_facts,exam_relevance,editorial_note,ai_generation_status,ai_model,ai_generated_at,category,source_name,source_url,original_published_at,fetched_at,status,approved_at")
      .single();

    if (saveError) {
      setEditorError("Could not save the editorial draft: " + saveError.message);
    } else {
      const updated = data as CurrentAffairsItem;
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setDraft({
        headlineEn: updated.title,
        headlineHi: updated.title_hi || "",
        summaryEn: updated.summary || "",
        summaryHi: updated.summary_hi || "",
        keyFactsText: (updated.key_facts || []).join("\n"),
        examRelevance: updated.exam_relevance || "",
        editorialNote: updated.editorial_note || "",
        aiModel: updated.ai_model || "",
        aiGenerated: ["generated", "edited", "needs_review"].includes(updated.ai_generation_status),
        needsManualVerification: updated.ai_generation_status === "needs_review",
        verifiedByAdmin: updated.ai_generation_status === "manual" || updated.ai_generation_status === "edited",
      });
      setMessage("Editorial draft saved. It is still pending and has not been published.");
    }

    setSavingDraft(false);
  }

  async function changeItemStatus(item: CurrentAffairsItem, status: ItemStatus) {
    if (!supabase || busy) return;

    if (status === "published") {
      const sentenceCount = (item.summary || "").split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0).length;
      if (
        !item.summary?.trim() ||
        !item.summary_hi?.trim() ||
        !Array.isArray(item.key_facts) ||
        item.key_facts.length < 3 ||
        !item.exam_relevance?.trim() ||
        item.ai_generation_status === "needs_review" ||
        sentenceCount < 4 ||
        sentenceCount > 5
      ) {
        openEditor(item);
        setMessage("Prepare and save the bilingual 4–5 sentence summary and key facts before publishing.");
        return;
      }
    }

    const action = status === "published" ? "publish" : status === "rejected" ? "reject" : "return to pending";
    if (!window.confirm("Are you sure you want to " + action + " this update?")) return;

    setBusy(item.id);
    setMessage("");
    setError("");

    const now = new Date().toISOString();
    const { data, error: updateError } = await supabase
      .from("current_affairs_items")
      .update({
        status,
        approved_at: status === "published" ? now : null,
        updated_at: now,
      })
      .eq("id", item.id)
      .select("id,title,title_hi,summary,summary_hi,source_excerpt,key_facts,exam_relevance,editorial_note,ai_generation_status,ai_model,ai_generated_at,category,source_name,source_url,original_published_at,fetched_at,status,approved_at")
      .single();

    if (updateError) {
      setError("Could not update this item: " + updateError.message);
    } else {
      setItems((current) => current.map((entry) => entry.id === item.id ? data as CurrentAffairsItem : entry));
      setMessage(status === "published" ? "Update published on the public Current Affairs page." : status === "rejected" ? "Update rejected and hidden from the public page." : "Update returned to the review queue.");
    }

    setBusy("");
  }
    if (!supabase || busy) return;

    const action = status === "published" ? "publish" : status === "rejected" ? "reject" : "return to pending";
    if (!window.confirm("Are you sure you want to " + action + " this update?")) return;

    setBusy(item.id);
    setMessage("");
    setError("");

    const now = new Date().toISOString();
    const { data, error: updateError } = await supabase
      .from("current_affairs_items")
      .update({
        status,
        approved_at: status === "published" ? now : null,
        updated_at: now,
      })
      .eq("id", item.id)
      .select("id,title,title_hi,summary,summary_hi,source_excerpt,key_facts,exam_relevance,editorial_note,ai_generation_status,ai_model,ai_generated_at,category,source_name,source_url,original_published_at,fetched_at,status,approved_at")
      .single();

    if (updateError) {
      setError("Could not update this item: " + updateError.message);
    } else {
      setItems((current) => current.map((entry) => entry.id === item.id ? data as CurrentAffairsItem : entry));
      setMessage(status === "published" ? "Update published on the public Current Affairs page." : status === "rejected" ? "Update rejected and hidden from the public page." : "Update returned to the review queue.");
    }

    setBusy("");
  }

  async function toggleSource(source: CurrentAffairsSource) {
    if (!supabase || busy) return;

    setBusy(source.id);
    setMessage("");
    setError("");

    const { data, error: updateError } = await supabase
      .from("current_affairs_sources")
      .update({ is_active: !source.is_active, updated_at: new Date().toISOString() })
      .eq("id", source.id)
      .select("id,source_name,source_url,is_active,last_checked_at,last_success_at,last_error")
      .single();

    if (updateError) {
      setError("Could not update source: " + updateError.message);
    } else {
      setSources((current) => current.map((entry) => entry.id === source.id ? data as CurrentAffairsSource : entry));
      setMessage(source.source_name + (data.is_active ? " is now active." : " has been paused."));
    }

    setBusy("");
  }

  async function runCollection() {
    if (!supabase || collecting) return;

    setCollecting(true);
    setMessage("");
    setError("");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Your admin session has expired. Please sign in again.");
      }

      const response = await fetch("/api/admin/current-affairs/collect", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store",
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Collection could not be started.");

      const failed = (result.results || []).filter((entry: { success: boolean }) => !entry.success).length;
      setMessage(
        "Collection finished: " + result.checked + " sources checked, " +
        result.inserted + " new updates added to the review queue" +
        (failed ? ", " + failed + " source(s) need attention." : ".")
      );

      await loadData();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not run collection.");
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <section className="admin-main">
        <main className={styles.main}>
          <header className={styles.header}>
            <div>
              <div className={styles.kicker}>CONTENT MANAGEMENT / CURRENT AFFAIRS</div>
              <h1>Current Affairs Management</h1>
              <p>Collect updates from approved sources, review the headlines and publish only verified items.</p>
            </div>
            <button className={styles.primaryButton} onClick={runCollection} disabled={collecting}>
              {collecting ? "Collecting updates..." : "↻ Run collection now"}
            </button>
          </header>

          {message && <div className={styles.notice}>{message}</div>}
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.stats}>
            <div><strong>{counts.pending}</strong><span>Pending review</span></div>
            <div><strong>{counts.published}</strong><span>Published</span></div>
            <div><strong>{counts.rejected}</strong><span>Rejected</span></div>
            <div><strong>{sources.filter((source) => source.is_active).length}/{sources.length}</strong><span>Active sources</span></div>
          </div>

          {editingItemId && draft && (
            <section className={styles.editorPanel} id="current-affairs-editor">
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.kicker}>EDITORIAL DESK</div>
                  <h2>Prepare Current Affairs Article</h2>
                  <p>Generate a short draft, check it against the original source, edit it and save before publishing.</p>
                </div>
                <button className={styles.secondaryButton} onClick={() => { setEditingItemId(""); setDraft(null); setEditorError(""); }}>
                  Close editor
                </button>
              </div>

              {editorError && <div className={styles.error}>{editorError}</div>}

              <div className={styles.editorToolbar}>
                <button className={styles.primaryButton} onClick={generateSummary} disabled={generating || savingDraft}>
                  {generating ? "Generating bilingual draft..." : "✦ Generate AI summary"}
                </button>
                <span className={styles.editorHint}>
                  Target: 4–5 sentences · 50–80 English words · 3–5 key facts
                </span>
              </div>

              <div className={styles.editorGrid}>
                <label className={styles.editorField}>
                  <span>Headline (English)</span>
                  <input value={draft.headlineEn} onChange={(event) => setDraft({ ...draft, headlineEn: event.target.value })} />
                </label>
                <label className={styles.editorField}>
                  <span>Headline (Hindi)</span>
                  <input value={draft.headlineHi} onChange={(event) => setDraft({ ...draft, headlineHi: event.target.value })} />
                </label>
                <label className={styles.editorField}>
                  <span>Short summary (English)</span>
                  <textarea rows={5} value={draft.summaryEn} onChange={(event) => setDraft({ ...draft, summaryEn: event.target.value })} placeholder="Write 4–5 sentences (50–80 words)." />
                  <small>{draft.summaryEn.trim() ? draft.summaryEn.trim().split(/\s+/).filter(Boolean).length : 0} words</small>
                </label>
                <label className={styles.editorField}>
                  <span>संक्षिप्त सारांश (हिंदी)</span>
                  <textarea rows={5} value={draft.summaryHi} onChange={(event) => setDraft({ ...draft, summaryHi: event.target.value })} placeholder="4–5 वाक्यों में संक्षिप्त सारांश लिखें।" />
                </label>
                <label className={styles.editorField}>
                  <span>Key facts (3–5, one per line)</span>
                  <textarea rows={5} value={draft.keyFactsText} onChange={(event) => setDraft({ ...draft, keyFactsText: event.target.value })} placeholder={"Initiative: ...\nMinistry: ...\nDate: ..."} />
                </label>
                <label className={styles.editorField}>
                  <span>Exam relevance</span>
                  <textarea rows={3} value={draft.examRelevance} onChange={(event) => setDraft({ ...draft, examRelevance: event.target.value })} placeholder="e.g. UPSC GS-II, BPSC General Studies, UGC NET Paper I..." />
                </label>
              </div>

              {draft.editorialNote && (
                <div className={draft.needsManualVerification ? styles.editorWarning : styles.editorHintBox}>
                  <strong>{draft.needsManualVerification ? "Manual verification required" : "Editorial note"}</strong>
                  <p>{draft.editorialNote}</p>
                </div>
              )}

              {draft.aiGenerated && (
                <div className={styles.modelNote}>AI draft generated using {draft.aiModel || "configured model"}. AI output can contain errors; verify the source before publishing.</div>
              )}

              <label className={styles.verifyCheck}>
                <input
                  type="checkbox"
                  checked={draft.verifiedByAdmin}
                  onChange={(event) => setDraft({ ...draft, verifiedByAdmin: event.target.checked })}
                />
                <span>I have checked the original source and verified the headline, dates, figures, summary and key facts.</span>
              </label>

              <div className={styles.actions}>
                <button className={styles.publishButton} onClick={saveEditorialDraft} disabled={savingDraft || generating}>
                  {savingDraft ? "Saving..." : "Save editorial draft"}
                </button>
                <button className={styles.secondaryButton} onClick={() => { setEditingItemId(""); setDraft(null); setEditorError(""); }}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Collected updates</h2>
                <p>Newly fetched items remain pending until an administrator publishes them.</p>
              </div>
              <button className={styles.secondaryButton} onClick={loadData} disabled={loading || !!busy}>Refresh</button>
            </div>

            <div className={styles.filters}>
              <div className={styles.tabs}>
                {(["pending", "published", "rejected", "all"] as const).map((status) => (
                  <button
                    key={status}
                    className={filter === status ? styles.tabActive : styles.tab}
                    onClick={() => setFilter(status)}
                  >
                    {status === "all" ? "All" : status[0].toUpperCase() + status.slice(1)}
                    {status !== "all" ? " (" + counts[status] + ")" : ""}
                  </button>
                ))}
              </div>
              <input
                className={styles.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title or source..."
                type="search"
              />
            </div>

            {loading ? (
              <div className={styles.empty}>Loading Current Affairs records...</div>
            ) : visibleItems.length === 0 ? (
              <div className={styles.empty}>No records match this view. Run collection or change the filter.</div>
            ) : (
              <div className={styles.itemList}>
                {visibleItems.map((item) => (
                  <article className={styles.item} key={item.id}>
                    <div className={styles.itemTop}>
                      <span className={styles.category}>{labelCategory(item.category)}</span>
                      <span className={styles.status + " " + styles[item.status]}>{item.status}</span>
                    </div>
                    <div className={styles.headlineRow}>
                      <h3>{item.title}</h3>
                      <span className={styles.aiStatus}>
                        {item.ai_generation_status === "needs_review"
                          ? "Needs verification"
                          : ["generated", "edited", "manual"].includes(item.ai_generation_status)
                            ? "Summary ready"
                            : "Not summarised"}
                      </span>
                    </div>
                    {item.summary ? (
                      <p className={styles.summary}>{item.summary}</p>
                    ) : (
                      <p className={styles.summary}>
                        Original source text: {readableExcerpt(item.source_excerpt || item.summary || "No description was provided by the source.").slice(0, 220)}
                        {readableExcerpt(item.source_excerpt || item.summary || "").length > 220 ? "…" : ""}
                      </p>
                    )}
                    <div className={styles.meta}>
                      <span>{item.source_name || "Source not named"}</span>
                      <span>Fetched: {formatDate(item.fetched_at)}</span>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer">Open source ↗</a>
                    </div>
                    {item.source_excerpt && (
                      <details className={styles.sourceDetails}>
                        <summary>View original fetched text</summary>
                        <p>{readableExcerpt(item.source_excerpt || item.summary).slice(0, 6000)}</p>
                      </details>
                    )}
                    <div className={styles.actions}>
                      {item.status !== "published" && (
                        <button className={styles.secondaryButton} onClick={() => openEditor(item)} disabled={!!busy}>
                          {item.summary ? "Edit summary" : "Prepare short summary"}
                        </button>
                      )}
                      {item.status !== "published" && (
                        <button className={styles.publishButton} onClick={() => changeItemStatus(item, "published")} disabled={!!busy || !item.summary || !item.summary_hi || (item.key_facts || []).length < 3}>
                          Publish
                        </button>
                      )}
                      {item.status !== "rejected" && (
                        <button className={styles.rejectButton} onClick={() => changeItemStatus(item, "rejected")} disabled={!!busy}>
                          Reject
                        </button>
                      )}
                      {item.status !== "pending" && (
                        <button className={styles.secondaryButton} onClick={() => changeItemStatus(item, "pending")} disabled={!!busy}>
                          Return to pending
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Automatic news sources</h2>
                <p>Only enabled, allow-listed sources are checked by the daily collector.</p>
              </div>
              <span className={styles.schedule}>Daily · 6:00 AM IST target</span>
            </div>

            <div className={styles.sourceList}>
              {sources.map((source) => (
                <article className={styles.source} key={source.id}>
                  <div className={styles.sourceInfo}>
                    <strong>{source.source_name}</strong>
                    <a href={source.source_url} target="_blank" rel="noopener noreferrer">{source.source_url}</a>
                    <small>
                      Last checked: {formatDate(source.last_checked_at)} · Last success: {formatDate(source.last_success_at)}
                    </small>
                    {source.last_error && <small className={styles.sourceError}>Last error: {source.last_error}</small>}
                  </div>
                  <button
                    className={source.is_active ? styles.pauseButton : styles.enableButton}
                    onClick={() => toggleSource(source)}
                    disabled={!!busy}
                  >
                    {source.is_active ? "Pause" : "Enable"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}
