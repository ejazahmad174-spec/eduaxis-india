-- Isolated Razorpay Test Mode ledger for premium study-material QA.
-- These records are never included in real sales reports or live entitlements.

CREATE TABLE IF NOT EXISTS public.study_material_qa_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  study_material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE RESTRICT,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'partially_refunded', 'refunded')),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  refunded_paise bigint NOT NULL DEFAULT 0 CHECK (refunded_paise >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (refunded_paise <= amount_paise)
);

CREATE UNIQUE INDEX IF NOT EXISTS study_material_qa_one_pending_per_user_material
ON public.study_material_qa_payment_orders (user_id, study_material_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_study_material_qa_payment_orders_user
ON public.study_material_qa_payment_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.study_material_qa_payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid NOT NULL
    REFERENCES public.study_material_qa_payment_orders(id) ON DELETE RESTRICT,
  razorpay_refund_id text NOT NULL UNIQUE,
  razorpay_payment_id text NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_material_qa_payment_refunds_order
ON public.study_material_qa_payment_refunds (payment_order_id);

ALTER TABLE public.study_material_qa_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_material_qa_payment_refunds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.study_material_qa_payment_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.study_material_qa_payment_refunds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.study_material_qa_payment_orders TO service_role;
GRANT ALL ON TABLE public.study_material_qa_payment_refunds TO service_role;

CREATE OR REPLACE FUNCTION public.activate_study_material_qa_payment(
  p_payment_order_id uuid,
  p_razorpay_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.study_material_qa_payment_orders%ROWTYPE;
BEGIN
  IF p_payment_order_id IS NULL
     OR p_razorpay_payment_id IS NULL
     OR btrim(p_razorpay_payment_id) = '' THEN
    RAISE EXCEPTION 'Invalid QA payment details.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.study_material_qa_payment_orders
  WHERE id = p_payment_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QA payment order not found.';
  END IF;

  IF v_order.status = 'refunded' OR v_order.status = 'failed' THEN
    RAISE EXCEPTION 'This QA payment order is no longer active.';
  END IF;

  IF v_order.razorpay_payment_id IS NOT NULL
     AND v_order.razorpay_payment_id <> p_razorpay_payment_id THEN
    RAISE EXCEPTION 'QA payment ID does not match the order.';
  END IF;

  UPDATE public.study_material_qa_payment_orders
  SET status = CASE
        WHEN refunded_paise > 0 THEN 'partially_refunded'
        ELSE 'paid'
      END,
      razorpay_payment_id = p_razorpay_payment_id,
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = p_payment_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_activated', v_order.razorpay_payment_id = p_razorpay_payment_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_study_material_qa_refund(
  p_refund_id text,
  p_payment_id text,
  p_amount_paise bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.study_material_qa_payment_orders%ROWTYPE;
  v_existing public.study_material_qa_payment_refunds%ROWTYPE;
  v_total_refunded bigint;
  v_inserted integer;
BEGIN
  IF p_refund_id IS NULL OR btrim(p_refund_id) = ''
     OR p_payment_id IS NULL OR btrim(p_payment_id) = ''
     OR p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Invalid QA refund details.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.study_material_qa_payment_orders
  WHERE razorpay_payment_id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status NOT IN ('paid', 'partially_refunded', 'refunded') THEN
    RAISE EXCEPTION 'QA payment order is not eligible for refund processing.';
  END IF;

  INSERT INTO public.study_material_qa_payment_refunds (
    payment_order_id, razorpay_refund_id, razorpay_payment_id, amount_paise
  )
  VALUES (v_order.id, p_refund_id, p_payment_id, p_amount_paise)
  ON CONFLICT (razorpay_refund_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
    INTO v_existing
    FROM public.study_material_qa_payment_refunds
    WHERE razorpay_refund_id = p_refund_id;

    IF NOT FOUND
       OR v_existing.payment_order_id <> v_order.id
       OR v_existing.razorpay_payment_id <> p_payment_id
       OR v_existing.amount_paise <> p_amount_paise THEN
      RAISE EXCEPTION 'Existing QA refund record does not match.';
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount_paise), 0)
  INTO v_total_refunded
  FROM public.study_material_qa_payment_refunds
  WHERE payment_order_id = v_order.id;

  IF v_total_refunded > v_order.amount_paise THEN
    RAISE EXCEPTION 'Total QA refunds exceed the test payment amount.';
  END IF;

  UPDATE public.study_material_qa_payment_orders
  SET refunded_paise = v_total_refunded,
      status = CASE
        WHEN v_total_refunded >= amount_paise THEN 'refunded'
        ELSE 'partially_refunded'
      END,
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'fully_refunded', v_total_refunded >= v_order.amount_paise,
    'total_refunded_paise', v_total_refunded
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_study_material_qa_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_study_material_qa_payment(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.process_study_material_qa_refund(text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_study_material_qa_refund(text, text, bigint) TO service_role;
