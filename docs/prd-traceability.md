# PRD acceptance traceability

Status as of 29 October 2026. Per ADR-0003, deterministic and component evidence is reported
separately from browser-complete acceptance. "Browser run pending" means the Playwright check in
`apps/extension/e2e/verify.ts` (`pnpm --filter extension verify`, with the dev stack running in
fixture mode) has not been recorded against the case yet.

| Case  | Automated evidence                                                                  | Current status                         |
| ----- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| K1-01 | Moment validator, AI workflow tests, Playwright six-step walk from Beranda          | Verified in browser (fixtures)         |
| K1-02 | Exact Rp447.000 validator, confirmed-fill and mismatch unit tests, Playwright check | Partial — browser run pending          |
| K1-03 | Confirmed-fill mismatch tests and Playwright mismatch check                         | Partial — browser run pending          |
| K1-04 | Cross-page continuation tests and Playwright five-run task guide                    | Verified in browser (fixtures)         |
| K1-05 | Stored-data deadline integration and UI/AI deadline assertions                      | Partial — browser run pending          |
| K1-06 | Fresh-response refusal validator and stale-output regression test                   | Verified offline; live/browser pending |
| K1-07 | Exact PMK 113 citation validator and stored active-source integration               | Verified offline; live pending         |
| K1-08 | Submit guardrail validator and no-click action tests                                | Verified offline; browser pending      |
| K1-09 | Live evaluator records three-run medians per response                               | Not run — needs `eval:live`            |
| K2-01 | Registration action/guide/deadline/source validators and exact-ID component test    | Partial — browser run pending          |
| K2-02 | Active v1 cutoff, day-15 calculation, and timely-option validators                  | Verified offline; live/browser pending |
| K2-03 | 99.50% addendum and three-step CRM guide validators; CRM route                      | Partial — browser run pending          |
| K2-04 | Interval merge/exclusion tests, row actions, and ticket UI                          | Verified offline; browser pending      |
| K2-05 | Exact rational Rp579.167 calculation, confirmed fill, Answer Card rendering         | Verified offline; browser pending      |
| K2-06 | Database-derived two-approver route and active matrix citation                      | Verified offline; live pending         |
| K2-07 | Missing-RCA amount suppression, `PERLU_BUKTI`, and request-RCA UI                   | Verified offline; browser pending      |
| K2-08 | Late cutoff, rejection route, and TPL-BILL-02 UI/source                             | Verified offline; browser pending      |
| K2-09 | Attachment-injection warning, verified 17.5-hour result, zero actions               | Verified offline; live/browser pending |
| K2-10 | Self-approval refusal, exact sources, disabled UI, and zero actions                 | Verified offline; live/browser pending |

`data/04_evaluasi/laporan_evaluasi.json` is an offline run (`"mode": "offline"`, 29 October 2026):
6/6 deterministic K1 calculations and 10/10 K2 deterministic cases pass. Every live-provider check
(Jev, K1 AI acceptance, grounded answers, screenshots, K2 live) and the K1 UI-only checks are
`not_run` in that report. Live results are not part of it: the earlier live Momen 2 and 3 run from
18 October is kept in `laporan_evaluasi_moments-2-3.json`. Whether to produce a new live report is
the AI owner's decision. The supplied evaluator-only answer-key package is intentionally not
tracked or indexed.
