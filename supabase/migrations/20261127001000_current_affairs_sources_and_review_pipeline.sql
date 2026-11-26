-- Activate a balanced set of official and institutional Current Affairs sources.
-- The Bihar portal sources are HTML pages parsed by the allow-listed collector.

UPDATE public.current_affairs_sources
SET source_url = 'https://betastate.bihar.gov.in/educationbihar/DyPageView?PageTitleID=1314',
    source_name = 'Bihar Education Department – Latest Notices',
    is_active = true,
    last_error = NULL,
    updated_at = now()
WHERE source_name = 'Bihar Education Department';

UPDATE public.current_affairs_sources
SET source_url = 'https://betastate.bihar.gov.in/iprdwebsite/DyPageView.aspx?PageTitleID=1571',
    source_name = 'Bihar IPRD – Press Releases',
    is_active = true,
    last_error = NULL,
    updated_at = now()
WHERE source_name = 'Bihar Information & Public Relations Department';

UPDATE public.current_affairs_sources
SET source_url = 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
    source_name = 'Press Information Bureau – All India Press Releases',
    is_active = true,
    last_error = NULL,
    etag = NULL,
    last_modified = NULL,
    updated_at = now()
WHERE source_name = 'Press Information Bureau (PIB)';

UPDATE public.current_affairs_sources
SET source_name = 'PRS India – Legislative Analysis',
    is_active = true,
    last_error = NULL,
    updated_at = now()
WHERE source_name = 'PRS India – Official Blog';

-- RBI tenders are procurement notices, not exam-oriented daily current affairs.
UPDATE public.current_affairs_sources
SET is_active = false,
    updated_at = now()
WHERE source_name = 'Reserve Bank of India – Tenders';

INSERT INTO public.current_affairs_sources (
  source_name, source_url, is_active
)
VALUES
  (
    'Press Information Bureau – Features',
    'https://pib.gov.in/RssMain.aspx?ModId=18&Lang=1&Regid=3',
    true
  ),
  (
    'Bihar IPRD – Cabinet Decisions',
    'https://betastate.bihar.gov.in/iprdwebsite/DyPageView.aspx?PageTitleID=8675',
    true
  )
ON CONFLICT (source_url) DO UPDATE
SET source_name = EXCLUDED.source_name,
    is_active = true,
    last_error = NULL,
    updated_at = now();
