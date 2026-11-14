# AICost capability repair · 2026-11-14

This version repairs the free tool. It does not validate willingness to pay, traffic, revenue or low-maintenance income. No paid product is released.

## Promise → implementation → evidence

| User-facing promise | Implementation | Verification |
|---|---|---|
| Explainable feature budget | Shared cost engine, five mutually exclusive billing buckets, explicit call/action/day/period units, extra calls counted once | Independent arithmetic tests; browser example $47.52 / 30 days; batch $0.792 / one day; actual downloaded JSON |
| Traceable prices | Three direct Claude models, exact API IDs, source URL/excerpt/channel/currency/scope/checked date/review due | Official pricing, cache and model-ID snapshots with SHA256; tests compare exact source cells with stored rates |
| Honest model comparison | Identical assumed workload, no unsupported speed/quality scores | All active templates use checked dataset; older model/compare routes show unverified notice and noindex, excluded from sitemap |
| Local usage checking | Direct complete Anthropic Messages records only; JSON/array/JSONL; 500 records / 1 MB | Tests cover missing/unknown fields, cache TTL conflicts, duplicates, unsupported modes/geography/tools, no model fallback |
| Downloadable calculation | Budget assumptions + bucket fees; usage exports whitelist model/counts/fees/source | Actual browser downloads in verification directory; raw IDs/content not exported |
| No record upload by tool | No application fetch/beacon/upload/storage code; browser-local parsing and Blob download | Source inspection and CDP Network events during example parsing/export; no outgoing requests observed during that interaction. Hosting requests/extensions remain outside this claim |
| Clear failure states | Invalid inputs hide prior totals; no partial aggregate on a failing row | Browser blank-input and duplicate-record handling; core tests |

## Scope and intentional limits

Only Claude Sonnet 5.5, Haiku 5.5 and Opus 5.5 direct API global text-token reference prices are supported. Prompt sum ≤100k. Standard service tier or Message Batches only. All other providers/channels, higher prompt tiers, fast/priority/regional pricing and tool/media fees are excluded. The inspector does not authenticate pasted records or certify historical invoices.

The former 15-entry data mixed stale rates and unverified performance claims. Active coverage was reduced instead of silently marking that table current. Old route names are kept in `legacy-models.json`, without old unverified numeric claims. Source history remains in Git.

## Maintenance

Run `npm test` and `npm run build`. GitHub checks run these on pushes and PRs. Tests verify formulas, failure cases, source hashes and price-cell mapping. Test fixtures and browser examples are fictional, not customer data or live paid API results.

Manual price review is due 2026-11-21, or on any provider/model/schema change. Verify original source rows and scope, save new dated snapshots, update hashes and review fields, inspect the generated page and repeat meaningful checks. A build must never rewrite checked dates automatically. The calculator warns when the review date is overdue. It is not a live feed.

Read the project-root product standard before creating or reopening a paid offer. Free-tool checks do not authorize paid publishing or prove commercial demand.
