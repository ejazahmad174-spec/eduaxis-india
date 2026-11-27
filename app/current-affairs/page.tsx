"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./current-affairs.module.css";

type CurrentAffairsItem = {
  id: string;
  title: string;
  title_hi: string | null;
  summary: string | null;
  summary_hi: string | null;
  key_facts: string[] | null;
  exam_relevance: string | null;
  content: string | null;
  category: string | null;
  source_name: string | null;
  source_url: string;
  original_published_at: string | null;
  approved_at: string | null;
};

const categories = [
  { id: "national", title: "National Affairs", detail: "Government, policies, economy and important decisions", icon: "▤" },
  { id: "international", title: "International Affairs", detail: "World events, diplomacy and global developments", icon: "◎" },
  { id: "education", title: "Education & Exams", detail: "Education policy, boards, universities and examinations", icon: "⌂" },
  { id: "bihar", title: "Bihar Special", detail: "Bihar government, schemes and regional developments", icon: "⌖" },
];

function displayCategory(category: string | null) {
  if (category === "education") return "Education & Exams";
  if (category === "international") return "International Affairs";
  if (category === "bihar") return "Bihar Special";
  return "National Affairs";
}

function categoryMatches(itemCategory: string | null, selected: string) {
  if (selected === "all") return true;
  if (selected === "national") {
    return !itemCategory || ["national", "economy", "polity", "general"].includes(itemCategory);
  }
  return itemCategory === selected;
}

function formatDate(value: string | null) {
  if (!value) return "Recently published";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default function CurrentAffairsPage() {
  const [items, setItems] = useState<CurrentAffairsItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPublishedUpdates() {
      if (!supabase) {
        setError("Current Affairs is temporarily unavailable. Please try again later.");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("current_affairs_items")
        .select("id,title,title_hi,summary,summary_hi,key_facts,exam_relevance,content,category,source_name,source_url,original_published_at,approved_at")
        .eq("status", "published")
        .order("original_published_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (queryError) {
        setError("We could not load the latest updates. Please refresh the page.");
      } else {
        setItems((data || []) as CurrentAffairsItem[]);
      }

      setLoading(false);
    }

    loadPublishedUpdates();

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      national: 0,
      international: 0,
      education: 0,
      bihar: 0,
    };

    items.forEach((item) => {
      if (item.category === "education") result.education += 1;
      else if (item.category === "international") result.international += 1;
      else if (item.category === "bihar") result.bihar += 1;
      else result.national += 1;
    });

    return result;
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      if (!categoryMatches(item.category, selectedCategory)) return false;
      if (!term) return true;

      return [item.title, item.summary, item.content, item.source_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, search, selectedCategory]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.back}>← Back to EduAxis India</Link>

        <header className={styles.header}>
          <div className={styles.kicker}>EduAxis India · Daily Knowledge Update</div>
          <h1>Daily Current Affairs</h1>
          <p>
            Read verified national and international developments, education and examination
            updates, and important news from Bihar. Every update links back to its source.
          </p>
        </header>

        <section className={styles.categoryGrid} aria-label="Current affairs categories">
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={styles.category + (selectedCategory === category.id ? " " + styles.active : "")}
              onClick={() => setSelectedCategory(selectedCategory === category.id ? "all" : category.id)}
            >
              <span className={styles.categoryIcon}>{category.icon}</span>
              <h2>{category.title}</h2>
              <p>{category.detail}</p>
              <span className={styles.categoryCount}>{counts[category.id] || 0} published updates</span>
            </button>
          ))}
        </section>

        <section className={styles.toolbar}>
          <div>
            <h2>{selectedCategory === "all" ? "Daily updates" : displayCategory(selectedCategory)}</h2>
            <p>{filteredItems.length} verified updates available</p>
          </div>
          <input
            className={styles.search}
            type="search"
            placeholder="Search current affairs..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search current affairs"
          />
        </section>

        {loading && <div className={styles.state}>Loading the latest published updates...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && !error && filteredItems.length === 0 && (
          <div className={styles.empty}>
            <strong>No published updates in this view yet.</strong>
            New items are collected from approved sources and reviewed by the EduAxis India team
            before publication. Please check back soon.
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <div className={styles.articleList}>
            {filteredItems.map((item) => {
              const summary = item.summary || item.content || "";
              return (
                <article className={styles.article} key={item.id}>
                  <div className={styles.articleMeta}>
                    <span className={styles.tag}>{displayCategory(item.category)}</span>
                    <span>{formatDate(item.original_published_at || item.approved_at)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {summary && <p className={styles.summary}>{summary}</p>}
                  {item.title_hi && <h4 className={styles.hindiTitle}>{item.title_hi}</h4>}
                  {item.summary_hi && (
                    <div className={styles.hindiSummary}>
                      <span>संक्षेप में</span>
                      <p>{item.summary_hi}</p>
                    </div>
                  )}
                  {item.key_facts && item.key_facts.length > 0 && (
                    <div className={styles.keyFacts}>
                      <strong>Key Facts</strong>
                      <ul>
                        {item.key_facts.map((fact, index) => <li key={index}>{fact}</li>)}
                      </ul>
                    </div>
                  )}
                  {item.exam_relevance && (
                    <div className={styles.examRelevance}>
                      <strong>Exam Relevance:</strong> {item.exam_relevance}
                    </div>
                  )}
                  <div className={styles.articleFooter}>
                    <span className={styles.source}>Source: {item.source_name || "Official source"}</span>
                    <a className={styles.read} href={item.source_url} target="_blank" rel="noopener noreferrer">
                      Read original update ↗
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
