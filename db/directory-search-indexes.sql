-- Accelerate existing case-insensitive substring searches without changing matches.
-- Bounded lock wait: an occupied table aborts instead of blocking ingestion indefinitely.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '90s';
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS pfx_radar_tokens_name_trgm_idx
  ON public.pfx_radar_tokens USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pfx_radar_tokens_symbol_trgm_idx
  ON public.pfx_radar_tokens USING gin (symbol extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pfx_radar_tokens_mint_trgm_idx
  ON public.pfx_radar_tokens USING gin (mint extensions.gin_trgm_ops);
