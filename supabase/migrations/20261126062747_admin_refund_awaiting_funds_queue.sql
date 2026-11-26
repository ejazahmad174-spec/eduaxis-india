ALTER TABLE public.admin_refund_actions
  DROP CONSTRAINT IF EXISTS admin_refund_actions_status_check;

ALTER TABLE public.admin_refund_actions
  ADD CONSTRAINT admin_refund_actions_status_check
  CHECK (
    status = ANY (ARRAY[
      'initiating',
      'pending',
      'processed',
      'failed',
      'review_required',
      'awaiting_funds'
    ]::text[])
  );
