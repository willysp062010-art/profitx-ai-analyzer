# Responsive web validation — 12 November 2026

## Scope

This changes the existing website on small screens. It does not create an Android application or change the Solana-first roadmap.

## Changes

- All eight tool links remain visible in a three-column menu at phone widths, with at least 44 CSS px height per link.
- Main buttons and form controls have a 44 px minimum height. Text inputs/selects use 16 px text. Small Radar/Alerts/Intelligence labels were enlarged.
- Compare uses stacked token identity cards and a pair of labeled A/B values per metric below 600 px. Its previous 720 px minimum table width is removed at those widths.
- Analyzer statistics use two columns; quote buttons fill the available width; long values and directory statistics stay inside their panels.
- Navigation remains sticky when height permits. At heights up to 450 px and widths up to 700 px it scrolls normally to preserve reading space.
- Background bubble animations stop on small layouts. Desktop styling is retained outside the breakpoints.

## Measured checks

Browser QA used the native Chromium zoom controls to obtain real CSS layout viewports; this is a responsive layout test, not mobile user-agent emulation or a physical device test.

| Page | CSS viewport width | Document client/scroll width | Menu links | Small visible form controls below 43 px |
| --- | ---: | --- | ---: | ---: |
| Analyzer, initial | 340 | 337 / 337 | 8 | 0 |
| Watchlist, initial | 340 | 337 / 337 | 8 | 0 |
| Alerts, initial | 340 | 337 / 337 | 8 | 0 |
| Directory, initial | 340 | 337 / 337 | 8 | 0 |
| Compare, initial | 340 | 337 / 337 | 8 | 0 |
| Intelligence, initial | 340 | 337 / 337 | 8 | 0 |
| Radar, initial | 340 | 337 / 337 | 8 | 0 |
| Obtain PFX | 340 | 337 / 337 | 8 | 0 |

All eight routes were also checked at 454 CSS px without horizontal document overflow. Populated Compare showed 20 rows with two value columns and zero minimum table width at 340 px; its populated page also fitted at 454 px. Populated Analyzer fitted at 340 px and 681 px. At 681 x 468 px, navigation stayed at top=0 after scrolling to scrollY=7470. The browser was restored to 100% zoom and the 1363 px desktop layout fitted its 1348 px client width.

The 196 existing automated tests and the production build pass. Screenshots were captured from the actual rendered browser. No wallet or financial transaction was used.

## Remaining device checks

Physical Android Chrome and iPhone Safari, touch gestures, on-screen keyboard behavior, safe-area insets and orientation changes have not been exercised on hardware. These remain a separate acceptance check; the layout measurements above do not claim that coverage.
