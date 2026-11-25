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

  -- A late captured event may legitimately follow payment.failed.
  -- A verified capture can recover a failed order, but never a fully refunded one.
  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'This QA payment order has been fully refunded.';
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
    'already_activated', v_order.razorpay_payment_id = p_razorpay_payment_id,
    'recovered_from_failed', v_order.status = 'failed'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_study_material_qa_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_study_material_qa_payment(uuid, text) TO service_role;
