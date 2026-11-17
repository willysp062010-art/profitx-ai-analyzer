# Radar and alert stability — 17 November 2026

## Verified diagnosis

Production had recurring historical metadata lookup timeouts and occasional failures of the initial radar read and 72-hour count. The table held approximately 274,000 indexed records. An exact Solana count took 7,111 ms in a PostgreSQL EXPLAIN ANALYZE measurement. The oldest-pending metadata query took 2,077 ms and scanned past 15,548 nonmatching records.

## Changes

- Applied the three indexes in `db/radar-query-indexes.sql`: chain plus stable detection ordering, chain/status/detection ordering for backfill, and chain/creator for creator history.
- Ran VACUUM ANALYZE on the radar table. The same oldest-pending query measured 10.75 ms after indexing. A 72-hour count measured 7,921 ms before maintenance and 427.53 ms afterward. These are database measurements, not end-to-end page timings.
- Radar reads use 101-row lookahead for 100-row pages, with no full-index count and no database writes. The exact global total loads independently through the existing directory statistics endpoint. Missing optional results remain unavailable.
- Optional metadata, market, authority, concentration and creator requests share a ten-second cancellation deadline after the indexed page read. Existing per-provider limits remain in effect. Transient Helius identities are attributed to Helius rather than to stored metadata.
- A dedicated production/Vault credential authenticates the existing five-minute backfill job through POST /api/radar-enrich. `db/radar-background-job.sql` switches that existing job only after deployment. The job retains a budget of 15 assets per run, shared between oldest pending, newest pending and retries. The separate existing daily Vercel enrichment remains at 40 assets per run.
- Alerts health reads durable scheduler records and reports only execution time and status. Recent successful records with zero processing errors can confirm execution; missing, malformed, failed, future or stale records cannot. Rule details and aggregate counts are not published.

## Alert evidence

The private scheduler table contains real successful daily executions from 13 through 17 November. The 17 November execution completed at 04:33:29 UTC (05:33:29 Paris), HTTP 200, 856 ms, three checked rules, zero processing errors and one unavailable market value. No manual monitor replay was used. An unavailable market value remains an incomplete observation, not a successful token check.

## Validation and limits

213 automated tests pass and the production build compiles. Tests cover lookahead boundaries, read-only radar behavior, shared cancellation, metadata provenance, microsecond-preserving pagination, authenticated backfill budget, and alert evidence freshness, failure and privacy.

Real-time delivery, email notifications, exhaustive blockchain coverage and multichain support are not introduced by this change. Existing external provider limitations remain. Public page and API validation must use the resulting production deployment; a successful local build alone does not establish production success.
