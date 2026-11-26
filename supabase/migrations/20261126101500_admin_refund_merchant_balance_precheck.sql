ALTER TABLE public.admin_refund_actions
  ADD COLUMN IF NOT EXISTS merchant_balance_snapshot_paise bigint,
  ADD COLUMN IF NOT EXISTS merchant_balance_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_balance_source text;

ALTER TABLE public.admin_refund_actions
  DROP CONSTRAINT IF EXISTS admin_refund_actions_balance_snapshot_check;

ALTER TABLE public.admin_refund_actions
  ADD CONSTRAINT admin_refund_actions_balance_snapshot_check
  CHECK (
    (merchant_balance_snapshot_paise IS NULL AND merchant_balance_checked_at IS NULL AND merchant_balance_source IS NULL)
    OR
    (merchant_balance_snapshot_paise >= 0
      AND merchant_balance_checked_at IS NOT NULL
      AND merchant_balance_source = 'razorpay_dashboard_manual')
  );
