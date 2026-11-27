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
