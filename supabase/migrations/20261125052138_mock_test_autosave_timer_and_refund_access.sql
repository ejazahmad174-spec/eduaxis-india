-- Adds a fixed server-side deadline, in-progress answer persistence,
-- safe attempt resumption, deadline scoring, and refunded purchase reactivation.

ALTER TABLE public.mock_test_attempts
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.mock_test_attempts a
SET expires_at = a.started_at + (COALESCE(t.duration_minutes, 60) * INTERVAL '1 minute')
FROM public.mock_tests t
WHERE t.id = a.mock_test_id
  AND a.expires_at IS NULL;

ALTER TABLE public.mock_test_attempts
  ALTER COLUMN expires_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.start_mock_test(p_mock_test_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_student_id uuid;
    v_test public.mock_tests%ROWTYPE;
    v_attempt public.mock_test_attempts%ROWTYPE;
    v_total_marks numeric(8,2);
    v_questions jsonb;
    v_saved_answers jsonb;
    v_has_purchase boolean := false;
    v_resumed boolean := false;
BEGIN
    v_student_id := auth.uid();

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Please log in to start the test.';
    END IF;

    SELECT *
    INTO v_test
    FROM public.mock_tests
    WHERE id = p_mock_test_id
      AND status = 'published';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'This test is unavailable.';
    END IF;

    IF v_test.duration_minutes IS NULL OR v_test.duration_minutes <= 0 THEN
        RAISE EXCEPTION 'The test duration is not configured correctly.';
    END IF;

    IF v_test.access_type = 'paid' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.mock_test_purchases p
            JOIN public.payment_orders po
              ON po.id = p.payment_order_id
            WHERE p.student_id = v_student_id
              AND p.mock_test_id = p_mock_test_id
              AND po.student_id = v_student_id
              AND po.mock_test_id = p_mock_test_id
              AND po.status = 'paid'
              AND po.razorpay_payment_id IS NOT NULL
        )
        INTO v_has_purchase;

        IF NOT v_has_purchase THEN
            RAISE EXCEPTION 'Please purchase this test before starting.';
        END IF;
    ELSIF v_test.access_type <> 'free' THEN
        RAISE EXCEPTION 'This test is unavailable.';
    END IF;

    SELECT COALESCE(SUM(marks), 0)
    INTO v_total_marks
    FROM public.mock_test_questions
    WHERE mock_test_id = p_mock_test_id;

    IF v_total_marks <= 0 THEN
        RAISE EXCEPTION 'This test does not have any questions yet.';
    END IF;

    -- Serialise start requests for the same student and test so a refresh or
    -- double-click cannot create two concurrent attempts.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext(v_student_id::text),
        pg_catalog.hashtext(p_mock_test_id::text)
    );

    SELECT *
    INTO v_attempt
    FROM public.mock_test_attempts
    WHERE mock_test_id = p_mock_test_id
      AND student_id = v_student_id
      AND status = 'in_progress'
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        v_resumed := true;
    ELSE
        INSERT INTO public.mock_test_attempts (
            mock_test_id,
            student_id,
            total_marks,
            status,
            expires_at
        )
        VALUES (
            p_mock_test_id,
            v_student_id,
            v_total_marks,
            'in_progress',
            clock_timestamp() + (v_test.duration_minutes * INTERVAL '1 minute')
        )
        RETURNING * INTO v_attempt;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', q.id,
                'question_text', q.question_text,
                'question_text_hi', COALESCE(q.question_text_hi, q.question_text),
                'options', q.options,
                'options_hi', COALESCE(q.options_hi, q.options),
                'marks', q.marks,
                'sort_order', q.sort_order
            )
            ORDER BY q.sort_order
        ),
        '[]'::jsonb
    )
    INTO v_questions
    FROM public.mock_test_questions q
    WHERE q.mock_test_id = p_mock_test_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'question_id', a.question_id,
                'selected_option', a.selected_option
            )
            ORDER BY q.sort_order
        ),
        '[]'::jsonb
    )
    INTO v_saved_answers
    FROM public.mock_test_answers a
    JOIN public.mock_test_questions q
      ON q.id = a.question_id
     AND q.mock_test_id = p_mock_test_id
    WHERE a.attempt_id = v_attempt.id
      AND a.selected_option IS NOT NULL;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt.id,
        'test_title', v_test.title,
        'test_title_hi', COALESCE(v_test.title_hi, v_test.title),
        'instructions', v_test.instructions,
        'instructions_hi', COALESCE(v_test.instructions_hi, v_test.instructions),
        'duration_minutes', v_test.duration_minutes,
        'total_marks', v_attempt.total_marks,
        'negative_marking', v_test.negative_marking,
        'expires_at', v_attempt.expires_at,
        'remaining_seconds', GREATEST(
            0,
            CEIL(EXTRACT(EPOCH FROM (v_attempt.expires_at - clock_timestamp())))
        )::integer,
        'resumed', v_resumed,
        'saved_answers', v_saved_answers,
        'questions', v_questions
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_mock_test_answer(p_attempt_id uuid, p_question_id uuid, p_selected_option text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_student_id uuid;
    v_attempt public.mock_test_attempts%ROWTYPE;
BEGIN
    v_student_id := auth.uid();

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Please log in to save your answer.';
    END IF;

    IF p_attempt_id IS NULL OR p_question_id IS NULL THEN
        RAISE EXCEPTION 'Invalid examination answer.';
    END IF;

    IF p_selected_option IS NOT NULL
       AND p_selected_option NOT IN ('A', 'B', 'C', 'D') THEN
        RAISE EXCEPTION 'Invalid answer option.';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.mock_test_attempts
    WHERE id = p_attempt_id
      AND student_id = v_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test attempt not found.';
    END IF;

    IF v_attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'This test attempt is no longer active.';
    END IF;

    IF v_attempt.expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'The examination time has expired.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.mock_test_questions q
        WHERE q.id = p_question_id
          AND q.mock_test_id = v_attempt.mock_test_id
    ) THEN
        RAISE EXCEPTION 'This question does not belong to the test attempt.';
    END IF;

    INSERT INTO public.mock_test_answers (
        attempt_id,
        question_id,
        selected_option,
        is_correct,
        awarded_marks
    )
    VALUES (
        p_attempt_id,
        p_question_id,
        p_selected_option,
        NULL,
        NULL
    )
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
        selected_option = EXCLUDED.selected_option,
        is_correct = NULL,
        awarded_marks = NULL;

    RETURN jsonb_build_object('saved', true);
END;
$function$
;

REVOKE ALL ON FUNCTION public.save_mock_test_answer(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_mock_test_answer(uuid, uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_mock_test(p_attempt_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_student_id uuid;
    v_attempt public.mock_test_attempts%ROWTYPE;
    v_test public.mock_tests%ROWTYPE;
    v_question RECORD;
    v_selected text;
    v_correct boolean;
    v_awarded numeric(8,2);
    v_score numeric(8,2) := 0;
    v_total numeric(8,2) := 0;
    v_review jsonb;
    v_expired boolean := false;
    v_answer_found boolean;
BEGIN
    v_student_id := auth.uid();

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Please log in to submit the test.';
    END IF;

    IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
        RAISE EXCEPTION 'Invalid answer data.';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.mock_test_attempts
    WHERE id = p_attempt_id
      AND student_id = v_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test attempt not found.';
    END IF;

    SELECT *
    INTO v_test
    FROM public.mock_tests
    WHERE id = v_attempt.mock_test_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The mock test for this attempt is unavailable.';
    END IF;

    -- Make submission idempotent. A retried request returns the stored result.
    IF v_attempt.status = 'submitted' THEN
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'question_id', q.id,
                    'question_text', q.question_text,
                    'question_text_hi', COALESCE(q.question_text_hi, q.question_text),
                    'options', q.options,
                    'options_hi', COALESCE(q.options_hi, q.options),
                    'correct_option', q.correct_option,
                    'explanation', q.explanation,
                    'explanation_hi', COALESCE(q.explanation_hi, q.explanation),
                    'selected_option', a.selected_option,
                    'is_correct', a.is_correct,
                    'awarded_marks', a.awarded_marks
                )
                ORDER BY q.sort_order
            ),
            '[]'::jsonb
        )
        INTO v_review
        FROM public.mock_test_questions q
        LEFT JOIN public.mock_test_answers a
          ON a.question_id = q.id
         AND a.attempt_id = p_attempt_id
        WHERE q.mock_test_id = v_attempt.mock_test_id;

        RETURN jsonb_build_object(
            'status', 'submitted',
            'already_submitted', true,
            'score', COALESCE(v_attempt.score, 0),
            'total_marks', v_attempt.total_marks,
            'pass_marks', v_test.pass_marks,
            'passed', CASE
                WHEN v_test.pass_marks IS NULL THEN NULL
                ELSE COALESCE(v_attempt.score, 0) >= v_test.pass_marks
            END,
            'review', v_review
        );
    END IF;

    IF v_attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'This test attempt is no longer active.';
    END IF;

    v_expired := v_attempt.expires_at <= clock_timestamp();

    -- Before expiry, use the final payload and fall back to autosaved answers
    -- when a question was omitted. After expiry, only persisted answers count.
    FOR v_question IN
        SELECT *
        FROM public.mock_test_questions
        WHERE mock_test_id = v_attempt.mock_test_id
        ORDER BY sort_order
    LOOP
        v_selected := NULL;
        v_answer_found := false;

        IF NOT v_expired THEN
            SELECT elem->>'selected_option'
            INTO v_selected
            FROM jsonb_array_elements(p_answers) AS elem
            WHERE elem->>'question_id' = v_question.id::text
            LIMIT 1;

            v_answer_found := FOUND;
        END IF;

        IF NOT v_answer_found THEN
            SELECT a.selected_option
            INTO v_selected
            FROM public.mock_test_answers a
            WHERE a.attempt_id = p_attempt_id
              AND a.question_id = v_question.id;
        END IF;

        IF v_selected IS NOT NULL
           AND v_selected NOT IN ('A', 'B', 'C', 'D') THEN
            v_selected := NULL;
        END IF;

        v_correct := (
            v_selected IS NOT NULL
            AND v_selected = v_question.correct_option
        );

        IF v_correct THEN
            v_awarded := v_question.marks;
        ELSIF v_selected IS NOT NULL THEN
            v_awarded := -COALESCE(v_test.negative_marking, 0);
        ELSE
            v_awarded := 0;
        END IF;

        v_score := v_score + v_awarded;
        v_total := v_total + v_question.marks;

        INSERT INTO public.mock_test_answers (
            attempt_id,
            question_id,
            selected_option,
            is_correct,
            awarded_marks
        )
        VALUES (
            p_attempt_id,
            v_question.id,
            v_selected,
            v_correct,
            v_awarded
        )
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET
            selected_option = EXCLUDED.selected_option,
            is_correct = EXCLUDED.is_correct,
            awarded_marks = EXCLUDED.awarded_marks;
    END LOOP;

    UPDATE public.mock_test_attempts
    SET submitted_at = clock_timestamp(),
        score = v_score,
        total_marks = v_total,
        status = 'submitted'
    WHERE id = p_attempt_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'question_id', q.id,
                'question_text', q.question_text,
                'question_text_hi', COALESCE(q.question_text_hi, q.question_text),
                'options', q.options,
                'options_hi', COALESCE(q.options_hi, q.options),
                'correct_option', q.correct_option,
                'explanation', q.explanation,
                'explanation_hi', COALESCE(q.explanation_hi, q.explanation),
                'selected_option', a.selected_option,
                'is_correct', a.is_correct,
                'awarded_marks', a.awarded_marks
            )
            ORDER BY q.sort_order
        ),
        '[]'::jsonb
    )
    INTO v_review
    FROM public.mock_test_questions q
    LEFT JOIN public.mock_test_answers a
      ON a.question_id = q.id
     AND a.attempt_id = p_attempt_id
    WHERE q.mock_test_id = v_attempt.mock_test_id;

    RETURN jsonb_build_object(
        'status', CASE WHEN v_expired THEN 'time_expired' ELSE 'submitted' END,
        'message', CASE
            WHEN v_expired THEN 'Time expired. Saved answers were evaluated.'
            ELSE 'Test submitted successfully.'
        END,
        'score', v_score,
        'total_marks', v_total,
        'pass_marks', v_test.pass_marks,
        'passed', CASE
            WHEN v_test.pass_marks IS NULL THEN NULL
            ELSE v_score >= v_test.pass_marks
        END,
        'review', v_review
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.activate_mock_test_purchase(p_payment_order_id uuid, p_razorpay_payment_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_order public.payment_orders%ROWTYPE;
    v_purchase public.mock_test_purchases%ROWTYPE;
    v_previous_order_status text;
BEGIN
    IF p_payment_order_id IS NULL
       OR p_razorpay_payment_id IS NULL
       OR btrim(p_razorpay_payment_id) = '' THEN
        RAISE EXCEPTION 'Invalid payment details.';
    END IF;

    SELECT *
    INTO v_order
    FROM public.payment_orders
    WHERE id = p_payment_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment order not found.';
    END IF;

    IF v_order.status = 'refunded' THEN
        RAISE EXCEPTION 'This payment order has been refunded.';
    END IF;

    IF v_order.razorpay_payment_id IS NOT NULL
       AND v_order.razorpay_payment_id <> p_razorpay_payment_id THEN
        RAISE EXCEPTION 'Payment ID does not match the existing record.';
    END IF;

    UPDATE public.payment_orders
    SET status = 'paid',
        razorpay_payment_id = p_razorpay_payment_id,
        paid_at = COALESCE(paid_at, NOW())
    WHERE id = p_payment_order_id;

    SELECT *
    INTO v_purchase
    FROM public.mock_test_purchases
    WHERE student_id = v_order.student_id
      AND mock_test_id = v_order.mock_test_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        IF v_purchase.payment_order_id = p_payment_order_id THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Purchase already activated.',
                'already_activated', true
            );
        END IF;

        SELECT status
        INTO v_previous_order_status
        FROM public.payment_orders
        WHERE id = v_purchase.payment_order_id;

        IF v_previous_order_status IS DISTINCT FROM 'refunded' THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Payment recorded. Student already owns this test.',
                'already_owned', true,
                'requires_review', true
            );
        END IF;

        -- Preserve the refunded payment order as history, but point the
        -- entitlement row at the newly verified purchase.
        UPDATE public.mock_test_purchases
        SET payment_order_id = p_payment_order_id,
            purchased_at = NOW()
        WHERE id = v_purchase.id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'New payment confirmed and test access reactivated.',
            'already_activated', false,
            'repurchased', true
        );
    END IF;

    INSERT INTO public.mock_test_purchases (
        student_id,
        mock_test_id,
        payment_order_id
    )
    VALUES (
        v_order.student_id,
        v_order.mock_test_id,
        p_payment_order_id
    )
    ON CONFLICT DO NOTHING;

    SELECT *
    INTO v_purchase
    FROM public.mock_test_purchases
    WHERE payment_order_id = p_payment_order_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Payment confirmed and test access activated.',
            'already_activated', false
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment recorded, but purchase activation needs review.',
        'requires_review', true
    );
END;
$function$
;
