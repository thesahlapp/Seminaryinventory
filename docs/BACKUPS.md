# Backups and restoring

## What is backed up

A GitHub Action ([`.github/workflows/backup.yml`](../.github/workflows/backup.yml)) runs
every day at about 3 AM Dallas time. It saves the whole database: every item, quantity,
history row, check-out, purchase order, comment and setting, plus everyone's login. The
backup is encrypted with a passphrase only you have and kept for **90 days**.

**Not included: photos.** Photo files live in Supabase Storage, not the database. If losing
them would hurt, see [Photos](#photos) below.

## One-time setup (about 10 minutes)

1. **Get the database connection string.** In Supabase, open the project and click
   **Connect** (top bar). Under **Session pooler**, copy the URI. It looks like
   `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`.
   Replace `[YOUR-PASSWORD]` with the database password from when you created the
   project. If you've lost it, reset it under **Project Settings → Database**.
   (Use the *Session pooler* string, not *Direct connection*: GitHub can't reach the direct one.)
2. **Make a backup passphrase.** Generate a long random one in your password manager and
   save it there as "Inventory backup passphrase". **Without it, the backups can't be
   opened.** Nobody, including GitHub and Supabase, can recover it.
3. **Add both as GitHub secrets.** In the GitHub repository go to **Settings → Secrets and
   variables → Actions → New repository secret** and add:
   - `SUPABASE_DB_URL`: the connection string from step 1
   - `BACKUP_PASSPHRASE`: the passphrase from step 2
4. **Run it once now.** Go to the **Actions** tab → **Database backup** → **Run workflow**.
   After a minute or two it should show a green tick, with a file called
   `inventory-backup-YYYY-MM-DD` under **Artifacts**.

If a nightly backup ever fails, GitHub emails the repository owner.

> **Keep the repository private** if you can. The backups are encrypted, so they're safe
> either way, but a private repo keeps them out of sight entirely.
>
> **Supabase Pro** ($25/month) also takes its own daily backups, which you restore with one
> click under **Database → Backups**. Supabase's free plan doesn't. The GitHub backups work
> on either plan.

## Restoring

Restore into a **new, empty** Supabase project. Never restore over the live one: if
something goes wrong you still have the original.

You need a computer with `psql` (PostgreSQL 15 or newer) and `gpg`. On a Mac:
`brew install libpq gnupg && brew link --force libpq`.

1. **Download the backup.** In GitHub: **Actions → Database backup**, open the run from the
   day you want, and download the artifact under **Artifacts**. Unzip it to get
   `inventory-backup-YYYY-MM-DD.tar.gz.gpg`.
2. **Decrypt and unpack** (asks for the backup passphrase):

   ```bash
   gpg -d inventory-backup-YYYY-MM-DD.tar.gz.gpg > backup.tar.gz
   mkdir backup && tar -xzf backup.tar.gz -C backup
   ```

   The `backup` folder now has `roles.sql`, `schema.sql` and `data.sql`.
3. **Create a new Supabase project** (README step 1), and copy its **Session pooler**
   connection string (as in setup step 1 above). Don't run the migrations: the backup
   already contains everything.
4. **Restore.** From this repository's folder:

   ```bash
   scripts/restore-backup.sh path/to/backup "postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres"
   ```

   It restores the tables, data and logins, puts the security permissions back, and ends
   with a count like `412 items, 9876 history rows, 7 users`.
   (`roles.sql` only holds Supabase's built-in role settings, which a new project already
   has, so the script skips it.)
5. **Finish setting up the new project.** These settings live outside the database:
   - README steps 3 and 4: turn off sign-ups, set the Site URL and redirect URLs, and paste
     in the two email templates. Re-enter your SMTP settings if you had them.
   - Tell the Supabase CLI the migrations are already applied, so future
     `npx supabase db push` runs don't try to re-create the tables:
     `npx supabase link --project-ref <new-ref>`, then
     `npx supabase migration repair --status applied` followed by every migration number
     in `supabase/migrations` (the part of each filename before the `_`).
6. **Point the app at it.** In Vercel → **Settings → Environment Variables**, update
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
   `SUPABASE_SECRET_KEY` to the new project's values, then **Redeploy**. Update the
   `SUPABASE_DB_URL` GitHub secret too, so backups come from the new project.

Everyone signs in with the same email and password as before.

### Practice once

Restoring for real is stressful. Do a practice restore into a throwaway project once a year
or so (steps 1 to 4), check the counts look right, then delete the throwaway project.

## Photos

Photos are in the `item-photos` storage bucket. After a restore, items keep their photo
records, but the pictures show as "Photo unavailable" until the files are back. Options:

- **Restoring in place with Supabase Pro's own backups** (same project) doesn't touch the
  photo files, so nothing is lost.
- **Manual copy:** in Supabase **Storage → item-photos**, you can download folders. Doing
  this every few months is a reasonable safety net for a small team. To restore, upload the folders back into the
  `item-photos` bucket of the new project (the restore creates the bucket) in the same
  structure.
