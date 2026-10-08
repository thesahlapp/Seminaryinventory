# Qalam Seminary Inventory

Inventory management for Qalam Seminary, built with Next.js (App Router), TypeScript,
Tailwind CSS and Supabase (Postgres, Auth, Storage).

- **Stock** is tracked per item, per size (when the item has sizes), per location,
  e.g. "Black Hoodie · M · Warehouse: 12".
- **Every quantity change** is logged with who, when, old value, new value and a reason.
- **Sign-in is invite-only** (Supabase Auth, email and password). There are three roles:
  `admin`, `editor` and `viewer`, enforced by the database (row-level security), not just the UI.
- Also: low stock alerts, QR codes and label printing, a phone scanner, check-outs and kits,
  costs and value (admins only), purchase orders, stock counts, comments with @mentions,
  CSV import/export, reports, dark mode, and it installs on phones like an app.

**Guides:** [Team guide](docs/TEAM-GUIDE.md) (for everyone using the app) ·
[Backups and restoring](docs/BACKUPS.md)

---

## Setup: step by step

You need [Node.js 20+](https://nodejs.org) and a free [Supabase](https://supabase.com) account.

> **Use a new, separate Supabase project for this app.** Don't reuse an existing project
> (such as Sahl). Every command below targets the project you link in step 5, so check
> that you pick the right one.

### 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Choose your organization, then fill in:
   - **Name:** `Qalam Seminary Inventory`
   - **Database password:** click *Generate a password* and **save it in your password
     manager**. You'll need it in step 5.
   - **Region:** the one closest to Dallas, e.g. *East US (North Virginia)* or *Central US*.
3. Click **Create new project** and wait a minute or two for it to finish.

### 2. Copy the keys into `.env.local`

1. In the project, click **Connect** (top bar), or go to **Project Settings → API Keys**.
2. Copy these values:
   - **Project URL**, e.g. `https://abcdefghijklmnop.supabase.co`
   - **Publishable key** (starts with `sb_publishable_`). If your project only shows
     legacy keys, use the `anon` `public` key instead.
3. In this folder:

   ```bash
   cp .env.example .env.local
   ```

   Then paste the values into `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   `.env.local` is git-ignored, so it is never committed.

### 3. Make sign-up invite-only

1. Go to **Authentication → Sign In / Providers**.
2. Turn **off** *Allow new users to sign up*, then save.
3. Make sure the **Email** provider is enabled (it is by default).

Invites from the dashboard still work with sign-up turned off.

### 4. Set the site URL and email templates

1. Go to **Authentication → URL Configuration**.
   - **Site URL:** `http://localhost:3000` for now. Change it to your real address
     (e.g. `https://inventory.qalam.institute`) once the app is deployed.
   - **Redirect URLs:** add `http://localhost:3000/**`, plus your production URL with `/**`
     once you have one.
2. Go to **Authentication → Emails → Templates**.
   - **Invite user:** replace the message body with the contents of
     [`supabase/templates/invite.html`](supabase/templates/invite.html).
   - **Reset password:** replace the message body with the contents of
     [`supabase/templates/recovery.html`](supabase/templates/recovery.html).

   These templates send people to the app's `/auth/confirm` page, which signs them in and
   asks them to choose a password.

### 5. Run the database migrations

The migrations are in [`supabase/migrations/`](supabase/migrations). They create all the
tables, security rules, stock functions and the photo storage bucket. Use **one** of
these two options.

**Option A: Supabase CLI (recommended)**

```bash
npm install
npx supabase login                      # opens a browser to authorize the CLI
npx supabase link --project-ref <ref>   # asks for the database password from step 1
npx supabase db push                    # applies every migration in order
```

`<ref>` is the project reference: the `abcdefghijklmnop` part of your Project URL. It's
also under **Project Settings → General → Project ID**. Before you confirm, check that the
CLI names *Qalam Seminary Inventory* as the linked project.

`db push` lists the migrations it will apply and asks you to confirm. Later, when new
migrations are added, run `npx supabase db push` again and only the new ones are applied.

**Option B: SQL Editor (no CLI)**

1. Open **SQL Editor → New query** in the dashboard.
2. Paste in and **Run** each file in `supabase/migrations/`, one at a time, **in filename
   order**:
   1. `20261008000001_core_schema.sql`
   2. `20261008000002_auth_and_rls.sql`
   3. `20261008000003_stock_functions.sql`
   4. `20261008000004_storage.sql`
   5. `20261008000005_editor_role_and_inventory_views.sql`
   6. `20261009000001_new_stock_reasons.sql`
   7. `20261009000002_features_schema.sql`
   8. `20261009000003_features_functions.sql`
   9. `20261009000004_reports.sql`
   10. `20261009000005_csv_import.sql`

   Run `20261009000001` on its own first: it adds new values to a list type, and Postgres
   needs that saved before the next files can use them.

   If you switch to the CLI later, first mark these as already applied so it doesn't try to
   run them again:
   `npx supabase migration repair --status applied 20261008000001 20261008000002 20261008000003 20261008000004 20261008000005 20261009000001 20261009000002 20261009000003 20261009000004 20261009000005`

**Check it worked:** in **Table Editor** you should see `categories`, `items`,
`item_variants`, `locations`, `sizes`, `stock_levels`, `stock_movements` and the other
tables. `sizes` should already contain XS–XXL. Under **Storage** there should be a private
bucket called `item-photos`.

### 6. Create the first admin

**The first user created becomes an admin automatically.** Everyone after that starts as
`editor`.

1. Go to **Authentication → Users → Add user**.
2. Choose one:
   - **Create new user:** enter your email and a password, and tick *Auto Confirm User*.
     You can sign in straight away.
   - **Send invitation:** you'll get an email with a link to set your password.

> Supabase's built-in email sender only sends a few emails per hour and is meant for
> testing. Before inviting the whole team, set up your own SMTP server (e.g. Resend,
> Postmark or Google Workspace) under **Project Settings → Authentication → SMTP Settings**.

### 7. Run the app

```bash
npm install   # if you haven't already
npm run dev
```

Open <http://localhost:3000> and sign in. The dashboard should show 0 items and 6 sizes.

### Inviting people and changing roles

Admins do this on the **Team** page:

- **Invite:** enter an email, pick a role and click **Send invite**. They get an email, set a
  password and they're in. People who haven't accepted yet are marked, with **Resend invite**.
- **Change a role** or **Remove** someone. The last admin can't be demoted, and nobody can
  remove themselves. A removed person's past changes stay in the history.
- Inviting and removing need the **secret key**: in Supabase go to **Project Settings → API
  Keys**, copy the **Secret key** (`sb_secret_...`), and add it as `SUPABASE_SECRET_KEY` (in
  Vercel: **Environment Variables**, type **Secret**, then redeploy). Treat it like a password.
- Invitation emails only work after step 4 (the email templates and the Site URL).

### 8. Emails: low stock, overdue and @mentions (optional)

The app sends three kinds of email through [Resend](https://resend.com) (free for up to
3,000 emails a month):

- a **daily low stock summary** to admins,
- **overdue check-out reminders** to the borrower (if they're on the team) and to admins,
- an email when someone **@mentions** you in a comment.

Each person can turn these on or off under **My settings**. Without Resend set up,
everything else works and these emails are simply skipped.

1. Sign up at <https://resend.com>. Under **Domains**, add your domain (e.g.
   `qalamseminary.org`) and add the DNS records it shows you at your domain provider.
   Wait until it says **Verified**.
2. Under **API Keys**, create a key with *Sending access*.
3. Add these environment variables (`.env.local`, and in Vercel):
   - `RESEND_API_KEY`: the key from step 2 (in Vercel, type **Secret**)
   - `EMAIL_FROM`: e.g. `Qalam Inventory <inventory@qalamseminary.org>`, on the verified domain
   - `CRON_SECRET`: any long random string (in Vercel, type **Secret**). It stops anyone
     else triggering the daily job.
   - `SUPABASE_SECRET_KEY` must also be set (see above): the daily job uses it.

The daily job runs at 13:00 UTC (8 AM Dallas in summer, 7 AM in winter). It's set in
[`vercel.json`](vercel.json), and Vercel runs it automatically after the next deploy; you can
see it under **Settings → Cron Jobs** in Vercel. Reminders for a check-out are sent at most
once a day.

### 9. Backups

Set up the daily database backup in [docs/BACKUPS.md](docs/BACKUPS.md). It takes about 10
minutes and includes restore steps.

---

## Using the app

| Page | What you can do |
|---|---|
| **Home** | Totals (and value, for admins), low stock, what's checked out and overdue, the last 20 changes, and shortcuts to Scan, Add item and Move stock |
| **Inventory** | Grid with photos or a table. Search by name or SKU, filter by category and location (pick several), sort by name, quantity, category or last updated. Each item shows its total; hover or tap it to see the breakdown by size and location. |
| **Item page** | Photos (take one with the phone camera or choose files), a size × location grid where every number can be changed, the history log, and a form for changes with a specific reason or note. |
| **Locations** | Every location with its item count and unit total. Open one to see everything stored there, with the same search and filters. **Move stock** moves units between locations. |
| **History** | Every stock change, filterable by location, reason, person and date |
| **Scan** | The round button in the menu. Opens the camera and jumps to the item or location on a QR label, with quick − / + |
| **Checked out** | Check gear out (who, due date, project) and back in (good, damaged or missing). Overdue items are highlighted. Only items marked *Can be checked out* appear. |
| **Kits** | Named sets of items (e.g. "Camera kit"). Shows whether everything is available and what's short; check a whole kit out at once. |
| **Print labels** | QR labels for items, sizes, locations and kits, for Avery 5160, 5163, 5164, L7160 and L7163 sheets |
| **SKU QR codes** | On the Add/Edit item form, **Generate** suggests an unused SKU from the category and name, and a QR code made from the SKU appears as you type (with a PNG download). It encodes a link like `/q/s/HOOD-BLK`, so phone cameras open the item too. Item pages and labels use it for items with a SKU, and the scanner also accepts QR codes holding just a SKU. |
| **Stock counts** | Count a location (several people at once, by scanning or tapping), compare with what's expected, and apply the corrections (admins) |
| **Purchase orders** (admins) | Suppliers and orders. Receiving an order adds the stock and logs it. **Create PO** from the low stock list. |
| **Reports** (admins) | Usage over time, fastest and slowest movers, losses, value over time and check-out stats, each with a CSV download |
| **Import CSV** (admins) | Upload a spreadsheet, match its columns, preview (with clear errors per row), then import. **Export CSV** is on the Inventory page for everyone. |
| **Team** (admins) | Invite people, change roles, remove people |
| **Settings** (admins) | Categories (with custom fields per category), Locations and Sizes: add, rename, reorder, archive, restore and delete |
| **My settings** | Name, light/dark mode, which emails you get, password, and how to install the app on your phone |

**Changing quantities is instant:** tap **+** or **−**, or tap the number and type a new
one. It saves on its own, with no Save button. Quick taps are grouped, so tapping + five
times records one "+5". In the history, + is recorded as *Received*, − as *Issued* and a
typed number as a *Count correction*. To record a different reason or add a note, use the
form under the grid on the item page.

What each role can do:

| | Admin | Editor | Viewer |
|---|:-:|:-:|:-:|
| See items, stock, history, check-outs, kits; scan; comment | ✓ | ✓ | ✓ |
| Add/edit items, photos and quantities; move stock; check out and in; kits; count stock | ✓ | ✓ | |
| Costs, retail prices and value | ✓ | | |
| Purchase orders and suppliers, reports, CSV import, applying stock counts | ✓ | | |
| Team (invite, roles, remove) and Settings (categories, custom fields, locations, sizes) | ✓ | | |

These rules are enforced in the database. Even someone calling the Supabase API directly
can't do more than their role allows.

Deleting is blocked when something is still in use, e.g. a category that has items, a
location that holds stock, or an item with stock history. Use **Archive** instead: it hides
the thing without losing any history, and **Restore** brings it back.

---

## Putting it online (Vercel)

[Vercel](https://vercel.com) hosts Next.js apps for free, so your team can use the app from
any browser or phone.

1. Sign in at <https://vercel.com> with GitHub, then click **Add New → Project** and import
   this repository.
2. Before deploying, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (type **Secret**; for inviting people and the daily emails)
   - `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET` (optional, see step 8)
3. Click **Deploy**. You'll get an address like `https://seminary-inventory.vercel.app`.
4. In Supabase go to **Authentication → URL Configuration**: set **Site URL** to that
   address and add `https://seminary-inventory.vercel.app/**` to **Redirect URLs**.
   Invitation and password-reset emails link to the Site URL.

---

## Database schema

| Table | Purpose |
|---|---|
| `profiles` | One row per user: name, email, role (`admin` / `editor` / `viewer`) |
| `categories` | Editable list. `default_has_sizes` pre-ticks "has sizes" for new items (e.g. Apparel). |
| `locations` | Editable list: name, address, description |
| `sizes` | Master size list: XS–XXL plus any custom sizes, with a sort order |
| `items` | Name, description, category, SKU, notes, `has_sizes`, timestamps, who created/updated it |
| `item_variants` | What stock is counted against. Sized items get one variant per size; unsized items get one default variant (created automatically). |
| `item_photos` | Multiple photos per item (plus a small thumbnail each), stored in the private `item-photos` bucket |
| `stock_levels` | Current quantity per variant per location (can never go below 0) |
| `stock_movements` | Permanent history: who, when, old value, new value, change, reason, note |
| `item_costs` | Unit cost and retail price per item. **Admins only**: other roles can't read it at all. |
| `category_fields` | Custom fields per category (text, number, date, dropdown, yes/no). Values live in `items.custom_fields`. |
| `kits`, `kit_items` | Kits and the item/size and quantity in each |
| `checkouts`, `checkout_lines` | Who has what, due date, project; what came back good, damaged or missing |
| `suppliers`, `purchase_orders`, `purchase_order_lines` | Purchasing. **Admins only.** |
| `audits`, `audit_lines` | Stock counts: expected vs counted per size, who counted it |
| `item_comments`, `notifications` | Comment threads and the 🔔 notifications (@mentions) |
| `inventory_levels` (view) | `stock_levels` joined with item, size, category and location names |
| `location_summaries` (view) | Item count and unit total per location |
| `low_stock` (view) | Items and sizes at or below their minimum |
| `checked_out_quantities` (view) | Units currently checked out, per size |
| `inventory_items()` (function) | Search, filter (incl. custom fields and low stock) and sort for the inventory page |
| `dashboard_summary()`, `inventory_value()`, `report_*()` | Home page totals, value (admins) and reports (admins) |

### Changing stock

The app can't write to `stock_levels` or `stock_movements` directly. Every change goes
through one of three database functions, which update the quantity **and** write the
history row in the same transaction:

```ts
// Set an absolute quantity (e.g. after a physical count)
await supabase.rpc("set_stock", {
  p_variant_id, p_location_id, p_new_quantity: 12, p_reason: "count_correction",
});

// Add or remove units
await supabase.rpc("change_stock", {
  p_variant_id, p_location_id, p_delta: -3, p_reason: "issued", p_note: "Orientation packs",
});

// Move units between locations (writes two linked history rows)
await supabase.rpc("transfer_stock", {
  p_variant_id, p_from_location_id, p_to_location_id, p_quantity: 5,
});
```

Reasons: `initial_count`, `received`, `issued`, `returned`, `count_correction`, `damaged`,
`lost`, `transfer_in` / `transfer_out` (set automatically by `transfer_stock`), and `other`
(a note is required). `checked_out`, `checked_in` and `audit_correction` are set only by
the check-out, check-in and stock count functions (`checkout_items`, `checkin_items`,
`apply_audit`), and receiving a purchase order (`receive_purchase_order`) logs `received`
with a link to the order.

### Rules the database enforces

- Stock can never go negative.
- A category that still has items can't be deleted, and a location that holds stock (or
  has history) can't be deleted. Archive them instead (`archived_at`).
- Items and sizes that have stock history can't be deleted either. Archive them instead.
- An item can only be switched between sized and unsized before any stock has been
  recorded against it.
- Admins manage categories, locations and sizes. Admins and editors edit items, photos and
  stock. Viewers can only read. Signed-out visitors can't see anything.
- Costs, suppliers and purchase orders are only readable by admins, enforced by row-level
  security, so they never reach anyone else's browser.
- People can only change their own name, theme and email settings, and only admins can
  change roles. Comments can be edited only by their author and deleted by the author or an
  admin.

---|---|
| Custom fields per category | `items.custom_fields` (jsonb) already exists. Add a `category_fields` table to define the fields. |
| Kits / bundles | `items.item_type` already has a `kit` value. Add a `kit_components` table (kit item → component variant, quantity). |
| Check-outs | Add a `checkouts` table. Its stock changes use `stock_movements.reference_type = 'checkout'` and `reference_id`. |
| Purchase orders | Add `purchase_orders` and `purchase_order_lines` tables (pointing at variants). Receiving creates `received` movements that reference the line. |
| Archiving | `archived_at` already exists on items, variants, categories, locations and sizes |

---

## Project layout

```
src/
  app/
    (app)/            signed-in area: dashboard, items, locations, checkouts, kits,
                      purchase-orders, audits, labels, scan, import, reports, team, settings
    api/cron/daily/   daily low stock + overdue emails (Vercel Cron)
    api/export/       CSV export and import template
    q/[kind]/[id]/    where QR codes point (redirects to the item, location or kit)
    auth/confirm/     handles invite & password-reset email links
    login/            sign-in page and auth server actions
    manifest.ts       PWA manifest (public/sw.js is the service worker)
  components/
    inventory/        inventory grid/table, filters, +/− quantity control, breakdown
    photos/           gallery, reordering and captions, camera/file upload buttons
    qr/, charts/, comments/
  lib/
    auth.ts           current user/role helpers used by pages and actions
    inventory.ts      loads the inventory page (calls inventory_items())
    upload-photos.ts  compresses photos in the browser and uploads them
    supabase/
      client.ts       Supabase client for Client Components
      server.ts       Supabase client for Server Components / Actions / Route Handlers
      proxy.ts        session refresh + sign-in redirect (used by src/proxy.ts)
      database.types.ts  generated TypeScript types for the schema
  proxy.ts            Next.js proxy (formerly "middleware")
supabase/
  migrations/         SQL migrations, applied in filename order
  templates/          invite and password-reset email templates
docs/                 team guide, backups and restoring
scripts/              restore-backup.sh
.github/workflows/    daily database backup
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at <http://localhost:3000> |
| `npm run build` / `npm start` | Production build and start |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run db:push` | Apply new migrations to the linked Supabase project |
| `npm run db:types` | Regenerate `database.types.ts` from the linked project after a schema change |

## Brand

| Token | Value |
|---|---|
| `brand` (Pantone 553 C) | `#284734` (Tailwind: `bg-brand`, `text-brand`, `brand-50`–`brand-900`) |
| `cream` | `#F5F0E1` (Tailwind: `bg-cream`, `cream-50`–`cream-400`) |

Logo files are in `public/`: `logo.png` (full seal), `logo-mark.png` (green emblem) and
`logo-mark-cream.png` (cream emblem, for use on green). The app icon is `src/app/icon.png`.
