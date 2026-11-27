-- Align Current Affairs publication validation with the shorter 3–4 sentence format.
-- Drafts remain editable and are not affected; this guard applies only when status becomes published.

CREATE OR REPLACE FUNCTION public.enforce_current_affairs_editorial_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_english_sentences integer;
  v_hindi_sentences integer;
BEGIN
  IF NEW.status = 'published' THEN
    IF coalesce(btrim(NEW.title_hi), '') = ''
       OR coalesce(btrim(NEW.summary), '') = ''
       OR coalesce(btrim(NEW.summary_hi), '') = ''
       OR coalesce(btrim(NEW.exam_relevance), '') = '' THEN
      RAISE EXCEPTION 'A published Current Affairs article requires English and Hindi headlines, summaries, and exam relevance.'
        USING ERRCODE = '23514';
    END IF;

    SELECT count(*)::integer
    INTO v_english_sentences
    FROM regexp_split_to_table(btrim(NEW.summary), '[.!?]+') AS sentence
    WHERE btrim(sentence) <> '';

    SELECT count(*)::integer
    INTO v_hindi_sentences
    FROM regexp_split_to_table(btrim(NEW.summary_hi), '[.!?।]+') AS sentence
    WHERE btrim(sentence) <> '';

    IF v_english_sentences NOT BETWEEN 3 AND 4
       OR v_hindi_sentences NOT BETWEEN 3 AND 4 THEN
      RAISE EXCEPTION 'Published Current Affairs summaries must contain 3–4 sentences in both languages.'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(NEW.key_facts) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Key facts must be stored as a JSON array.'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_array_length(NEW.key_facts) NOT BETWEEN 2 AND 5 THEN
      RAISE EXCEPTION 'A published Current Affairs article requires 2–5 key facts.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.ai_generation_status NOT IN ('generated','edited','manual') THEN
      RAISE EXCEPTION 'Save and verify the editorial summary before publication.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
