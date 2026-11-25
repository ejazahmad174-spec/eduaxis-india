-- Admin-only refund management audit trail.
-- Product-specific payment/refund ledgers remain the source of truth.

CREATE TABLE IF NOT EXISTS public.admin_refund_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL
    CHECK (category IN ('mock_test', 'course', 'study_material', 'qa_study_material')),
  payment_order_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  razorpay_payment_id text NOT NULL,
  mode text NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
  refund_type text NOT NULL CHECK (refund_type IN ('partial', 'full')),
  amount_paise bigint NOT NULL CHECK (amount_paise >= 100),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
  request_source text NOT NULL DEFAULT 'student_email'
    CHECK (request_source IN ('student_email', 'admin_initiated', 'support_email', 'other')),
  source_reference text,
  status text NOT NULL DEFAULT 'initiating'
    CHECK (status IN ('initiating', 'pending', 'processed', 'failed', 'review_required')),
  razorpay_refund_id text UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  provider_error_code text,
  provider_error text,
  initiated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_refund_actions_created
ON public.admin_refund_actions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_refund_actions_student
ON public.admin_refund_actions (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_refund_actions_payment
ON public.admin_refund_actions (category, payment_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_refund_actions_status
ON public.admin_refund_actions (status, created_at DESC);

ALTER TABLE public.admin_refund_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_refund_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_refund_actions TO service_role;

ALTER TABLE public.student_notifications
ADD COLUMN IF NOT EXISTS source_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_notifications_source_reference
ON public.student_notifications (source_reference)
WHERE source_reference IS NOT NULL;
