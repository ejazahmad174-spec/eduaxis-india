'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import '../admin.css';

type ProductSales = {
  id: string;
  title: string;
  orders: number;
  buyers: number;
  gross_paise: number;
  refunds_paise: number;
  net_paise: number;
  active_orders: number;
  fully_refunded_orders: number;
};

type Transaction = {
  id: string;
  category: 'Mock Test' | 'Course';
  title: string;
  kind: 'Payment' | 'Refund';
  status: string;
  amount_paise: number;
  date: string;
};

type Report = {
  generatedAt: string;
  summary: {
    gross_paise: number;
    refunds_paise: number;
    net_paise: number;
    successful_orders: number;
    unique_buyers: number;
    mock_test_orders: number;
    course_orders: number;
  };
  mockTests: {
    orders: number;
    buyers: number;
    gross_paise: number;
    refunds_paise: number;
    net_paise: number;
    products: ProductSales[];
  };
  courses: {
    orders: number;
    buyers: number;
    gross_paise: number;
    refunds_paise: number;
    net_paise: number;
    products: ProductSales[];
  };
  studyMaterials: {
    tracking_enabled: boolean;
    published_count: number;
    paid_published_count: number;
    free_published_count: number;
    note: string;
  };
  recentTransactions: Transaction[];
};

function money(paise: number) {
  return (Number(paise || 0) / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSalesPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (refresh = false) => {
    if (!supabase) {
      setError('The administrator service is not configured.');
      setLoading(false);
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace('/admin/login');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/sales', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.replace('/admin/login');
          return;
        }
        throw new Error(payload.error || 'Sales report could not be loaded.');
      }

      setReport(payload as Report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sales report could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const cards = report ? [
    { label: 'Gross receipts', value: money(report.summary.gross_paise), detail: 'Captured mock-test and course payments' },
    { label: 'Refunds processed', value: money(report.summary.refunds_paise), detail: 'Processed refunds across recorded sales' },
    { label: 'Net collection', value: money(report.summary.net_paise), detail: 'After refunds, before gateway fees and taxes' },
    { label: 'Unique buyers', value: report.summary.unique_buyers.toLocaleString('en-IN'), detail: 'Distinct students across mock tests and courses' },
    { label: 'Successful orders', value: report.summary.successful_orders.toLocaleString('en-IN'), detail: 'Captured payment orders, including later-refunded orders' },
  ] : [];

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN / FINANCE</div>
            <h1>Sales &amp; Revenue</h1>
          </div>
          <button className="admin-logout" onClick={() => void loadReport(true)} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh report'}
          </button>
        </header>

        <div className="sales-intro">
          <div>
            <h2>Revenue overview</h2>
            <p>All-time captured sales, processed refunds and net collections recorded by EduAxis India.</p>
          </div>
          {report && <span>Updated {dateLabel(report.generatedAt)}</span>}
        </div>

        {error && <div className="sales-error" role="alert">{error}</div>}

        {loading ? (
          <div className="sales-loading">Loading verified payment records…</div>
        ) : report ? (
          <>
            <section className="sales-kpis" aria-label="Revenue summary">
              {cards.map((card) => (
                <article className="sales-kpi" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </section>

            <section className="sales-panel">
              <div className="sales-panel-heading">
                <div>
                  <h2>Revenue by product category</h2>
                  <p>Gross receipts minus processed refunds. Values are shown in Indian rupees.</p>
                </div>
              </div>
              <div className="sales-category-grid">
                <article className="sales-category">
                  <div className="sales-category-top">
                    <span className="sales-icon">📝</span>
                    <div><h3>Mock Tests</h3><small>{report.mockTests.orders} captured orders · {report.mockTests.buyers} unique buyers</small></div>
                  </div>
                  <div className="sales-category-amount">{money(report.mockTests.net_paise)}</div>
                  <div className="sales-category-caption">Net collection</div>
                  <div className="sales-category-metrics">
                    <div><span>Gross receipts</span><b>{money(report.mockTests.gross_paise)}</b></div>
                    <div><span>Refunds</span><b>{money(report.mockTests.refunds_paise)}</b></div>
                  </div>
                </article>
                <article className="sales-category">
                  <div className="sales-category-top">
                    <span className="sales-icon">🎓</span>
                    <div><h3>Online Courses</h3><small>{report.courses.orders} captured orders · {report.courses.buyers} unique buyers</small></div>
                  </div>
                  <div className="sales-category-amount">{money(report.courses.net_paise)}</div>
                  <div className="sales-category-caption">Net collection</div>
                  <div className="sales-category-metrics">
                    <div><span>Gross receipts</span><b>{money(report.courses.gross_paise)}</b></div>
                    <div><span>Refunds</span><b>{money(report.courses.refunds_paise)}</b></div>
                  </div>
                </article>
              </div>
            </section>

            <section className="sales-panel">
              <div className="sales-panel-heading">
                <div>
                  <h2>Mock-test revenue by individual test</h2>
                  <p>Sales are grouped by the individual test record. A separate test-series identifier is not present in the current database.</p>
                </div>
              </div>
              {report.mockTests.products.length === 0 ? (
                <div className="sales-empty">No captured mock-test payments have been recorded yet.</div>
              ) : (
                <div className="sales-table-wrap">
                  <table className="sales-table">
                    <thead><tr><th>Mock test</th><th>Orders</th><th>Buyers</th><th>Gross</th><th>Refunds</th><th>Net</th></tr></thead>
                    <tbody>
                      {report.mockTests.products.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.title}</strong><small>{item.active_orders} active · {item.fully_refunded_orders} fully refunded</small></td>
                          <td>{item.orders}</td><td>{item.buyers}</td><td>{money(item.gross_paise)}</td><td>{money(item.refunds_paise)}</td><td className="sales-net">{money(item.net_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="sales-panel">
              <div className="sales-panel-heading">
                <div>
                  <h2>Course revenue by course</h2>
                  <p>Captured enrolment payments grouped by course.</p>
                </div>
              </div>
              {report.courses.products.length === 0 ? (
                <div className="sales-empty">No captured course payments have been recorded yet.</div>
              ) : (
                <div className="sales-table-wrap">
                  <table className="sales-table">
                    <thead><tr><th>Course</th><th>Orders</th><th>Buyers</th><th>Gross</th><th>Refunds</th><th>Net</th></tr></thead>
                    <tbody>
                      {report.courses.products.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.title}</strong><small>{item.active_orders} active · {item.fully_refunded_orders} fully refunded</small></td>
                          <td>{item.orders}</td><td>{item.buyers}</td><td>{money(item.gross_paise)}</td><td>{money(item.refunds_paise)}</td><td className="sales-net">{money(item.net_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="sales-panel">
              <div className="sales-panel-heading">
                <div>
                  <h2>PDFs &amp; study materials</h2>
                  <p>Published resource inventory and payment tracking readiness.</p>
                </div>
                <span className="sales-status-warning">Sales tracking not connected</span>
              </div>
              <div className="sales-materials-grid">
                <div><strong>{report.studyMaterials.published_count}</strong><span>Published materials</span></div>
                <div><strong>{report.studyMaterials.free_published_count}</strong><span>Free materials</span></div>
                <div><strong>{report.studyMaterials.paid_published_count}</strong><span>Paid materials listed</span></div>
                <div><strong>—</strong><span>Recorded buyers / revenue</span></div>
              </div>
              <p className="sales-material-note">{report.studyMaterials.note}</p>
            </section>

            <section className="sales-panel">
              <div className="sales-panel-heading">
                <div>
                  <h2>Recent payment activity</h2>
                  <p>Latest captured payment and processed-refund events.</p>
                </div>
                <span className="sales-count">{report.recentTransactions.length} records</span>
              </div>
              {report.recentTransactions.length === 0 ? (
                <div className="sales-empty">No payment activity is available.</div>
              ) : (
                <div className="sales-table-wrap">
                  <table className="sales-table sales-activity-table">
                    <thead><tr><th>Date</th><th>Category</th><th>Product</th><th>Activity</th><th>Amount</th></tr></thead>
                    <tbody>
                      {report.recentTransactions.map((item) => (
                        <tr key={item.id}>
                          <td>{dateLabel(item.date)}</td>
                          <td>{item.category}</td>
                          <td><strong>{item.title}</strong></td>
                          <td><span className={'sales-activity-tag ' + (item.kind === 'Refund' ? 'is-refund' : 'is-payment')}>{item.kind} · {item.status}</span></td>
                          <td className={item.kind === 'Refund' ? 'sales-refund-amount' : 'sales-net'}>{item.kind === 'Refund' ? '−' : ''}{money(item.amount_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="sales-disclaimer">Figures are based on payment records stored in EduAxis India. Net collection is before Razorpay fees, GST and other applicable adjustments. Refund amounts are deducted once per processed refund record.</p>
          </>
        ) : (
          <div className="sales-empty">The sales report is currently unavailable.</div>
        )}
        <footer className="admin-footer">EduAxis India · Learn. Prepare. Progress.</footer>
      </section>

      <style jsx>{`
        .sales-intro{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;padding:26px 0 18px;flex-wrap:wrap}
        .sales-intro h2{font-size:20px;color:#102b46;margin:0 0 6px}
        .sales-intro p{font-size:12px;color:#718392;margin:0;line-height:1.6}
        .sales-intro>span{font-size:10px;color:#7b8e9d}
        .sales-error{background:#fff0ef;border:1px solid #f1ceca;color:#a3342e;border-radius:9px;padding:12px 14px;font-size:12px;margin-bottom:16px}
        .sales-loading,.sales-empty{background:#fff;border:1px dashed #d7e2e8;border-radius:12px;padding:28px;color:#758898;font-size:13px;text-align:center}
        .sales-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
        .sales-kpi{background:#fff;border:1px solid #e1e9ed;border-radius:12px;padding:16px;min-width:0}
        .sales-kpi span{display:block;font-size:10px;color:#718392;font-weight:700}
        .sales-kpi strong{display:block;font-size:clamp(17px,2vw,25px);color:#102b46;margin:9px 0 6px;overflow-wrap:anywhere}
        .sales-kpi small{font-size:9px;line-height:1.5;color:#81919c;display:block}
        .sales-panel{background:#fff;border:1px solid #e1e9ed;border-radius:13px;padding:20px;margin-top:16px;min-width:0}
        .sales-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
        .sales-panel-heading h2{font-size:16px;color:#102b46;margin:0 0 5px}
        .sales-panel-heading p{font-size:11px;line-height:1.6;color:#758898;margin:0}
        .sales-category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
        .sales-category{border:1px solid #e5ecef;border-radius:11px;padding:17px;background:#fbfcfd}
        .sales-category-top{display:flex;align-items:center;gap:11px}
        .sales-icon{width:38px;height:38px;border-radius:10px;background:#e7f5f2;display:grid;place-items:center;font-size:18px}
        .sales-category-top h3{font-size:14px;margin:0 0 4px;color:#23445c}
        .sales-category-top small{font-size:10px;color:#80909b}
        .sales-category-amount{font-size:27px;font-weight:850;color:#102b46;margin-top:19px}
        .sales-category-caption{font-size:10px;color:#718392;margin-top:2px}
        .sales-category-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid #e5ecef;margin-top:15px;padding-top:12px}
        .sales-category-metrics span,.sales-category-metrics b{display:block}
        .sales-category-metrics span{font-size:10px;color:#7a8d9b;margin-bottom:5px}
        .sales-category-metrics b{font-size:13px;color:#28465d}
        .sales-table-wrap{width:100%;overflow-x:auto}
        .sales-table{width:100%;border-collapse:collapse;min-width:700px;text-align:left}
        .sales-table th{font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:#84939e;background:#f7f9fa;padding:11px 10px;border-bottom:1px solid #e7edf0}
        .sales-table td{font-size:11px;color:#506779;padding:13px 10px;border-bottom:1px solid #edf1f3;vertical-align:middle}
        .sales-table td strong,.sales-table td small{display:block}
        .sales-table td strong{font-size:11px;color:#28465d;line-height:1.45}
        .sales-table td small{font-size:9px;color:#8796a1;margin-top:4px}
        .sales-net{font-weight:800;color:#167c5a!important}
        .sales-refund-amount{font-weight:800;color:#b23b34!important}
        .sales-status-warning{font-size:9px;font-weight:800;color:#8b5b17;background:#fff4dc;border-radius:30px;padding:7px 10px}
        .sales-materials-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .sales-materials-grid>div{background:#f7f9fa;border:1px solid #e7edf0;border-radius:9px;padding:13px}
        .sales-materials-grid strong,.sales-materials-grid span{display:block}
        .sales-materials-grid strong{font-size:22px;color:#193b57}
        .sales-materials-grid span{font-size:9px;color:#728595;margin-top:4px}
        .sales-material-note{font-size:11px;line-height:1.6;color:#8a621e;background:#fff9eb;border:1px solid #f1e1bb;border-radius:8px;padding:11px 13px;margin:12px 0 0}
        .sales-count{font-size:10px;color:#8795a0}
        .sales-activity-tag{display:inline-block;padding:6px 8px;border-radius:30px;font-size:9px;font-weight:800;white-space:nowrap}
        .sales-activity-tag.is-payment{background:#e7f6ee;color:#177147}
        .sales-activity-tag.is-refund{background:#ffedeb;color:#ae3e37}
        .sales-disclaimer{font-size:10px;color:#84939e;line-height:1.6;margin:15px 2px}
        @media(max-width:1100px){.sales-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:700px){.sales-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sales-category-grid{grid-template-columns:1fr}.sales-materials-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sales-panel{padding:14px}.sales-category{padding:14px}}
        @media(max-width:400px){.sales-kpis{grid-template-columns:1fr 1fr}.sales-kpi{padding:12px}}
      `}</style>
    </main>
  );
}
