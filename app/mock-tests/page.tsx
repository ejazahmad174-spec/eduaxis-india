
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

declare global {
  interface Window {
    Razorpay: new (options: {
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
      }) => void;
      prefill?: {
        email?: string;
      };
      theme?: {
        color?: string;
      };
      modal?: {
        ondismiss?: () => void;
      };
    }) => {
      open: () => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function StudentMockTestsPage() {
  const router = useRouter();

  const [tests, setTests] = useState<MockTest[]>([]);
  const [purchasedTests, setPurchasedTests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processingTest, setProcessingTest] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTests() {
      if (!supabase) {
        setError("Website connection is not configured.");
        setLoading(false);
        return;
      }

      // Require student login before loading mock tests.
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      const user = authData.user;

      if (authError || !user) {
        router.replace(
          `/student/login?next=${encodeURIComponent("/mock-tests")}`
        );
        return;
      }

      setLoggedIn(true);

      const { data, error: testError } = await supabase
        .from("mock_tests")
        .select(
          "id,title,exam_category,duration_minutes,total_marks,access_type,price,status"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (testError) {
        setError(testError.message);
        setLoading(false);
        return;
      }

      setTests((data || []) as MockTest[]);

      const { data: purchases, error: purchaseError } = await supabase
        .from("mock_test_purchases")
        .select("mock_test_id")
        .eq("student_id", user.id);

      if (!active) return;

      if (purchaseError) {
        setError(
          "Unable to load your purchase history. Please refresh the page."
        );
      } else {
        setPurchasedTests(
          (purchases || []).map((item) => item.mock_test_id)
        );
      }

      setLoading(false);
    }

    loadTests();

    return () => {
      active = false;
    };
  }, [router]);

  async function purchaseTest(test: MockTest) {
    if (!supabase || processingTest) return;

    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace(
        `/student/login?next=${encodeURIComponent("/mock-tests")}`
      );
      return;
    }

    if (purchasedTests.includes(test.id)) {
      setMessage("You have already purchased this test.");
      return;
    }

    if (!test.price || Number(test.price) <= 0) {
      setMessage("This test does not have a valid purchase price.");
      return;
    }

    setProcessingTest(test.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay Checkout. Please try again.");
      }

      const orderResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mockTestId: test.id,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Unable to create payment order.");
      }

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "EduAxis India",
        description: test.title,
        order_id: orderData.orderId,
        prefill: {
          email: authData.user.email || "",
        },
        theme: {
          color: "#174ea6",
        },
        handler: async (response) => {
          try {
            setMessage("Payment received. Verifying your payment...");

            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.error ||
                  "Payment verification is pending. Please contact support if access is not activated."
              );
            }

            setPurchasedTests((previous) =>
              previous.includes(test.id)
                ? previous
                : [...previous, test.id]
            );

            setMessage(
              "Payment successful! Your test is now unlocked."
            );
          } catch (verificationError) {
            setMessage(
              verificationError instanceof Error
                ? verificationError.message
                : "Payment verification failed. Please contact support."
            );
          } finally {
            setProcessingTest("");
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingTest("");
            setMessage("Payment window closed. No access was granted.");
          },
        },
      });

      checkout.open();
    } catch (purchaseError) {
      setMessage(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Unable to process your purchase."
      );
      setProcessingTest("");
    }
  }

  const freeTests = tests.filter(
    (test) => test.access_type === "free"
  );

  const premiumTests = tests.filter(
    (test) => test.access_type === "paid"
  );

  function TestCard({ test }: { test: MockTest }) {
    const isFree = test.access_type === "free";
    const isPurchased = purchasedTests.includes(test.id);
    const isProcessing = processingTest === test.id;

    return (
      <article className="test-card">
        <span className={isFree ? "free-tag" : "paid-tag"}>
          {isFree ? "FREE TEST" : "PREMIUM TEST"}
        </span>

        <h2>{test.title}</h2>

        <div className="test-info">
          <div>
            <strong>Examination:</strong> {test.exam_category}
          </div>
          <div>
            <strong>Duration:</strong> {test.duration_minutes} minutes
          </div>
          <div>
            <strong>Total Marks:</strong> {test.total_marks}
          </div>

          {!isFree && (
            <div>
              <strong>Price:</strong> ₹{test.price ?? 0}
            </div>
          )}
        </div>

        {isFree || isPurchased ? (
          <>
            {isPurchased && (
              <p className="purchased-message">
                ✓ Purchased – Access available
              </p>
            )}

            <a
              className="test-button"
              href={`/mock-tests/${test.id}`}
            >
              View Test & Start
            </a>
          </>
        ) : (
          <button
            className="test-button"
            onClick={() => purchaseTest(test)}
            disabled={!!processingTest}
          >
            {isProcessing ? "Processing..." : "Purchase Now"}
          </button>
        )}
      </article>
    );
  }

  return (
    <main className="mock-page">
      <style jsx>{`
        .mock-page {
          max-width: 1100px;
          margin: auto;
          padding: 35px 20px 60px;
          color: #172033;
        }

        .page-link {
          color: #174ea6;
          text-decoration: none;
          font-weight: 600;
        }

        .page-title {
          font-size: 32px;
          margin-top: 25px;
          color: #102d49;
        }

        .page-description {
          color: #64748b;
          line-height: 1.7;
        }

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
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.04);
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
          border: none;
          border-radius: 7px;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        }

        .test-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .message {
          margin-top: 20px;
          padding: 13px;
          background: #eff6ff;
          color: #1e40af;
          border-radius: 8px;
          line-height: 1.6;
        }

        .test-section {
          margin-top: 40px;
        }

        .test-section h2 {
          font-size: 25px;
          color: #102d49;
          margin-bottom: 8px;
        }

        .section-description {
          color: #64748b;
          line-height: 1.6;
        }

        .empty-state {
          padding: 25px;
          margin-top: 20px;
          background: #f8fafc;
          border-radius: 12px;
          color: #64748b;
        }

        .empty-state h3 {
          color: #102d49;
          margin-top: 0;
        }

        .purchased-message {
          color: #15803d;
          margin-top: 12px;
        }
      `}</style>

      <a className="page-link" href="/student/dashboard">
        ← Back to Student Dashboard
      </a>

      <h1 className="page-title">Online Mock Tests</h1>

      <p className="page-description">
        Practise with examination-oriented tests, evaluate your preparation
        and improve your performance with EduAxis India.
      </p>

      {message && <div className="message">{message}</div>}

      {loading && <p>Checking login and loading available mock tests...</p>}

      {error && (
        <p style={{ color: "#b91c1c" }}>
          Unable to load mock tests: {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <section className="test-section">
            <h2>Free Mock Tests</h2>
            <p className="section-description">
              Practise and evaluate your preparation with free tests.
            </p>

            {freeTests.length === 0 ? (
              <div className="empty-state">
                <h3>No free mock tests available yet.</h3>
                <p>New free tests will appear here after they are published.</p>
              </div>
            ) : (
              <div className="test-grid">
                {freeTests.map((test) => (
                  <TestCard key={test.id} test={test} />
                ))}
              </div>
            )}
          </section>

          <section className="test-section">
            <h2>Premium Mock Tests</h2>
            <p className="section-description">
              Unlock premium examination tests and specialised test series.
            </p>

            {premiumTests.length === 0 ? (
              <div className="empty-state">
                <h3>Premium mock tests coming soon.</h3>
                <p>Premium tests will appear here when they are published.</p>
              </div>
            ) : (
              <div className="test-grid">
                {premiumTests.map((test) => (
                  <TestCard key={test.id} test={test} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
