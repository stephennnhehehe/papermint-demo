# PaperMint

PaperMint is a deployable Next.js + TypeScript invoicing app for Australian small businesses. It supports email auth, AUD, ABN, GST, customers, invoices, quotes, dashboard stats, live A4 preview, printing, PDF download, logo upload, draft autosave and English/Chinese UI.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth, Postgres RLS and Storage
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

No account yet? Use **Try demo workspace without an account** on the login page. Demo data is saved in this browser's `localStorage`, so you can inspect the invoice editor, create customers, save documents and download PDFs before connecting Supabase.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Only the anon key is used in the browser. Row Level Security in `supabase/schema.sql` ensures users can only access their own records.

## Supabase Configuration

1. Create a Supabase free project.
2. Open SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
3. In Authentication → Providers, enable Email.
4. For quick local QA, either disable email confirmation temporarily or confirm the signup email before logging in.
5. In Project Settings → API, copy Project URL and anon public key into `.env.local`.
6. Restart `pnpm dev`.

Tables:

- `profiles`: default business details, ABN, payment methods, notes and logo URL.
- `company_profiles`: reusable issuer / From profiles selectable while creating invoices and quotes.
- `customers`: account-scoped customer records with billing and shipping addresses.
- `documents`: account-scoped invoices and quotes with JSON line items, discounts, parties, totals and status.
- `storage.objects` bucket `papermint-logos`: user-scoped uploads under `{user_id}/file`.

RLS policies:

- `profiles`: `auth.uid() = id`
- `company_profiles`: `auth.uid() = user_id`
- `customers`: `auth.uid() = user_id`
- `documents`: `auth.uid() = user_id`
- `papermint-logos`: users may write only inside their own folder; logo files are public for document rendering.

## Vercel Free Deployment

1. Push this repository to GitHub, GitLab or Bitbucket.
2. Create a new Vercel project and import the repo.
3. Framework preset: Next.js.
4. Add the two environment variables from `.env.example`.
5. Deploy.
6. In Supabase Authentication → URL Configuration, set:
   - Site URL: your Vercel production URL
   - Redirect URLs: `https://your-vercel-domain.vercel.app/**`

## Test Flow

Register a new account with any test email you can receive. If email confirmation is disabled for local QA, registration signs in immediately.

For interface QA without Supabase, click **Try demo workspace without an account** and complete the same flow with local demo data.

Acceptance path:

1. Register or log in.
2. Open Customers and create a customer with Bill To and Ship To.
3. Open Documents → New invoice or New quote.
4. Select the issuer and customer; PaperMint generates an alphanumeric sequential document number for each new document.
5. Add line items, item discount, order discount, GST, notes and payment methods.
6. Preview, print or download the A4 PDF.
7. Save the document.
8. Return to Dashboard to see counts, paid/unpaid/overdue totals and monthly revenue.
9. For quotes, use Documents → convert to invoice.

Document numbers use a predictable sequence: `INVYYYYMMDD001`, `INVYYYYMMDD002`, and `QTYYYYMMDD001` for quotes. New invoice pages receive a fresh draft session, so clicking New invoice starts a blank invoice instead of reusing the previous one.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
