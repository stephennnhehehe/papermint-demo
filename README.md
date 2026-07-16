# PaperMint

PaperMint is a deployable Next.js + TypeScript invoicing product for Australian small businesses. It supports email and Google auth, AUD, ABN, GST, customers, invoices, quotes, secure online document viewing, quote acceptance, due-date reminders, expenses and receipts, cashflow analytics, BAS preparation packs, A4 PDF output and Stripe subscriptions.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth, Postgres RLS and Storage
- Stripe Checkout, Webhooks and Customer Portal
- Recharts dashboard chart
- `@react-pdf/renderer` PDF generation
- Vercel deployment

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

If this machine does not have `pnpm`, use the bundled runtime path shown by Codex or install Node.js locally.

No account yet? Use **Try PaperMint free now** on the login page. Demo data is saved in this browser's `localStorage`, so the complete invoice flow is available immediately.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEEKLY_PRICE_ID=price_...
STRIPE_MONTHLY_PRICE_ID=price_...
RESEND_API_KEY=re_...
EMAIL_FROM=PaperMint <invoices@your-domain.com>
CRON_SECRET=a-long-random-secret
```

Only variables prefixed with `NEXT_PUBLIC_` reach the browser. `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only secrets and must never be shared or committed. Row Level Security in `supabase/schema.sql` ensures users can only access their own records.

## Supabase Configuration

1. Create a Supabase free project.
2. Open SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Run [`supabase/migrations/20260716_cashflow_expenses.sql`](./supabase/migrations/20260716_cashflow_expenses.sql) to add document delivery, reminders, expenses and BAS data.
4. Run [`supabase/migrations/20260716_lifetime_access.sql`](./supabase/migrations/20260716_lifetime_access.sql) to support managed complimentary accounts.
5. In Authentication → Providers, enable Email.
6. In Authentication → URL Configuration, set the production Site URL and add both `http://localhost:3000/**` and the production `https://...vercel.app/**` redirect URLs. Password reset links return to `/reset-password`.
7. In Project Settings → API Keys, copy the project URL, publishable/anon key and server-only service role key into `.env.local`.
8. For quick local QA, either confirm the signup email or temporarily disable email confirmation.
9. Restart `pnpm dev`.

### Google login

1. In Google Cloud Console, create an OAuth 2.0 Web application.
2. Add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as an authorised redirect URI.
3. In Supabase Authentication → Providers → Google, enable Google and add the Google Client ID and Client Secret.
4. Keep the localhost and production URLs in Supabase's redirect allow list.

Tables:

- `profiles`: default business details, ABN, payment methods, notes and logo URL.
- `company_profiles`: reusable issuer / From profiles selectable while creating invoices and quotes.
- `customers`: account-scoped customer records with billing and shipping addresses.
- `documents`: account-scoped invoices and quotes with JSON line items, discounts, parties, totals and status.
- `document_shares` and `document_events`: secure public links plus sent, viewed, accepted, converted and paid lifecycle events.
- `reminder_settings` and `reminder_deliveries`: idempotent due-date email reminders.
- `expenses` and `expense_receipts`: company-scoped purchases, GST credits and private receipt attachments.
- `billing_accounts`: server-managed Stripe customer and subscription state; browser roles cannot read or write this table directly.
- `document_usage`: append-only weekly usage events used to enforce the free limit even after a document is deleted.
- `storage.objects` bucket `papermint-logos`: user-scoped uploads under `{user_id}/file`.

RLS policies:

- `profiles`: `auth.uid() = id`
- `company_profiles`: `auth.uid() = user_id`
- `customers`: `auth.uid() = user_id`
- `documents`: `auth.uid() = user_id`
- `billing_accounts` and `document_usage`: no browser table access; users receive only their own billing summary through `get_billing_status()`.
- `papermint-logos`: users may write only inside their own folder; logo files are public for document rendering.
- `papermint-receipts`: private; users may access only files inside their own folder.

## Document email and reminders

1. Create a Resend account and verify a sending domain.
2. Add `RESEND_API_KEY` and `EMAIL_FROM` locally and in Vercel.
3. Generate a long random `CRON_SECRET` and add the same value in Vercel.
4. `vercel.json` runs `/api/cron/reminders` once daily. Reminder settings are opt-in under Settings.
5. Without Resend configuration, secure links still work and the UI explains that no real email was sent.

PaperMint does not process customer payments. Public invoices show the issuer's bank/payment instructions, and the owner manually marks an invoice paid.

## Plans and Stripe

- Free: all features, 5 new invoices or quotes per Australian calendar week, small `Generated by PaperMint` footer.
- Weekly: AUD $0.99 per week, unlimited documents, no PaperMint footer.
- Monthly: AUD $2.99 per month, unlimited documents, no PaperMint footer.

Stripe setup in test mode:

1. Create one PaperMint product with two recurring AUD prices: `$0.99 / week` and `$2.99 / month`.
2. Add their `price_...` IDs and the test secret key to `.env.local`. If price IDs are omitted, local Checkout uses equivalent inline recurring prices.
3. Enable the Stripe Customer Portal so customers can update payment methods and cancel.
4. For local webhooks, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and copy the printed `whsec_...` value.
5. For production, create a webhook endpoint at `https://YOUR_DOMAIN/api/stripe/webhook` and listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Test Checkout with Stripe test card `4242 4242 4242 4242`, any future expiry date and any CVC.

## Vercel Free Deployment

1. Push this repository to GitHub, GitLab or Bitbucket.
2. Create a new Vercel project and import the repo.
3. Framework preset: Next.js.
4. Add every environment variable from `.env.example`. Use the live Stripe values only when ready to charge real customers; test and live webhook secrets are different.
5. Deploy.
6. In Supabase Authentication → URL Configuration, set:
   - Site URL: your Vercel production URL
   - Redirect URLs: `https://your-vercel-domain.vercel.app/**`
7. In Stripe Workbench/Webhooks, add the production webhook URL and store its signing secret in Vercel.
8. Redeploy after changing environment variables.

## Test Flow

Register a new account with any test email you can receive. If email confirmation is disabled for local QA, registration signs in immediately.

For interface QA without an account, click **Try PaperMint free now** and complete the same flow with local demo data.

Acceptance path:

1. Register or log in.
2. Open Customers and create a customer with Bill To and Ship To.
3. Open Documents → New invoice or New quote.
4. Select the issuer and customer; PaperMint generates an alphanumeric sequential document number for each new document.
5. Add line items, item discount, order discount, GST, notes and payment methods.
6. Preview, print or download the A4 PDF.
7. Save the document.
8. Return to Dashboard to review Money Timeline, Today’s Actions, quote conversion and company-filtered cashflow.
9. For quotes, use Documents → convert to invoice.
10. On Pricing, complete a Stripe test Checkout and verify the account shows Unlimited and generated PDFs no longer include the PaperMint footer.
11. Add an expense with a receipt, then download the FY accountant pack from Expenses.

The BAS preparation PDF and CSVs cover core GST labels G1, G10, G11, 1A and 1B using the selected cash or accrual basis. They are preparation records, not automatic lodgement, and should be reviewed for adjustments, GST-free sales, exports, PAYG and other obligations before submission.

Free-limit QA: create 5 new invoices or quotes in one week. The sixth insert must fail with a friendly upgrade message. Editing existing documents remains available, and deleting a document does not restore the weekly allowance.

Document numbers use a predictable sequence: `INVYYYYMMDD001`, `INVYYYYMMDD002`, and `QTYYYYMMDD001` for quotes. New invoice pages receive a fresh draft session, so clicking New invoice starts a blank invoice instead of reusing the previous one.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
