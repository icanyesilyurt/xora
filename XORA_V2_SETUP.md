# XORA V2

Source branch: xora-v2. GitHub Pages remains on main; pushing this branch does not deploy the product.

## Verify locally

```sh
npm ci
npm run check
npm test
npx --yes --package=deno deno check supabase/functions/analyze-real/index.ts
```

Do not run old schema docs or test fixtures as incremental migrations. Production deployment is a separate, explicitly authorized operation.

## Runtime contract

- FUN: anonymous, free, no API/AI, seeded plus reroll nonce, no rarity, visible XORA FUN · FREE.
- REAL: authenticated; Mirror/Stalk 5 credits, Match 10. One AI call per new analysis. Match combines both X datasets and deterministic signals without two intermediate AI profiles. No REAL reroll control.
- Request IDs are required (8–80 ASCII letters, digits, underscores, hyphens) and bind mode/locale/handles. Replays return saved/pending/failed state without another debit or AI call. Ambiguous browser errors retain the ID for retry.
- Nicknames come from natural bilingual phrases gated by actual deterministic signals. Wrong phrase/evidence uses an observable deterministic fallback; no free-form direct nickname bypass. Unknown/duplicate metric keys and bad shapes/ranges/copy fail validation and settle the refund.
- All wallet mutations are DB-only. Browser balances are display caches; local credit functions cannot mint/spend. No fake payments; planned packages remain 10/$2.99, 20/$4.99, 50/$11.99.
- Creator referral pilot: links are `https://xora.roviaqr.com/?ref=<code>`. The browser keeps a server-confirmed code (`xora_referral_preview`) for 30 days and claims it at login/signup (`xora_capture_referral`) or REAL generation (`xora_claim_referral`). The first claim is permanent and is never replaced by a later referral; it earns commission for 12 months. A creator account cannot claim its own code (`affiliates.owner_user_id`).
- Commission: `xora_complete_credit_purchase` writes one `affiliate_commissions` row per verified, referred purchase (`purchase amount x commission_bps`, pilot 3000 = 30%). Failed payments never reach it; refunds/chargebacks are recorded with `xora_void_affiliate_commission(purchase_id, 'refund|chargeback: ...')`. Admin report: `select * from public.xora_affiliate_report;` (service role). No payouts are automated.
- V1/V2/V3 and old Match renderers remain. Untiered cards retain legacy rendering without invented REAL badges/rarity. Sample-count sentences are filtered from presentation copies, preserving archived data and internal meta.

## Infrastructure

The production database already records baseline 20260914161008 and these canonical migrations:

1. `supabase/migrations/20260914193000_xora_remote_reconciliation.sql`
2. `supabase/migrations/20260914195000_xora_real_validation_fix.sql`

Do not replay them or push this directory without comparing remote migration history. The baseline SQL is not reconstructed here; disposable history placeholders are not repository migrations. Old V1/hardening SQL is retained only under `tests/fixtures/legacy-migrations/` for isolated regression tests and is never a deployment input.

The current compact/no-lang schema uses users/analyses RLS, a server-controlled wallet, cache, affiliate attribution and real_requests. Signup defaults to zero; ledger accepts Mirror; completion requires valid rarity. Existing rows and balances were preserved.
RPCs:

- `xora_reconcile_credit_change`: server-only wallet lock and idempotent ledger mutation.
- `xora_capture_referral`: authenticated wrapper fixed to `auth.uid()`.
- `xora_begin_real`: claim and debit in one transaction.
- `xora_complete_real`: analysis insert and success in one transaction.
- `xora_fail_real`: exactly one matching refund; never refunds a saved successful analysis.
- `xora_recover_real`: settle pending requests older than 10 minutes after crashes/outages; no live schedule is configured by this source update.

Secrets remain server-side. Frontend config contains only existing public Supabase connection settings. No X OAuth, new languages, dashboards, payouts or redesign were added.
