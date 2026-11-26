-- Restrict mock-test creation and deletion to authenticated administrators.
-- The functions use a fixed empty search_path and fully-qualified object names.

CREATE OR REPLACE FUNCTION public.admin_create_mock_test(
  p_title text,
  p_title_hi text,
  p_exam_category text,
  p_duration_minutes integer,
  p_total_marks numeric,
  p_access_type text,
  p_price numeric,
  p_negative_marking numeric,
  p_pass_marks numeric,
  p_instructions text,
  p_instructions_hi text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_test jsonb;
  v_price numeric;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = v_admin_id
      AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required to create mock tests.'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(p_title), '') IS NULL
     OR nullif(btrim(p_title_hi), '') IS NULL
     OR nullif(btrim(p_exam_category), '') IS NULL THEN
    RAISE EXCEPTION 'English title, Hindi title and test series are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0
     OR p_total_marks IS NULL OR p_total_marks <= 0 THEN
    RAISE EXCEPTION 'Duration and total marks must be greater than zero.'
      USING ERRCODE = '22023';
  END IF;

  IF p_negative_marking IS NULL OR p_negative_marking < 0 THEN
    RAISE EXCEPTION 'Negative marking cannot be less than zero.'
      USING ERRCODE = '22023';
  END IF;

  IF p_pass_marks IS NOT NULL AND
     (p_pass_marks < 0 OR p_pass_marks > p_total_marks) THEN
    RAISE EXCEPTION 'Pass marks must be between zero and total marks.'
      USING ERRCODE = '22023';
  END IF;

  IF p_access_type NOT IN ('free', 'paid') THEN
    RAISE EXCEPTION 'Access type must be free or paid.'
      USING ERRCODE = '22023';
  END IF;

  IF p_access_type = 'paid' THEN
    IF p_price IS NULL OR p_price <= 0 THEN
      RAISE EXCEPTION 'A paid test must have a price greater than zero.'
        USING ERRCODE = '22023';
    END IF;
    v_price := p_price;
  ELSE
    v_price := 0;
  END IF;

  INSERT INTO public.mock_tests (
    title,
    title_hi,
    exam_category,
    duration_minutes,
    total_marks,
    access_type,
    price,
    negative_marking,
    pass_marks,
    instructions,
    instructions_hi,
    status,
    created_by
  )
  VALUES (
    btrim(p_title),
    btrim(p_title_hi),
    btrim(p_exam_category),
    p_duration_minutes,
    p_total_marks,
    p_access_type,
    v_price,
    p_negative_marking,
    p_pass_marks,
    p_instructions,
    p_instructions_hi,
    'draft',
    v_admin_id
  )
  RETURNING to_jsonb(mock_tests) INTO v_test;

  RETURN v_test;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_mock_test(
  text, text, text, integer, numeric, text, numeric, numeric, numeric, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_mock_test(
  text, text, text, integer, numeric, text, numeric, numeric, numeric, text, text
) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_delete_mock_test(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_test_status text;
  v_payment_count integer;
  v_purchase_count integer;
  v_attempt_count integer;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = v_admin_id
      AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required to delete mock tests.'
      USING ERRCODE = '42501';
  END IF;

  SELECT test.status
  INTO v_test_status
  FROM public.mock_tests AS test
  WHERE test.id = p_test_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock test not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_test_status = 'published' THEN
    RAISE EXCEPTION 'Unpublish this test before deleting it.'
      USING ERRCODE = '55000';
  END IF;

  SELECT count(*)::integer
  INTO v_payment_count
  FROM public.payment_orders
  WHERE mock_test_id = p_test_id;

  SELECT count(*)::integer
  INTO v_purchase_count
  FROM public.mock_test_purchases
  WHERE mock_test_id = p_test_id;

  SELECT count(*)::integer
  INTO v_attempt_count
  FROM public.mock_test_attempts
  WHERE mock_test_id = p_test_id;

  IF v_payment_count > 0 OR v_purchase_count > 0 THEN
    RAISE EXCEPTION 'This test has payment or purchase history and cannot be deleted. Keep it as a draft or contact support for a data-retention review.'
      USING ERRCODE = '55000';
  END IF;

  IF v_attempt_count > 0 THEN
    RAISE EXCEPTION 'This test has student attempt records and cannot be deleted. Keep it as a draft to preserve student history.'
      USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.mock_tests
  WHERE id = p_test_id;

  -- mock_test_questions are removed by the existing ON DELETE CASCADE FK.
  RETURN jsonb_build_object(
    'deleted', true,
    'test_id', p_test_id,
    'questions_deleted', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_mock_test(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_mock_test(uuid)
  TO authenticated;
