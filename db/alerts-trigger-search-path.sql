-- The trigger only uses NEW and the pg_catalog now() builtin.
-- Lock name resolution to avoid inheriting a caller-controlled search path.
ALTER FUNCTION public.update_pfx_alerts_updated_at() SET search_path = '';
