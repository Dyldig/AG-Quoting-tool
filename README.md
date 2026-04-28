# Jeffries Agriculture — Quoting Tool

Internal sales quoting tool for the Jeffries Agriculture division. Used by sales reps to generate quotes for compost, mulch, and blended soil amendments delivered across South Australia and regional Victoria/NSW.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with Jeffries brand tokens
- **Database & Auth**: Supabase (Postgres + RLS + Auth)
- **State**: Zustand with Immer
- **Forms**: React Hook Form + Zod
- **PDF**: Puppeteer
- **Email**: Resend
- **CRM**: HubSpot API v3

---

## Local Development Setup

### 1. Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- Resend account (for email)
- HubSpot Private App token (for CRM sync)

### 2. Clone and install

```bash
git clone <repo-url>
cd jeffries-quoting
npm install
```

### 3. Environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HUBSPOT_PRIVATE_APP_TOKEN=your-hubspot-token
RESEND_API_KEY=re_xxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database setup

In your Supabase project's SQL editor, run the two SQL files in order:

```
supabase/schema.sql   ← Tables, RLS policies, indexes, triggers
supabase/seed.sql     ← Products, pricing rules, freight matrix, amendments
```

Both are in `supabase/` at the repo root. The schema creates all enums, tables, RLS policies, and two triggers (auto-quote-number generation, updated_at).

### 5. Create the first user

In Supabase Auth → Users, create a user manually (or use the sign-up flow). Then in the SQL editor, grant them admin:

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'your-user-uuid';
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## Application Routes

| Route | Description |
|---|---|
| `/login` | Supabase email/password auth |
| `/quotes/new` | Quote builder (main interface) |
| `/quotes` | Quote history table with filters |
| `/quotes/[id]` | Quote detail, status management, PDF/email actions |
| `/admin/pricing` | Inline price editing + global % adjustment tool |
| `/admin/regions` | Region management, default UOM, freight matrix |
| `/admin/overrides` | Override approval queue + history |
| `/api/quotes/[id]/pdf?view=customer\|internal` | Puppeteer PDF generation |
| `/api/quotes/[id]/email` | Resend email with PDF attachment |
| `/api/hubspot/sync` | HubSpot CRM sync |

---

## Pricing Logic

### Volume tier

Volume is converted to tonnes using the product's `conversion_factor_m3_to_t` when entered in m³. Quotes ≥ 150 t are priced at the **bulk** tier; below that is **standard**.

### Base price lookup

Looks up `pricing_rules` by `(product_id, customer_type, volume_tier)` where `effective_date` is the most recent on or before today.

### Freight

Looked up from `freight_matrix` by `(region_id, product_category)`. Pickup quotes have zero freight.

### Blend classification

| Condition | Classification |
|---|---|
| Only bulk amendments, ≤ 2 of them, no liquid/bagged | Simple ($7/t) |
| JOC in blend + any liquid/bagged or ≥ 3 bulk | Complex ($11/t) |
| Any other combination | Complex ($11/t) |

Blend fee applies to **total blend tonnes** (base + amendments).

### GST

If quote is set to **Ex GST**, GST (10%) is calculated and displayed separately. Final total is always shown inclusive.

---

## User Roles & Permissions

| Role | Permissions |
|---|---|
| `sales_rep` | Create/read/edit own quotes only |
| `sales_manager` | Read all quotes, approve overrides, update pricing rules |
| `admin` | Full access including user management |

Roles are enforced at the database level via Supabase RLS policies. Override approval is additionally enforced at the API route level.

---

## PDF Generation

`/api/quotes/[id]/pdf?view=customer|internal`

- **Customer view**: Logo, customer details, product lines, blend summary (no rates), grand total, validity date, terms
- **Internal view**: All of the above + base prices, freight per line, blend fee detail, override note if applicable

Puppeteer runs server-side. On Vercel, deploy to a function with at least **1 GB memory**. Puppeteer must be able to launch Chromium — see Vercel's [Puppeteer guide](https://vercel.com/guides/how-do-i-use-puppeteer-with-vercel).

For serverless environments, consider switching to `@sparticuz/chromium` + `puppeteer-core`:

```bash
npm install @sparticuz/chromium puppeteer-core
npm uninstall puppeteer
```

Then update the launch call in `app/api/quotes/[id]/pdf/route.ts`:

```ts
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
})
```

---

## HubSpot Integration

Requires a **HubSpot Private App** with scopes:
- `crm.objects.deals.read` / `write`
- `crm.objects.quotes.read` / `write`
- `crm.objects.contacts.read`
- `engagements.read` / `write`

The sync endpoint (`POST /api/hubspot/sync`):
1. Finds or creates a Deal by the quote's `hubspot_deal_id` (or searches by company name)
2. Creates or updates a Quote object associated with the Deal
3. Logs a Note engagement on the contact timeline
4. Writes back the `hubspot_deal_id` and `hubspot_synced_at` to the Supabase quote record

---

## Email (Resend)

Requires a verified **sending domain** in Resend. Update the `from` address in `app/api/quotes/[id]/email/route.ts`:

```ts
from: 'Jeffries Agriculture <quotes@your-domain.com.au>'
```

The email sends a branded HTML summary + the customer PDF as an attachment. On send, the quote status is automatically updated to `sent`.

---

## Deployment (Vercel + Supabase)

### Vercel

1. Push branch to GitHub/GitLab
2. Connect repo in Vercel dashboard
3. Set all environment variables under **Settings → Environment Variables**
4. Set function memory to **1024 MB** for the PDF route (Project Settings → Functions)
5. Deploy

### Supabase

- Enable **Email Auth** in Authentication → Providers
- Disable public sign-ups (Settings → Authentication → Disable sign-ups) — this is an internal tool
- Set up a database backup schedule
- In production, review all RLS policies via Dashboard → Table Editor → RLS

### Environment variables needed on Vercel

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
HUBSPOT_PRIVATE_APP_TOKEN
RESEND_API_KEY
NEXT_PUBLIC_APP_URL        ← set to your Vercel production URL
```

---

## Data Model Summary

```
profiles          ← extends auth.users; holds role (sales_rep|sales_manager|admin)
regions           ← delivery regions with default UOM and zone group
products          ← SKU, category (compost|mulch), m³→t conversion factor
pricing_rules     ← price per unit by product × customer_type × volume_tier × effective_date
freight_matrix    ← freight per region × product_category × effective_date
amendments        ← blend amendments (Gypsum, Lime, custom)
quotes            ← master quote record with status lifecycle
quote_lines       ← one row per product in a quote
quote_blends      ← blend classification + fee totals (max 1 per quote)
blend_amendments  ← amendment rows on a blend
price_adjustments ← audit log of global % price changes
override_log      ← manual price override requests + approval workflow
```

---

## Development Notes

### Input stability (Zustand + uncontrolled inputs)

Number inputs in the quote builder use an **uncontrolled pattern**: the DOM input is bound once via `useRef`, with a separate ref tracking the current numeric value. Zustand state is only updated on `blur` or after debounce — never on every keystroke. This prevents React re-renders from stealing focus mid-typing.

**Never** pass a changing `value` prop to a number input that the user may be actively typing in.

### Quote number generation

Quote numbers (`QT-XXXX`) are generated by a Postgres trigger + sequence on insert. The client passes an empty string; the trigger populates it automatically.

### Pricing rule history

`pricing_rules` is append-only by effective date. The application always reads the most recent rule per `(product_id, customer_type, volume_tier)`. The global adjustment tool inserts new rows with today's date rather than updating existing rows, preserving full price history.
