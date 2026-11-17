-- Pagination, metadata backfill and per-creator counts on the growing radar index.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '90s';
CREATE INDEX IF NOT EXISTS pfx_radar_tokens_chain_detected_id_idx
  ON public.pfx_radar_tokens (chain_id, detected_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS pfx_radar_tokens_chain_status_detected_id_idx
  ON public.pfx_radar_tokens (chain_id, analysis_status, detected_at, id);
CREATE INDEX IF NOT EXISTS pfx_radar_tokens_chain_creator_idx
  ON public.pfx_radar_tokens (chain_id, creator_address) WHERE creator_address IS NOT NULL;
