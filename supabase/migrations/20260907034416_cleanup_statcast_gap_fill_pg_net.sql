-- Final cleanup for the one-time Statcast gap-fill execution path.
-- Keep pg_net absent from the durable Pick Analyzer schema.
drop extension if exists pg_net;
