-- Paid study-material purchases, entitlements and refund ledger.
CREATE TABLE IF NOT EXISTS public.study_material_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  study_material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE RESTRICT,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS study_material_one_pending_order_per_user_material
ON public.study_material_payment_orders (user_id, study_material_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_study_material_payment_orders_user
ON public.study_material_payment_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_material_payment_orders_material
ON public.study_material_payment_orders (study_material_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.study_material_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  study_material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE RESTRICT,
  payment_order_id uuid NOT NULL UNIQUE
    REFERENCES public.study_material_payment_orders(id) ON DELETE RESTRICT,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_material_purchases_user_material_key
    UNIQUE (user_id, study_material_id)
);

CREATE INDEX IF NOT EXISTS idx_study_material_purchases_user
ON public.study_material_purchases (user_id);

CREATE INDEX IF NOT EXISTS idx_study_material_purchases_material
ON public.study_material_purchases (study_material_id);

CREATE TABLE IF NOT EXISTS public.study_material_payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid NOT NULL
    REFERENCES public.study_material_payment_orders(id) ON DELETE RESTRICT,
  razorpay_refund_id text NOT NULL UNIQUE,
  razorpay_payment_id text NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  status text NOT NULL DEFAULT 'processed' CHECK (status = 'processed'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_material_payment_refunds_order
ON public.study_material_payment_refunds (payment_order_id);

ALTER TABLE public.study_material_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_material_payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own study material payment orders"
ON public.study_material_payment_orders;
CREATE POLICY "Students view own study material payment orders"
ON public.study_material_payment_orders
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Students view own study material purchases"
ON public.study_material_purchases;
CREATE POLICY "Students view own study material purchases"
ON public.study_material_purchases
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Students view own study material refunds"
ON public.study_material_payment_refunds;
CREATE POLICY "Students view own study material refunds"
ON public.study_material_payment_refunds
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.study_material_payment_orders o
    WHERE o.id = payment_order_id
      AND o.user_id = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE public.study_material_payment_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.study_material_purchases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.study_material_payment_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.study_material_payment_orders TO authenticated;
GRANT SELECT ON TABLE public.study_material_purchases TO authenticated;
GRANT SELECT ON TABLE public.study_material_payment_refunds TO authenticated;
GRANT ALL ON TABLE public.study_material_payment_orders TO service_role;
GRANT ALL ON TABLE public.study_material_purchases TO service_role;
GRANT ALL ON TABLE public.study_material_payment_refunds TO service_role;

CREATE OR REPLACE FUNCTION public.activate_study_material_purchase(
  p_payment_order_id uuid,
  p_razorpay_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.study_material_payment_orders%ROWTYPE;
  v_purchase public.study_material_purchases%ROWTYPE;
  v_previous_status text;
BEGIN
  IF p_payment_order_id IS NULL
     OR p_razorpay_payment_id IS NULL
     OR btrim(p_razorpay_payment_id) = '' THEN
    RAISE EXCEPTION 'Invalid payment details.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.study_material_payment_orders
  WHERE id = p_payment_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study material payment order not found.';
  END IF;

  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'This payment order has been refunded.';
  END IF;

  IF v_order.razorpay_payment_id IS NOT NULL
     AND v_order.razorpay_payment_id <> p_razorpay_payment_id THEN
    RAISE EXCEPTION 'Payment ID does not match the existing record.';
  END IF;

  UPDATE public.study_material_payment_orders
  SET status = 'paid',
      razorpay_payment_id = p_razorpay_payment_id,
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = p_payment_order_id;

  SELECT *
  INTO v_purchase
  FROM public.study_material_purchases
  WHERE user_id = v_order.user_id
    AND study_material_id = v_order.study_material_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_purchase.payment_order_id = p_payment_order_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_activated', true,
        'message', 'Study material access is already active.'
      );
    END IF;

    SELECT status
    INTO v_previous_status
    FROM public.study_material_payment_orders
    WHERE id = v_purchase.payment_order_id;

    IF v_previous_status IS DISTINCT FROM 'refunded' THEN
      RETURN jsonb_build_object(
        'success', false,
        'requires_review', true,
        'message', 'This student already has an active purchase. Manual review is required.'
      );
    END IF;

    UPDATE public.study_material_purchases
    SET payment_order_id = p_payment_order_id,
        purchased_at = now()
    WHERE id = v_purchase.id;

    RETURN jsonb_build_object(
      'success', true,
      'already_activated', false,
      'repurchased', true,
      'message', 'New payment confirmed and study material access reactivated.'
    );
  END IF;

  INSERT INTO public.study_material_purchases (
    user_id, study_material_id, payment_order_id
  )
  VALUES (
    v_order.user_id, v_order.study_material_id, v_order.id
  )
  ON CONFLICT (user_id, study_material_id) DO NOTHING;

  SELECT *
  INTO v_purchase
  FROM public.study_material_purchases
  WHERE user_id = v_order.user_id
    AND study_material_id = v_order.study_material_id;

  IF FOUND AND v_purchase.payment_order_id = p_payment_order_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_activated', false,
      'message', 'Payment confirmed and study material access activated.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'requires_review', true,
    'message', 'Payment recorded, but purchase activation needs manual review.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_study_material_refund(
  p_refund_id text,
  p_payment_id text,
  p_amount_paise bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.study_material_payment_orders%ROWTYPE;
  v_existing public.study_material_payment_refunds%ROWTYPE;
  v_total_refunded bigint;
  v_inserted integer;
BEGIN
  IF p_refund_id IS NULL OR btrim(p_refund_id) = ''
     OR p_payment_id IS NULL OR btrim(p_payment_id) = ''
     OR p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Invalid refund details.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.study_material_payment_orders
  WHERE razorpay_payment_id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study material payment order not found.';
  END IF;

  IF v_order.status NOT IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'Payment order is not eligible for refund processing.';
  END IF;

  INSERT INTO public.study_material_payment_refunds (
    payment_order_id,
    razorpay_refund_id,
    razorpay_payment_id,
    amount_paise,
    status
  )
  VALUES (
    v_order.id,
    p_refund_id,
    p_payment_id,
    p_amount_paise,
    'processed'
  )
  ON CONFLICT (razorpay_refund_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT *
    INTO v_existing
    FROM public.study_material_payment_refunds
    WHERE razorpay_refund_id = p_refund_id;

    IF NOT FOUND
       OR v_existing.payment_order_id <> v_order.id
       OR v_existing.razorpay_payment_id <> p_payment_id
       OR v_existing.amount_paise <> p_amount_paise THEN
      RAISE EXCEPTION 'Existing refund record does not match.';
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount_paise), 0)
  INTO v_total_refunded
  FROM public.study_material_payment_refunds
  WHERE payment_order_id = v_order.id
    AND status = 'processed';

  IF v_total_refunded > v_order.amount_paise THEN
    RAISE EXCEPTION 'Total refunds exceed original payment amount.';
  END IF;

  IF v_total_refunded >= v_order.amount_paise THEN
    UPDATE public.study_material_payment_orders
    SET status = 'refunded',
        updated_at = now()
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
      'success', true,
      'fully_refunded', true,
      'total_refunded_paise', v_total_refunded,
      'message', 'Full refund recorded. Study material access revoked.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fully_refunded', false,
    'total_refunded_paise', v_total_refunded,
    'message', 'Partial refund recorded. Study material access remains active.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_study_material_purchase(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_study_material_purchase(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.process_study_material_refund(text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_study_material_refund(text, text, bigint) TO service_role;
