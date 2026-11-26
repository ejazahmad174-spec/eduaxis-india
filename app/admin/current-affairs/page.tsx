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
  summary: string | null;
  category: string | null;
  source_name: string | null;
  source_url: string;
  original_published_at: string | null;
  fetched_at: string;
  status: ItemStatus;
  approved_at: string | null;
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

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const [itemResult, sourceResult] = await Promise.all([
      supabase
        .from("current_affairs_items")
        .select("id,title,summary,category,source_name,source_url,original_published_at,fetched_at,status,approved_at")
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

  async function changeItemStatus(item: CurrentAffairsItem, status: ItemStatus) {
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
      .select("id,title,summary,category,source_name,source_url,original_published_at,fetched_at,status,approved_at")
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
                    <h3>{item.title}</h3>
                    {item.summary && <p className={styles.summary}>{item.summary}</p>}
                    <div className={styles.meta}>
                      <span>{item.source_name || "Source not named"}</span>
                      <span>Fetched: {formatDate(item.fetched_at)}</span>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer">Open source ↗</a>
                    </div>
                    <div className={styles.actions}>
                      {item.status !== "published" && (
                        <button className={styles.publishButton} onClick={() => changeItemStatus(item, "published")} disabled={!!busy}>
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
