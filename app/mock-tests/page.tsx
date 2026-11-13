
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MockTest = {
  id: string;
  title: string;
  exam_category: string;
  duration_minutes: number;
  total_marks: number;
  access_type: string;
  price: number | null;
  status: string;
};

export default function StudentMockTestsPage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTests() {
      if (!supabase) {
        setError("Website connection is not configured.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("mock_tests")
        .select("id,title,exam_category,duration_minutes,total_marks,access_type,price,status")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setTests((data || []) as MockTest[]);
      }

      setLoading(false);
    }

    loadTests();
  }, []);

  return (
    <main style={{
      maxWidth: 1100,
      margin: "auto",
      padding: "35px 20px 60px",
      color: "#172033"
    }}>
      <style jsx>{`
        .test-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
          gap: 18px;
          margin-top: 25px;
        }
        .test-card {
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          padding: 22px;
          background: white;
          box-shadow: 0 3px 12px rgba(0,0,0,.04);
        }
        .test-card h2 {
          font-size: 19px;
          margin: 12px 0;
        }
        .test-info {
          color: #64748b;
          font-size: 14px;
          line-height: 1.9;
        }
        .test-button {
          display: inline-block;
          margin-top: 15px;
          padding: 11px 17px;
          background: #174ea6;
          color: white;
          border-radius: 7px;
          text-decoration: none;
          font-weight: 600;
        }
        .free-tag {
          color: #15803d;
          background: #dcfce7;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }
        .paid-tag {
          color: #92400e;
          background: #fef3c7;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }
      `}</style>

      <a href="/student/dashboard">← Back to Student Dashboard</a>

      <h1 style={{ fontSize: 32, marginTop: 25 }}>
        Online Mock Tests
      </h1>

      <p style={{ color: "#64748b", lineHeight: 1.7 }}>
        Practise with examination-oriented tests, evaluate your preparation
        and improve your performance with EduAxis India.
      </p>

      {loading && <p>Loading available mock tests...</p>}

      {error && (
        <p style={{ color: "#b91c1c" }}>
          Unable to load mock tests: {error}
        </p>
      )}

      {!loading && !error && tests.length === 0 && (
        <div style={{
          padding: 25,
          marginTop: 25,
          background: "#f8fafc",
          borderRadius: 12
        }}>
          <h2>No mock tests available yet.</h2>
          <p>New tests will appear here after they are published.</p>
        </div>
      )}

      <div className="test-grid">
        {tests.map(test => (
          <article className="test-card" key={test.id}>
            <span className={test.access_type === "free" ? "free-tag" : "paid-tag"}>
              {test.access_type === "free" ? "FREE TEST" : "PAID TEST"}
            </span>

            <h2>{test.title}</h2>

            <div className="test-info">
              <div><strong>Examination:</strong> {test.exam_category}</div>
              <div><strong>Duration:</strong> {test.duration_minutes} minutes</div>
              <div><strong>Total Marks:</strong> {test.total_marks}</div>
              {test.access_type === "paid" && (
                <div><strong>Price:</strong> ₹{test.price ?? 0}</div>
              )}
            </div>

            {test.access_type === "free" ? (
              <a className="test-button" href={`/mock-tests/${test.id}`}>
                View Test & Start
              </a>
            ) : (
              <p style={{ color: "#92400e", marginTop: 15 }}>
                Online purchase will be available soon.
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
