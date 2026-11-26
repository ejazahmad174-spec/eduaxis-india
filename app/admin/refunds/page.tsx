'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import '../admin.css';

type RefundCategory = 'mock_test' | 'course' | 'study_material' | 'qa_study_material';
type RefundType = 'partial' | 'full';

type RefundOrder = {
  id: string;
  category: RefundCategory;
  category_label: string;
  title: string;
  student_id: string;
  student_name: string;
  student_email: string | null;
  amount_paise: number;
  refunded_paise: number;
  remaining_paise: number;
  status: string;
  payment_id: string;
  paid_at: string;
  mode: 'live' | 'test';
};

type RefundAction = {
  id: string;
  category: RefundCategory;
  payment_order_id: string;
  student_id: string;
  amount_paise: number;
  refund_type: RefundType;
  status: string;
  razorpay_refund_id: string | null;
  reason: string;
  mode: 'live' | 'test';
  merchant_balance_snapshot_paise: number | null;
  merchant_balance_checked_at: string | null;
  merchant_balance_source: string | null;
  provider_error_code: string | null;
  provider_error: string | null;
  created_at: string;
  processed_at: string | null;
};

type RefundReport = {
  generatedAt: string;
  orders: RefundOrder[];
  actions: RefundAction[];
  emailConfigured: boolean;
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

function actionStatusLabel(status: string) {
  if (status === 'processed') return 'Processed';
  if (status === 'pending') return 'Pending with Razorpay';
  if (status === 'initiating') return 'Initiating';
  if (status === 'failed') return 'Failed';
  if (status === 'review_required') return 'Manual review required';
  return status.replaceAll('_', ' ');
}

export default function AdminRefundsPage() {
  const router = useRouter();
  const [report, setReport] = useState<RefundReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'refundable' | 'pending' | 'test'>('refundable');
  const [selectedOrder, setSelectedOrder] = useState<RefundOrder | null>(null);
  const [refundType, setRefundType] = useState<RefundType>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState('');
  const [requestSource, setRequestSource] = useState('student_email');
  const [merchantBalance, setMerchantBalance] = useState('');
  const [balanceChecked, setBalanceChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

      const response = await fetch('/api/admin/refunds', {
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
        throw new Error(payload.error || 'Refund records could not be loaded.');
      }

      setReport(payload as RefundReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Refund records could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (report?.orders || []).filter((order) => {
      const matchesSearch = !term ||
        order.title.toLowerCase().includes(term) ||
        order.student_name.toLowerCase().includes(term) ||
        (order.student_email || '').toLowerCase().includes(term) ||
        order.payment_id.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term);

      const matchesFilter = filter === 'all' ||
        (filter === 'refundable' && order.remaining_paise >= 100 && ['paid', 'partially_refunded'].includes(order.status)) ||
        (filter === 'pending' && (report?.actions || []).some((action) =>
          action.payment_order_id === order.id &&
          action.category === order.category &&
          ['initiating', 'pending', 'review_required'].includes(action.status)
        )) ||
        (filter === 'test' && order.mode === 'test');

      return matchesSearch && matchesFilter;
    });
  }, [report, search, filter]);

  const openRefund = (order: RefundOrder) => {
    setSelectedOrder(order);
    setRefundType('full');
    setPartialAmount('');
    setReason('');
    setRequestSource('student_email');
    setMerchantBalance('');
    setBalanceChecked(false);
    setNotice('');
    setError('');
  };

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedOrder || submitting) return;

    const cleanReason = reason.trim();
    if (cleanReason.length < 3 || cleanReason.length > 1000) {
      setError('Enter a refund reason between 3 and 1,000 characters.');
      return;
    }

    const amountPaise = refundType === 'partial'
      ? Math.round(Number(partialAmount) * 100)
      : selectedOrder.remaining_paise;

    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise > selectedOrder.remaining_paise) {
      setError('Enter a valid refund amount. The minimum is ₹1 and the maximum is the remaining balance.');
      return;
    }

    if (refundType === 'partial' && amountPaise >= selectedOrder.remaining_paise) {
      setError('That amount would refund the complete remaining balance. Select Full refund instead.');
      return;
    }

    const balancePaise = Math.round(Number(merchantBalance) * 100);
    if (
      !balanceChecked ||
      !merchantBalance.trim() ||
      !Number.isSafeInteger(balancePaise) ||
      balancePaise < 0
    ) {
      setError('Enter the current Razorpay available balance for the same mode and confirm that you checked it just now.');
      return;
    }

    if (balancePaise < amountPaise) {
      const shortfallPaise = amountPaise - balancePaise;
      setError(`Insufficient Razorpay balance. Required ${money(amountPaise)}; available ${money(balancePaise)}; shortfall ${money(shortfallPaise)}. No refund was sent.`);
      return;
    }

    const modeLabel = selectedOrder.mode === 'test' ? 'RAZORPAY TEST MODE' : 'LIVE MODE';
    const confirmed = window.confirm(
      `Confirm ${refundType} refund of ${money(amountPaise)} for ${selectedOrder.title}?\n\n${modeLabel}\nStudent: ${selectedOrder.student_name}\nPayment: ${selectedOrder.payment_id}\nAvailable balance checked: ${money(balancePaise)}\n\nThis action sends a refund request to Razorpay.`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          category: selectedOrder.category,
          paymentOrderId: selectedOrder.id,
          refundType,
          amountPaise: refundType === 'partial' ? amountPaise : undefined,
          merchantBalancePaise: balancePaise,
          merchantBalanceChecked: balanceChecked,
          reason: cleanReason,
          requestSource,
        }),
      });
      const payload = await response.json();

      if (!response.ok && !payload.actionId) {
        throw new Error(payload.message || payload.error || 'Razorpay refund could not be initiated.');
      }

      if (payload.status === 'processed') {
        setNotice(`Refund processed: ${money(payload.amountPaise)}. The purchase ledger has been updated.`);
      } else if (payload.status === 'pending') {
        setNotice(`Razorpay accepted the refund of ${money(payload.amountPaise)}. The record will update after Razorpay confirms processing.`);
      } else {
        setError(payload.error || 'The refund requires manual review. Do not initiate a second refund until the provider record is checked.');
      }

      setSelectedOrder(null);
      await loadReport(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Refund could not be initiated.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalRefundable = (report?.orders || []).reduce((sum, order) =>
    sum + (['paid', 'partially_refunded'].includes(order.status) ? order.remaining_paise : 0), 0);
  const pendingActions = (report?.actions || []).filter((action) =>
    ['initiating', 'pending', 'review_required'].includes(action.status)
  ).length;

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN / FINANCE</div>
            <h1>Refund Management</h1>
          </div>
          <button className="admin-logout" onClick={() => void loadReport(true)} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh records'}
          </button>
        </header>

        <div className="refund-intro">
          <div>
            <h2>Admin-controlled customer refunds</h2>
            <p>Students contact EduAxis India by email. Review their payment and initiate an approved full or partial refund from here.</p>
          </div>
          <span className="refund-secure">ADMIN ACCESS ONLY</span>
        </div>

        {!report?.emailConfigured && (
          <div className="refund-email-note">
            <b>Student email delivery is not configured.</b>
            Refund status can still appear in the student's in-app Notification Centre. Add a verified Resend sender and the <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> Production variables to enable email receipts.
          </div>
        )}

        {notice && <div className="refund-success" role="status">{notice}</div>}
        {error && <div className="refund-error" role="alert">{error}</div>}

        {loading ? (
          <div className="refund-loading">Loading verified purchases and refund history…</div>
        ) : report ? (
          <>
            <section className="refund-kpis">
              <article><span>Payment records</span><strong>{report.orders.length.toLocaleString('en-IN')}</strong><small>Captured customer and QA transactions</small></article>
              <article><span>Outstanding refundable balance</span><strong>{money(totalRefundable)}</strong><small>Remaining captured amount across eligible orders</small></article>
              <article><span>Pending / review actions</span><strong>{pendingActions.toLocaleString('en-IN')}</strong><small>Awaiting provider confirmation or manual review</small></article>
            </section>

            <section className="refund-panel">
              <div className="refund-panel-heading">
                <div>
                  <h2>Payment records</h2>
                  <p>Search a student, product, payment ID or order ID. QA test payments are labelled separately from Live customer payments.</p>
                </div>
                <span>{filteredOrders.length} records</span>
              </div>

              <div className="refund-toolbar">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search student, PDF, course, mock test or payment ID…"
                  aria-label="Search payment records"
                />
                <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filter refund records">
                  <option value="refundable">Refundable balances</option>
                  <option value="pending">Pending / review</option>
                  <option value="test">QA test transactions</option>
                  <option value="all">All payment records</option>
                </select>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="refund-empty">No payment records match this filter.</div>
              ) : (
                <div className="refund-table-wrap">
                  <table className="refund-table">
                    <thead>
                      <tr><th>Student / product</th><th>Mode</th><th>Paid</th><th>Refunded</th><th>Remaining</th><th>Payment status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => {
                        const eligible = order.remaining_paise >= 100 && ['paid', 'partially_refunded'].includes(order.status);
                        return (
                          <tr key={order.category + ':' + order.id}>
                            <td>
                              <strong>{order.student_name}</strong>
                              <small>{order.student_email || 'Email unavailable'}</small>
                              <b className="refund-product">{order.title}</b>
                              <small>{order.category_label} · {dateLabel(order.paid_at)}</small>
                            </td>
                            <td><span className={order.mode === 'test' ? 'refund-mode test' : 'refund-mode live'}>{order.mode === 'test' ? 'TEST' : 'LIVE'}</span></td>
                            <td>{money(order.amount_paise)}</td>
                            <td>{money(order.refunded_paise)}</td>
                            <td className="refund-remaining">{money(order.remaining_paise)}</td>
                            <td><span className={'refund-status ' + (order.status === 'refunded' ? 'is-closed' : order.status === 'partially_refunded' ? 'is-partial' : 'is-active')}>{order.status.replaceAll('_', ' ')}</span></td>
                            <td>
                              <button className="refund-open-button" disabled={!eligible} onClick={() => openRefund(order)}>
                                {eligible ? 'Initiate refund' : 'No balance'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="refund-note">QA Test Mode transactions are isolated from live sales reports. Normal customer refunds always use Live Mode credentials. Admin actions are recorded with the administrator, reason, amount and Razorpay refund ID.</p>
            </section>

            <section className="refund-panel">
              <div className="refund-panel-heading">
                <div>
                  <h2>Recent admin refund actions</h2>
                  <p>Provider status is authoritative. A refund marked Pending is not counted as processed until Razorpay confirms it.</p>
                </div>
                <span>{report.actions.length} actions</span>
              </div>

              {report.actions.length === 0 ? (
                <div className="refund-empty">No admin refund actions have been recorded yet.</div>
              ) : (
                <div className="refund-table-wrap">
                  <table className="refund-table">
                    <thead><tr><th>Date</th><th>Student / payment</th><th>Category</th><th>Amount</th><th>Mode</th><th>Balance checked</th><th>Status</th><th>Provider reference</th></tr></thead>
                    <tbody>
                      {report.actions.map((action) => {
                        const order = report.orders.find((item) => item.id === action.payment_order_id && item.category === action.category);
                        return (
                          <tr key={action.id}>
                            <td>{dateLabel(action.created_at)}</td>
                            <td><strong>{order?.student_name || 'Student'}</strong><small>{action.payment_order_id}</small></td>
                            <td>{action.category.replaceAll('_', ' ')}</td>
                            <td>{money(action.amount_paise)}<small>{action.refund_type} refund</small></td>
                            <td><span className={action.mode === 'test' ? 'refund-mode test' : 'refund-mode live'}>{action.mode.toUpperCase()}</span></td>
                            <td>{action.merchant_balance_snapshot_paise === null ? '—' : money(action.merchant_balance_snapshot_paise)}<small>{action.merchant_balance_checked_at ? dateLabel(action.merchant_balance_checked_at) : 'Not captured'}</small></td>
                            <td><span className={'refund-status ' + (action.status === 'processed' ? 'is-closed' : action.status === 'failed' ? 'is-failed' : 'is-pending')}>{actionStatusLabel(action.status)}</span>{action.provider_error && <small className="refund-provider-error">{action.provider_error}</small>}</td>
                            <td>{action.razorpay_refund_id || action.id}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="refund-empty">Refund records are currently unavailable.</div>
        )}

        {selectedOrder && (
          <div className="refund-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setSelectedOrder(null);
          }}>
            <section className="refund-modal" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
              <div className="refund-modal-kicker">{selectedOrder.mode === 'test' ? 'RAZORPAY TEST MODE' : 'RAZORPAY LIVE MODE'}</div>
              <h2 id="refund-modal-title">Initiate customer refund</h2>
              <p className="refund-modal-product">{selectedOrder.title}</p>
              <div className="refund-modal-student">{selectedOrder.student_name} · {selectedOrder.student_email || 'No email on profile'}</div>

              <div className="refund-modal-summary">
                <div><span>Original payment</span><b>{money(selectedOrder.amount_paise)}</b></div>
                <div><span>Already refunded</span><b>{money(selectedOrder.refunded_paise)}</b></div>
                <div><span>Refundable balance</span><b>{money(selectedOrder.remaining_paise)}</b></div>
              </div>

              <form onSubmit={submitRefund}>
                <section className="refund-balance-check">
                  <div className="refund-balance-heading">
                    <b>Razorpay available balance pre-check</b>
                    <span>{selectedOrder.mode === 'test' ? 'Test Mode' : 'Live Mode'}</span>
                  </div>
                  <p>Open the Razorpay Dashboard in the same mode and read your current / available merchant balance. Enter that value below. EduAxis cannot fetch the Payment Gateway balance automatically.</p>
                  <label className="refund-form-label">
                    Available balance in Razorpay (₹)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={merchantBalance}
                      onChange={(event) => {
                        setMerchantBalance(event.target.value);
                        setBalanceChecked(false);
                      }}
                      placeholder="e.g. 500.00"
                      required
                    />
                  </label>
                  {merchantBalance.trim() !== '' && Number.isFinite(Number(merchantBalance)) && Number(merchantBalance) >= 0 && (
                    <div className="refund-balance-math">
                      <span>Required for this refund <b>{money(refundType === 'full' ? selectedOrder.remaining_paise : Math.round(Number(partialAmount) * 100) || 0)}</b></span>
                      <span>Entered available balance <b>{money(Math.round(Number(merchantBalance) * 100))}</b></span>
                      {Math.round(Number(merchantBalance) * 100) < (refundType === 'full' ? selectedOrder.remaining_paise : Math.round(Number(partialAmount) * 100) || 0) && (
                        <strong>Shortfall: {money((refundType === 'full' ? selectedOrder.remaining_paise : Math.round(Number(partialAmount) * 100) || 0) - Math.round(Number(merchantBalance) * 100))}. Refund will be blocked.</strong>
                      )}
                      {Math.round(Number(merchantBalance) * 100) >= (refundType === 'full' ? selectedOrder.remaining_paise : Math.round(Number(partialAmount) * 100) || 0) && (
                        <strong className="refund-balance-enough">Entered balance covers this refund. Final approval remains subject to Razorpay.</strong>
                      )}
                    </div>
                  )}
                  <label className="refund-balance-confirm">
                    <input
                      type="checkbox"
                      checked={balanceChecked}
                      onChange={(event) => setBalanceChecked(event.target.checked)}
                    />
                    I checked the available balance in Razorpay just now and selected the correct {selectedOrder.mode === 'test' ? 'Test' : 'Live'} Mode.
                  </label>
                  <small className="refund-balance-note">This is a manual dashboard snapshot, not a live balance API. The entered amount and check time will be saved in the admin refund history.</small>
                </section>

                <label className="refund-form-label">Refund type</label>
                <div className="refund-type-options">
                  <label><input type="radio" checked={refundType === 'full'} onChange={() => setRefundType('full')} /> Full refund <small>{money(selectedOrder.remaining_paise)}</small></label>
                  <label><input type="radio" checked={refundType === 'partial'} onChange={() => setRefundType('partial')} /> Partial refund</label>
                </div>

                {refundType === 'partial' && (
                  <label className="refund-form-label">
                    Partial amount (₹)
                    <input type="number" min="1" max={(selectedOrder.remaining_paise - 1) / 100} step="0.01" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} placeholder="e.g. 50.00" required />
                  </label>
                )}

                <label className="refund-form-label">
                  Request source
                  <select value={requestSource} onChange={(event) => setRequestSource(event.target.value)}>
                    <option value="student_email">Student email request</option>
                    <option value="support_email">Support email</option>
                    <option value="admin_initiated">Admin initiated</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="refund-form-label">
                  Reason / admin note
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} minLength={3} maxLength={1000} placeholder="Record the student’s email request and the reason for refund approval…" required />
                </label>

                <div className="refund-modal-warning">
                  This sends a real refund request in the selected Razorpay mode. The balance check is manual and may change before Razorpay processes the request. Verify the student request and payment before confirming. Access is revoked only when the complete payment has been refunded and recorded.
                </div>
                <div className="refund-modal-actions">
                  <button type="button" className="refund-cancel-button" onClick={() => setSelectedOrder(null)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="refund-submit-button" disabled={submitting}>
                    {submitting ? 'Submitting…' : `Confirm refund · ${money(refundType === 'full' ? selectedOrder.remaining_paise : Math.round(Number(partialAmount) * 100) || 0)}`}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <footer className="admin-footer">EduAxis India · Learn. Prepare. Progress.</footer>
      </section>

      <style jsx>{`
        .refund-intro{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;padding:26px 0 18px;flex-wrap:wrap}
        .refund-intro h2{font-size:20px;color:#102b46;margin:0 0 6px}
        .refund-intro p{font-size:12px;color:#718392;margin:0;line-height:1.6;max-width:720px}
        .refund-secure{font-size:10px;font-weight:900;letter-spacing:.7px;color:#087f75;background:#e4f5f1;border-radius:20px;padding:8px 12px}
        .refund-email-note,.refund-success,.refund-error{margin:0 0 15px;padding:12px 14px;border-radius:9px;font-size:12px;line-height:1.6}
        .refund-email-note{background:#fff8e9;border:1px solid #f0dfbb;color:#775515}
        .refund-email-note b{display:block;color:#573d0d;margin-bottom:3px}
        .refund-email-note code{font-size:11px}
        .refund-success{background:#ebf8f1;border:1px solid #c6e9d5;color:#12623b}
        .refund-error{background:#fff0ef;border:1px solid #efcfca;color:#a3342e}
        .refund-loading,.refund-empty{background:#fff;border:1px dashed #d7e2e8;border-radius:12px;padding:28px;color:#758898;font-size:13px;text-align:center}
        .refund-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .refund-kpis article{background:#fff;border:1px solid #e1e9ed;border-radius:12px;padding:16px;min-width:0}
        .refund-kpis span{display:block;font-size:10px;color:#718392;font-weight:700}
        .refund-kpis strong{display:block;font-size:clamp(20px,2vw,27px);color:#102b46;margin:9px 0 6px;overflow-wrap:anywhere}
        .refund-kpis small{font-size:9px;line-height:1.5;color:#81919c;display:block}
        .refund-panel{background:#fff;border:1px solid #e1e9ed;border-radius:13px;padding:20px;margin-top:16px;min-width:0}
        .refund-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}
        .refund-panel-heading h2{margin:0 0 5px;font-size:16px;color:#102b46}
        .refund-panel-heading p{margin:0;font-size:11px;color:#718392;line-height:1.55}
        .refund-panel-heading>span{font-size:10px;color:#087f75;font-weight:800}
        .refund-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:10px;margin-bottom:15px}
        .refund-toolbar input,.refund-toolbar select{min-width:0;width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #d8e3e7;border-radius:8px;background:#fff;color:#20384b;font:inherit;font-size:12px}
        .refund-table-wrap{width:100%;overflow:auto}
        .refund-table{width:100%;border-collapse:collapse;min-width:940px}
        .refund-table th{text-align:left;padding:11px 10px;background:#f4f7f9;color:#64788a;font-size:10px;white-space:nowrap}
        .refund-table td{padding:12px 10px;border-bottom:1px solid #edf1f3;color:#334b5d;font-size:11px;vertical-align:middle}
        .refund-table td strong,.refund-table td small,.refund-table td .refund-product{display:block}
        .refund-table td strong{font-size:12px;color:#17334d}
        .refund-table td small{font-size:9px;color:#84939e;margin-top:3px;overflow-wrap:anywhere}
        .refund-table td .refund-product{font-size:10px;color:#476174;margin-top:7px}
        .refund-remaining{font-weight:900;color:#102d49!important}
        .refund-mode{display:inline-flex;align-items:center;border-radius:20px;padding:5px 8px;font-size:9px;font-weight:900;letter-spacing:.4px}
        .refund-mode.live{background:#e7f5ed;color:#167347}
        .refund-mode.test{background:#e9f1ff;color:#285da4}
        .refund-status{display:inline-flex;padding:5px 7px;border-radius:6px;font-size:9px;font-weight:800;text-transform:capitalize;white-space:nowrap}
        .refund-status.is-active,.refund-status.is-closed{background:#e7f5ed;color:#167347}
        .refund-status.is-partial{background:#fff2d8;color:#8d5e0a}
        .refund-status.is-pending{background:#fff2d8;color:#8d5e0a}
        .refund-status.is-failed{background:#fff0ef;color:#a3342e}
        .refund-status.is-closed{background:#eef1f3;color:#647585}
        .refund-provider-error{max-width:220px;color:#a3342e!important}
        .refund-open-button{border:0;border-radius:7px;padding:8px 10px;background:#102d49;color:#fff;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
        .refund-open-button:disabled{background:#edf1f3;color:#8796a0;cursor:not-allowed}
        .refund-note{margin:13px 0 0;color:#83919b;font-size:9px;line-height:1.5}
        .refund-modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(8,25,40,.56);display:flex;align-items:center;justify-content:center;padding:18px}
        .refund-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:25px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
        .refund-modal-kicker{font-size:10px;font-weight:900;letter-spacing:.8px;color:#087f75}
        .refund-modal h2{margin:8px 0 5px;font-size:22px;color:#102d49}
        .refund-modal-product{font-weight:800;font-size:14px;color:#294960;margin:0 0 4px}
        .refund-modal-student{font-size:11px;color:#7a8c99;margin-bottom:16px;overflow-wrap:anywhere}
        .refund-modal-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0 20px}
        .refund-modal-summary div{padding:11px;background:#f4f7f9;border:1px solid #e2e9ed;border-radius:9px;min-width:0}
        .refund-modal-summary span,.refund-modal-summary b{display:block}
        .refund-modal-summary span{font-size:9px;color:#788a98;margin-bottom:5px}
        .refund-modal-summary b{font-size:13px;color:#14324c;overflow-wrap:anywhere}
        .refund-form-label{display:flex;flex-direction:column;gap:7px;margin:13px 0;color:#2d465b;font-size:11px;font-weight:800}
        .refund-form-label input,.refund-form-label select,.refund-form-label textarea{width:100%;box-sizing:border-box;border:1px solid #d7e2e8;border-radius:8px;padding:11px 12px;font:inherit;font-size:12px;font-weight:400;color:#17334d;background:#fff}
        .refund-form-label textarea{resize:vertical;line-height:1.5}
        .refund-type-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}
        .refund-type-options label{display:flex;align-items:center;gap:7px;padding:11px;border:1px solid #dce5ea;border-radius:8px;color:#244258;font-size:11px;font-weight:800;cursor:pointer}
        .refund-type-options input{accent-color:#0b887d}
        .refund-balance-check{padding:14px;margin:15px 0;background:#f2f7fa;border:1px solid #d8e5ec;border-radius:10px}
        .refund-balance-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;color:#17344c;font-size:12px}
        .refund-balance-heading span{font-size:9px;font-weight:900;letter-spacing:.4px;color:#0b8278;background:#e1f4ef;padding:5px 8px;border-radius:20px}
        .refund-balance-check>p{font-size:10px;color:#6f8493;line-height:1.55;margin:7px 0 10px}
        .refund-balance-math{display:grid;gap:7px;margin:9px 0;padding:10px;background:#fff;border:1px solid #e0e8ed;border-radius:8px}
        .refund-balance-math span{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:#687d8c}
        .refund-balance-math b{color:#18364f}
        .refund-balance-math>strong{font-size:10px;color:#a53b32;line-height:1.5}
        .refund-balance-math>strong.refund-balance-enough{color:#167347}
        .refund-balance-confirm{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:10px;line-height:1.5;color:#29465e;cursor:pointer}
        .refund-balance-confirm input{margin-top:1px;accent-color:#0b887d}
        .refund-balance-note{display:block;margin-top:9px;font-size:9px;color:#84939e;line-height:1.5}
        .refund-type-options small{margin-left:auto;color:#728592;font-weight:700}
        .refund-modal-warning{padding:11px 12px;margin:15px 0;background:#fff8e9;border:1px solid #efdfbf;border-radius:8px;color:#775515;font-size:10px;line-height:1.55}
        .refund-modal-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:17px}
        .refund-cancel-button,.refund-submit-button{border-radius:8px;padding:10px 14px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
        .refund-cancel-button{background:#fff;border:1px solid #d3dfe6;color:#526a7e}
        .refund-submit-button{background:#0b887d;border:1px solid #0b887d;color:#fff}
        .refund-cancel-button:disabled,.refund-submit-button:disabled{opacity:.55;cursor:wait}
        @media(max-width:900px){.refund-kpis{grid-template-columns:1fr}.refund-toolbar{grid-template-columns:1fr}}
        @media(max-width:520px){.refund-modal{padding:18px}.refund-modal-summary{grid-template-columns:1fr}.refund-type-options{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
