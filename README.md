# Qalam Seminary Inventory

Inventory management for Qalam Seminary, built with Next.js (App Router), TypeScript,
Tailwind CSS and Supabase (Postgres, Auth, Storage).

- **Stock** is tracked per item, per size (when the item has sizes), per location,
  e.g. "Black Hoodie · M · Warehouse: 12".
- **Every quantity change** is logged with who, when, old value, new value and a reason.
- **Sign-in is invite-only.** There are three roles: `admin`, `staff` and `viewer`.

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

   If you switch to the CLI later, first mark these as already applied so it doesn't try to
   run them again:
   `npx supabase migration repair --status applied 20261008000001 20261008000002 20261008000003 20261008000004`

**Check it worked:** in **Table Editor** you should see `categories`, `items`,
`item_variants`, `locations`, `sizes`, `stock_levels`, `stock_movements` and the other
tables. `sizes` should already contain XS–XXL. Under **Storage** there should be a private
bucket called `item-photos`.

### 6. Create the first admin

**The first user created becomes an admin automatically.** Everyone after that starts as
`staff`.

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

### Inviting more people and changing roles

- **Invite:** **Authentication → Users → Add user → Send invitation**. New users start as
  `staff`.
- **Change a role:** **Table Editor → profiles**, then edit the `role` column (`admin`,
  `staff` or `viewer`). Only admins can change roles, and the last admin can't be demoted.

---

## Database schema

| Table | Purpose |
|---|---|
| `profiles` | One row per user: name, email, role (`admin` / `staff` / `viewer`) |
| `categories` | Editable list. `default_has_sizes` pre-ticks "has sizes" for new items (e.g. Apparel). |
| `locations` | Editable list: name, address, description |
| `sizes` | Master size list: XS–XXL plus any custom sizes, with a sort order |
| `items` | Name, description, category, SKU, notes, `has_sizes`, timestamps, who created/updated it |
| `item_variants` | What stock is counted against. Sized items get one variant per size; unsized items get one default variant (created automatically). |
| `item_photos` | Multiple photos per item, stored in the private `item-photos` bucket |
| `stock_levels` | Current quantity per variant per location (can never go below 0) |
| `stock_movements` | Permanent history: who, when, old value, new value, change, reason, note |
| `inventory_levels` (view) | `stock_levels` joined with item, size, category and location names |

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
(a note is required).

### Rules the database enforces

- Stock can never go negative.
- A category that still has items can't be deleted, and a location that holds stock (or
  has history) can't be deleted. Archive them instead (`archived_at`).
- Items and sizes that have stock history can't be deleted either. Archive them instead.
- An item can only be switched between sized and unsized before any stock has been
  recorded against it.
- Admins manage categories, locations and sizes. Admins and staff edit items, photos and
  stock. Viewers can only read. Signed-out visitors can't see anything.

### Room for future features

Nothing for these is built yet. The schema already leaves room for each:

| Feature | How it fits |
|---|---|
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
    (app)/            signed-in area (header + dashboard, set-password page)
    auth/confirm/     handles invite & password-reset email links
    login/            sign-in page and auth server actions
  lib/
    auth.ts           getCurrentProfile() helper
    supabase/
      client.ts       Supabase client for Client Components
      server.ts       Supabase client for Server Components / Actions / Route Handlers
      proxy.ts        session refresh + sign-in redirect (used by src/proxy.ts)
      database.types.ts  generated TypeScript types for the schema
  proxy.ts            Next.js proxy (formerly "middleware")
supabase/
  migrations/         SQL migrations, applied in filename order
  templates/          invite and password-reset email templates
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
