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

192 automated tests pass, including regression cases for the above fixes, zero vs unavailable values, contradictory market prices, storage failures, mint mismatches and stale results. The production build passes.

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
- Watchlist is browser-local with export/import. Mobile validation is deferred by the user.

These are explicit scope limits, not hidden successes or silent replacement of unavailable data with zero.
