# Product utility and analysis measurement — 17 November 2026

Solana analysis is free, with no wallet connection, PFX purchase or subscription required. PFX currently unlocks no additional product functionality. Multichain advanced paid services, optional PFX payment and a potential pricing benefit are proposals only, with no dates or numerical discounts promised. Conventional payment options are also envisaged. No revenue rights or returns are promised.

The homepage offers an explicit user-triggered BONK analysis using the existing engine and canonical mint. No analysis runs on page load. The input starts empty instead of defaulting to PFX.

## Anonymous measurement

Existing visit and successful analysis totals remain intact. New launch, server completion and browser error aggregates start with deployment of this instrumentation, not historical reconstruction. Server responses can be partial; completion does not mean all checks passed. A network failure can produce both a backend completion and browser error, so these counts are not an exclusive conversion funnel.

`db/analysis-funnel.sql` is the deployed additive migration. Daily Paris aggregates are retained; UUID-per-analysis event keys are used for deduplication and pruned after seven days on subsequent writes (bounded cleanup). There is no persistent visitor identifier, cookie, mint, wallet, IP or error payload in these tables. Temporary hashed request-rate buckets exist only in server process memory. Visits are page openings, never unique visitors; repeat usage and retention are not measured. Requests can be blocked or spoofed, so these are indicative counters, not audited audience statistics.

Only production same-origin manual analysis requests are counted. Preview hosts, known bots and `?usage=off` do not emit event identifiers. Browser events permit only `started` and `failed`; `completed` comes from the validated analysis server success path. All database access is server-side through service-role RPCs; tables have RLS and no public/anon/authenticated grants. Public summary APIs return only allowlisted aggregate fields. Measurement outages never prevent analysis and are displayed as unavailable, not invented zeros.

Validation: API allowlists and unavailable/zero handling are tested; transactional database assertions verify deduplication and aggregation and roll back all test events. Production UI checks use `?usage=off`.

## Analysis request reliability

A 45-second browser deadline covers both response headers and response body. Timeout aborts the underlying request and releases the UI even if a transport ignores cancellation. A synchronous ref lock prevents duplicate launches before React rerenders. Leaving the page aborts the request; late results/errors are ignored and do not generate a false browser-failure event. Starting an analysis clears stale token-search notices. Network failures have a French retry message; mint matching and successful-response validation remain mandatory.

Validation includes stalled requests, stalled response bodies, caller cancellation, timer cleanup, network errors, duplicate clicks before rerender, and late responses after navigation.
