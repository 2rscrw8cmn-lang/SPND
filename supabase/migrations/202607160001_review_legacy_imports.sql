-- Legacy CSV imports (source_fingerprint like 'csv:%') were bulk-loaded historical
-- transactions that do not need line-by-line review. Mark them reviewed so they clear
-- the review queue. Idempotent: re-running only touches rows still needing review.
update public.transactions
set review_status = 'reviewed',
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
where source_fingerprint like 'csv:%'
  and review_status <> 'reviewed';
