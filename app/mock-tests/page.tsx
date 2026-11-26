
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StudentNavigation from "@/components/student/StudentNavigation";
import styles from "./mock-tests.module.css";
import { BSEB_CLASS_XII_SERIES, BSEB_LOGO_URL, MOCK_TEST_SERIES_GROUPS } from "@/lib/mock-test-series";

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
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processingTest, setProcessingTest] = useState("");

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

      const [purchaseResult, paidOrderResult] = await Promise.all([
        supabase
          .from("mock_test_purchases")
          .select("mock_test_id, payment_order_id")
          .eq("student_id", user.id),

        supabase
          .from("payment_orders")
          .select("id, mock_test_id")
          .eq("student_id", user.id)
          .eq("status", "paid")
          .not("razorpay_payment_id", "is", null),
      ]);

      if (!active) return;

      if (purchaseResult.error || paidOrderResult.error) {
        setError(
          "Unable to load your purchase history. Please refresh the page."
        );
      } else {
        const purchaseOrderIds = new Set(
          (purchaseResult.data || []).map((item) => item.payment_order_id)
        );

        // A historical purchase is not an active entitlement after its
        // payment order has been refunded.
        setPurchasedTests(
          (paidOrderResult.data || [])
            .filter((order) => purchaseOrderIds.has(order.id))
            .map((order) => order.mock_test_id)
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

  type SeriesView = {
    id: string;
    group: string;
    subject: string;
    examCategory: string;
    description: string;
    boardName: string;
    logoUrl: string;
    plannedTests: number | null;
    plannedFreeTests: number | null;
    plannedPaidTests: number | null;
    isLegacy?: boolean;
  };

  const configuredCategories = new Set(
    BSEB_CLASS_XII_SERIES.map((series) => series.examCategory)
  );

  const legacySeries = Array.from(
    new Set(
      tests
        .map((test) => test.exam_category || "Other examination")
        .filter((category) => !configuredCategories.has(category))
    )
  ).map((category, index) => ({
    id: "existing-series-" + index,
    group: "Other examinations",
    subject: category,
    examCategory: category,
    description: "Previously published examination practice tests.",
    boardName: category,
    logoUrl: BSEB_LOGO_URL,
    plannedTests: null,
    plannedFreeTests: null,
    plannedPaidTests: null,
    isLegacy: true,
  })) as SeriesView[];

  const allSeries = [...BSEB_CLASS_XII_SERIES, ...legacySeries] as SeriesView[];
  const visibleSeries = allSeries.filter((series) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [
      series.group,
      series.subject,
      series.examCategory,
      series.description,
      series.boardName,
    ].join(" ").toLowerCase().includes(term);
  });
  const selectedSeries = allSeries.find((series) => series.id === selectedSeriesId) || null;
  const selectedTests = selectedSeries
    ? tests.filter((test) => test.exam_category === selectedSeries.examCategory)
    : [];
  const selectedFreeTests = selectedTests.filter((test) => test.access_type === "free");
  const selectedPremiumTests = selectedTests.filter((test) => test.access_type === "paid");

  function openSeries(series: SeriesView) {
    setMessage("");
    setSelectedSeriesId(series.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function TestCard({ test }: { test: MockTest }) {
    const isFree = test.access_type === "free";
    const isPurchased = purchasedTests.includes(test.id);
    const isProcessing = processingTest === test.id;

    return (
      <article className={styles.testCard}>
        <div className={styles.testCardTop}>
          <span className={styles.accessTag + " " + (isFree ? styles.free : styles.paid)}>
            {isFree ? "FREE TEST" : "PREMIUM TEST"}
          </span>
          {isPurchased && <span className={styles.owned}>✓ Unlocked</span>}
        </div>

        <h3 className={styles.testTitle}>{test.title}</h3>

        <div className={styles.testMeta}>
          <span><b>Duration:</b> {test.duration_minutes} minutes</span>
          <span><b>Total marks:</b> {test.total_marks}</span>
          {!isFree && <span><b>Price:</b> ₹{test.price ?? 0}</span>}
        </div>

        {isFree || isPurchased ? (
          <a className={styles.testAction} href={"/mock-tests/" + test.id}>
            {isPurchased ? "Continue Test" : "Start Free Test"} <span aria-hidden="true">→</span>
          </a>
        ) : (
          <button
            className={styles.testAction}
            onClick={() => purchaseTest(test)}
            disabled={!!processingTest}
          >
            {isProcessing ? "Processing..." : "Purchase Test · ₹" + (test.price ?? 0)}
          </button>
        )}
      </article>
    );
  }

  return (
    <main className={styles.page}>
      <StudentNavigation />

      {!selectedSeries ? (
        <>
          <a className={styles.backLink} href="/student/dashboard">
            ← Back to Student Dashboard
          </a>

          <div className={styles.mockHeading}>
            <div>
              <div className={styles.eyebrow}>PRACTISE · EVALUATE · IMPROVE</div>
              <h1>Popular Mock Test Series</h1>
              <p>
                Choose your BSEB Class XII stream and subject. Every subject has
                its own 11-test bundle with one free test and ten premium tests planned.
              </p>
            </div>
            <input
              className={styles.search}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a subject or test series..."
              aria-label="Search test series"
            />
          </div>

          {message && <div className={styles.alert}>{message}</div>}
          {loading && <div className={styles.loading}>Checking your account and loading test series...</div>}
          {error && <div className={styles.alert + " " + styles.error}>Unable to load mock tests: {error}</div>}

          {!loading && !error && (
            <>
              {MOCK_TEST_SERIES_GROUPS.map((group) => {
                const groupSeries = visibleSeries.filter((series) => series.group === group.name);
                if (!groupSeries.length) return null;

                return (
                  <section className={styles.group} key={group.name}>
                    <div className={styles.groupHeading}>
                      <div>
                        <h2>{group.name}</h2>
                        <p>{group.description}</p>
                      </div>
                      <span className={styles.groupCount}>{groupSeries.length} subject bundles</span>
                    </div>

                    <div className={styles.seriesGrid}>
                      {groupSeries.map((series) => {
                        const available = tests.filter((test) => test.exam_category === series.examCategory);
                        const availableFree = available.filter((test) => test.access_type === "free").length;
                        const availablePaid = available.filter((test) => test.access_type === "paid").length;

                        return (
                          <article className={styles.seriesCard} key={series.id}>
                            <div className={styles.seriesCardHead}>
                              <span className={styles.seriesLogo}>
                                <img src={series.logoUrl} alt="Bihar School Examination Board emblem" loading="lazy" />
                              </span>
                              <span className={styles.seriesAuthority}>
                                {series.boardName}
                                <br />
                                CLASS XII BOARD EXAMINATION
                              </span>
                            </div>
                            <span className={styles.seriesLevel}>
                              {series.group.toUpperCase()} · SUBJECT SERIES
                            </span>
                            <h3 className={styles.seriesTitle}>{series.subject} Test Series</h3>
                            <p className={styles.seriesDescription}>{series.description}</p>
                            <div className={styles.stats}>
                              <span className={styles.stat}>11 tests planned</span>
                              <span className={styles.stat + " " + styles.statFree}>1 free</span>
                              <span className={styles.stat + " " + styles.statPaid}>10 premium</span>
                            </div>
                            <div className={styles.availability}>
                              {available.length} of 11 tests currently published
                              {available.length > 0
                                ? " · " + availableFree + " free · " + availablePaid + " premium"
                                : ""}
                            </div>
                            <button className={styles.seriesCta} onClick={() => openSeries(series)}>
                              Explore test series <span aria-hidden="true">→</span>
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {visibleSeries.some((series) => series.isLegacy) && (
                <section className={styles.group}>
                  <div className={styles.groupHeading}>
                    <div>
                      <h2>Other available test series</h2>
                      <p>Previously published examination tests remain available here.</p>
                    </div>
                  </div>
                  <div className={styles.seriesGrid}>
                    {visibleSeries.filter((series) => series.isLegacy).map((series) => {
                      const available = tests.filter((test) => test.exam_category === series.examCategory);
                      const availableFree = available.filter((test) => test.access_type === "free").length;
                      const availablePaid = available.filter((test) => test.access_type === "paid").length;

                      return (
                        <article className={styles.seriesCard} key={series.id}>
                          <div className={styles.seriesCardHead}>
                            <span className={styles.seriesLogo}>
                              <img src={series.logoUrl} alt="Bihar School Examination Board emblem" loading="lazy" />
                            </span>
                            <span className={styles.seriesAuthority}>{series.boardName}</span>
                          </div>
                          <span className={styles.seriesLevel}>EXISTING TEST SERIES</span>
                          <h3 className={styles.seriesTitle}>{series.subject}</h3>
                          <p className={styles.seriesDescription}>{series.description}</p>
                          <div className={styles.stats}>
                            <span className={styles.stat}>{available.length} published</span>
                            <span className={styles.stat + " " + styles.statFree}>{availableFree} free</span>
                            <span className={styles.stat + " " + styles.statPaid}>{availablePaid} premium</span>
                          </div>
                          <div className={styles.availability}>Existing published tests and purchases are preserved.</div>
                          <button className={styles.seriesCta} onClick={() => openSeries(series)}>
                            View available tests <span aria-hidden="true">→</span>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {visibleSeries.length === 0 && (
                <div className={styles.emptyState}>
                  <strong>No matching test series found.</strong>
                  Try another subject name or clear your search.
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <button className={styles.backLink} type="button" onClick={() => setSelectedSeriesId("")}>
            ← Back to all test series
          </button>

          <div className={styles.detailTop}>
            <span className={styles.seriesLogo}>
              <img src={selectedSeries.logoUrl} alt="Bihar School Examination Board emblem" />
            </span>
            <div className={styles.detailCopy}>
              <small>{selectedSeries.boardName} · {selectedSeries.group}</small>
              <h1>{selectedSeries.subject} Test Series</h1>
              <p>{selectedSeries.description}</p>
              {selectedSeries.plannedTests ? (
                <div className={styles.plan}>
                  <span>{selectedSeries.plannedTests} tests planned</span>
                  <span>{selectedSeries.plannedFreeTests} free test</span>
                  <span>{selectedSeries.plannedPaidTests} premium tests</span>
                  <span>{selectedTests.length} currently published</span>
                </div>
              ) : (
                <div className={styles.plan}>
                  <span>{selectedTests.length} published tests</span>
                  <span>{selectedFreeTests.length} free</span>
                  <span>{selectedPremiumTests.length} premium</span>
                </div>
              )}
            </div>
          </div>

          {message && <div className={styles.alert}>{message}</div>}
          {error && <div className={styles.alert + " " + styles.error}>{error}</div>}

          <section className={styles.testSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Free Mock Tests</h2>
                <p>Start practising with the free test in this subject bundle.</p>
              </div>
              <span className={styles.testCount}>{selectedFreeTests.length} available</span>
            </div>
            {selectedFreeTests.length ? (
              <div className={styles.testGrid}>
                {selectedFreeTests.map((test) => <TestCard key={test.id} test={test} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>The free test is being prepared.</strong>
                It will appear here as soon as it is published by EduAxis India.
              </div>
            )}
          </section>

          <section className={styles.testSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Premium Mock Tests</h2>
                <p>Unlock additional subject-wise practice tests.</p>
              </div>
              <span className={styles.testCount}>{selectedPremiumTests.length} available</span>
            </div>
            {selectedPremiumTests.length ? (
              <div className={styles.testGrid}>
                {selectedPremiumTests.map((test) => <TestCard key={test.id} test={test} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>Premium tests are being prepared.</strong>
                Published paid tests will appear here with their price and purchase option.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
