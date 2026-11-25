CREATE OR REPLACE FUNCTION public.reserve_study_material_qa_refund(
  p_payment_order_id uuid,
  p_refund_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.study_material_qa_payment_orders%ROWTYPE;
  v_existing public.study_material_qa_refund_requests%ROWTYPE;
  v_total_refunded bigint;
  v_remaining bigint;
  v_amount bigint;
  v_new_request_id uuid;
BEGIN
  IF p_payment_order_id IS NULL OR p_refund_type NOT IN ('partial', 'full') THEN
    RAISE EXCEPTION 'Invalid QA refund request.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.study_material_qa_payment_orders
  WHERE id = p_payment_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'QA payment is not eligible for another refund.';
  END IF;

  SELECT COALESCE(SUM(amount_paise), 0)
  INTO v_total_refunded
  FROM public.study_material_qa_payment_refunds
  WHERE payment_order_id = p_payment_order_id;

  v_remaining := v_order.amount_paise - v_total_refunded;
  IF v_remaining < 100 THEN
    RAISE EXCEPTION 'No refundable balance remains.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.study_material_qa_refund_requests
  WHERE payment_order_id = p_payment_order_id
    AND refund_type = p_refund_type
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'failed' THEN
      IF v_existing.razorpay_refund_id IS NOT NULL THEN
        RAISE EXCEPTION 'A provider refund already exists for this failed request; reconcile it before retrying.';
      END IF;

      v_new_request_id := gen_random_uuid();

      UPDATE public.study_material_qa_refund_requests
      SET id = v_new_request_id,
          status = 'reserved',
          updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_existing;

      RETURN jsonb_build_object(
        'success', true,
        'request_id', v_existing.id,
        'amount_paise', v_existing.amount_paise,
        'status', v_existing.status,
        'razorpay_refund_id', v_existing.razorpay_refund_id,
        'reused', true,
        'retry', true,
        'new_idempotency_key', true
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'request_id', v_existing.id,
      'amount_paise', v_existing.amount_paise,
      'status', v_existing.status,
      'razorpay_refund_id', v_existing.razorpay_refund_id,
      'reused', true
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.study_material_qa_refund_requests
    WHERE payment_order_id = p_payment_order_id
      AND status IN ('reserved', 'pending')
  ) THEN
    RAISE EXCEPTION 'Another QA refund is still processing.';
  END IF;

  IF p_refund_type = 'partial' THEN
    IF v_total_refunded > 0 THEN
      RAISE EXCEPTION 'The QA partial refund has already been applied.';
    END IF;
    v_amount := 2500;
    IF v_amount >= v_remaining THEN
      RAISE EXCEPTION 'Partial QA refund amount is not valid for this balance.';
    END IF;
  ELSE
    v_amount := v_remaining;
  END IF;

  INSERT INTO public.study_material_qa_refund_requests (
    payment_order_id, refund_type, amount_paise, status
  )
  VALUES (
    p_payment_order_id, p_refund_type, v_amount, 'reserved'
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_existing.id,
    'amount_paise', v_existing.amount_paise,
    'status', v_existing.status,
    'razorpay_refund_id', v_existing.razorpay_refund_id,
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_study_material_qa_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_study_material_qa_refund(uuid, text) TO service_role;
