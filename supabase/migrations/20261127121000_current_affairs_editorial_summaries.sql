-- Preserve fetched source text separately from concise editorial summaries.
ALTER TABLE public.current_affairs_items
  ADD COLUMN IF NOT EXISTS title_hi text,
  ADD COLUMN IF NOT EXISTS source_excerpt text,
  ADD COLUMN IF NOT EXISTS summary_hi text,
  ADD COLUMN IF NOT EXISTS key_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exam_relevance text,
  ADD COLUMN IF NOT EXISTS ai_generation_status text NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS editorial_note text;

-- Back up existing raw RSS descriptions before the summary field is repurposed.
UPDATE public.current_affairs_items
SET source_excerpt = summary
WHERE source_excerpt IS NULL AND summary IS NOT NULL;

ALTER TABLE public.current_affairs_items
  ADD CONSTRAINT current_affairs_items_ai_generation_status_check
  CHECK (ai_generation_status IN ('not_generated','generated','manual','edited','needs_review'))
  NOT VALID;

ALTER TABLE public.current_affairs_items
  VALIDATE CONSTRAINT current_affairs_items_ai_generation_status_check;

CREATE INDEX IF NOT EXISTS current_affairs_items_published_date_idx
  ON public.current_affairs_items (status, original_published_at DESC);

CREATE INDEX IF NOT EXISTS current_affairs_items_ai_status_idx
  ON public.current_affairs_items (ai_generation_status, fetched_at DESC);

-- Enforce editorial requirements at the database boundary as well as in the UI.
-- A direct client/API update cannot publish raw feed text without a reviewed summary.
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

    IF v_english_sentences NOT BETWEEN 4 AND 5
       OR v_hindi_sentences NOT BETWEEN 4 AND 5 THEN
      RAISE EXCEPTION 'Published Current Affairs summaries must contain 4–5 sentences in both languages.'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(NEW.key_facts) IS DISTINCT FROM 'array'
       OR jsonb_array_length(NEW.key_facts) NOT BETWEEN 3 AND 5 THEN
      RAISE EXCEPTION 'A published Current Affairs article requires 3–5 key facts.'
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

DROP TRIGGER IF EXISTS current_affairs_editorial_publication_guard
  ON public.current_affairs_items;

CREATE TRIGGER current_affairs_editorial_publication_guard
BEFORE INSERT OR UPDATE OF
  status, title_hi, summary, summary_hi, key_facts, exam_relevance, ai_generation_status
ON public.current_affairs_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_current_affairs_editorial_publication();
