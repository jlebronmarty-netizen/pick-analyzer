alter table if exists sports_sync_jobs
  drop constraint if exists sports_sync_jobs_status_check;

alter table if exists sports_sync_jobs
  add constraint sports_sync_jobs_status_check
  check (status in ('pending', 'running', 'completed', 'partial', 'failed', 'canceled', 'timed_out'));
