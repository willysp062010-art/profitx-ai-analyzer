# Solana desktop validation — 12 November 2026

## Scope and corrections

The existing Solana web tools are the release scope. This is not a declaration of full blockchain coverage, a security audit of every token, or an implementation of every future roadmap item.

- Analyzer now propagates an explicit security-module 404/422 instead of scoring a known missing account or a non-mint address. RPC outages remain unavailable/partial data, not proof that a token does not exist.
- Security distinguishes classic mint account length from token-account length, validates the Token-2022 extended mint account type and padding, and rejects uninitialized accounts.
- Alert check feedback distinguishes evaluated conditions from unavailable/missing conditions. Real measured zero remains usable. A request that returns unavailable data no longer produces an all-clear message.
- Decoded Token-2022 name/symbol are used as identity fallback only when both the response mint and metadata mint match the requested address. This improves Analyzer/Intelligence labels without declaring the token legitimate.
- Favorable-score headings explicitly refer to available controls. The reserve explanation claims an RPC account reading only when it exists.
- A third-party holder count of zero is not accepted as a verified census, even with zero mint supply (native wrapped SOL). The module falls back to RPC evidence; otherwise availability is explicit.

## Validation evidence

196 automated tests pass, including regression cases for the above fixes, zero vs unavailable values, contradictory market prices, storage failures, mint mismatches and stale results. The production build passes.

Desktop browser flows exercised:

- PFX Analyzer -> follow token -> Watchlist -> alert form with the exact mint selected.
- Watchlist survives reload and rejects an invalid address without adding it.
- Alert creation and server confirmation, manual check with unavailable market data, and pause. The agent-created server test rule was removed after validation; no existing user rules were changed.
- Analyzer -> Intelligence preserves the partial-analysis warning and measured-activity scope.
- Compare PFX vs native wrapped SOL displays side-by-side results and the coverage limitations.

Production API checks confirmed HTTP 422 with no score for the system-program address, unavailable holder data instead of a false zero for native wrapped SOL, and ten BONK directory matches. The Radar loaded token cards with explicit risk/coverage warnings. The final identity fallback response and alert feedback are also covered by regression tests; final deployment checks are reported in the conversation.

## Accepted external/product limits

- Pump.fun server API still returns HTTP 403. Other available sources remain usable and the refusal is disclosed.
- Token and creation coverage is partial. First detection is not necessarily a new on-chain creation.
- Token-2022 extensions are not fully integrated into the security score; that limitation is shown with the result.
- Revente/execution is not guaranteed by historical transactions or indicative swap quotes.
- Alerts run by daily batches and manual checks, not continuously. Email notifications are not enabled.
- Watchlist is browser-local with export/import. A responsive web pass now covers desktop-browser layouts at phone widths; physical iOS/Android device validation remains outstanding.

These are explicit scope limits, not hidden successes or silent replacement of unavailable data with zero.

## Indicative quote follow-up

- Successful sell/EUR quote results show their own Paris timestamp. A 5-second UI timer marks readings at least 60 seconds old as historical and prompts a new request; it does not promise execution for newer readings.
- EUR conversion requires a numeric USD reference rate and a valid provider date, at most seven calendar days old and not in the future. Invalid FX data returns QUOTE_UNAVAILABLE without calling Jupiter or inventing a conversion.
- Production read-only checks obtained PFX-to-SOL and EUR round-trip quote responses. No wallet, taker, signature or transaction submission was used. Exact amounts are transient, not evidence of executable liquidation.

## Release closure follow-up (evening)

- The retained automation result confirms the 12 November scheduled cycle: HTTP 200 at 05:33:29 Europe/Paris, 957 ms, 3 evaluated rules, 0 errors and 0 unavailable values. This is recorded historical evidence, not a fresh replay of the monitor. The final scheduled confirmation remains 13 November.
- Authorized scheduler responses now persist aggregate evidence in the private `pfx_alert_cron_runs` table before sending their response. Only dates, HTTP status, duration, outcome and allowlisted counts are stored. RLS is enabled, public/client roles have no grants, and service_role has SELECT/INSERT only. Storage failure logs a gap without replacing the actual monitor response. An escaped monitor exception records failure before propagating.
- The database write/read path was checked inside a rolled-back service_role transaction. No synthetic completed cron run was left behind. The first real durable record remains pending the next scheduler call; a missing record is not a successful run.
- Analyzer now displays Token-2022 extension findings already supplied by its parser. Unknown detection and extension assessments that are incomplete or not scoring-ready contribute no favorable numeric extension score. Base-authority checks remain scoped; this does not audit arbitrary transfer-hook programs or integrate every extension into scoring.
- Physical iOS/Android acceptance remains outstanding because no hardware or connected device service is available. Responsive browser measurements remain valid within their documented scope. External Pump.fun 403 responses and partial blockchain coverage remain explicit operational limits.
