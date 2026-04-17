# HMC Planning — /slantis

Planning coordination tool between /slantis team and HMC Architects — merges Odoo projects + HubSpot deals into an editable monthly planning table.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Auth | NextAuth.js v5 beta + Google OAuth |
| Styling | Tailwind CSS + /slantis brand (Space Grotesk, DM Sans, #FF7700) |
| Database | Turso (libSQL) via `@prisma/adapter-libsql` + Prisma 5 ORM |
| Local dev DB | SQLite file (`file:./dev.db`) |

---

## Open Tasks

- [ ] **Run `prisma db push`** — adds `soldHrs` + `soSeeded` columns to Turso (run `vercel login` first, then `vercel env pull .env.local && npx prisma db push`)
- [ ] Build user management admin UI (currently manual via Turso dashboard)
- [ ] Rename OAuth app "process-job-emails" → "slantis" in GCP Console (APIs & Services → OAuth consent screen)
- [ ] Verify SO column returns human-readable name (`sale_order_id[1]`) instead of numeric ID
- [ ] Month visibility toggle UI (currently `hidden: true` in `months.ts` only)

---

## Dev Quickstart

```bash
cp .env.example .env   # fill in values
npm install
npm run dev            # → http://localhost:3000
```

---

## Session Log

### 2026-04-16 (session 2)
- Group collapse/expand: all groups start collapsed; click header to toggle (▲/▼)
- Frozen header: two-table layout — black header card static above scrollable body div; JS syncs horizontal scroll
- Group cards: each group is a separate rounded card with colored header, bullet, name, count
- "H" → "Hrs" in monthly sub-header columns
- Effort Hrs: computed from sum of monthly hours (read-only); replaces manual Effort field
- Sold Hrs: new editable column; auto-seeded once from Odoo SO `x_studio_sold_hours` (soSeeded flag)
- Dates editable for all rows; Odoo rows seeded once from SO project start/end dates
- Color dot on Effort Hrs: 🟢≤5% · 🟡≤15% · 🔴>15% deviation from Sold Hrs
- Prisma schema: `soldHrs Float?` + `soSeeded Boolean @default(false)` added to ManualData
- **Pending:** `prisma db push` to apply schema to Turso

### 2026-04-16 (session 1)
- Registered project: memory file + registry entry created
- Cloned repo from `nmd-slantis/hmc-capacity`
- Documented full stack, env vars, file structure, DB schema, and open tasks
- Reviewed Vercel deployment history (8 deploys, latest READY on `cb35e12`)
- Confirmed only one branch exists (`claude/hmc-architects-home-page-wutmV`) — no `main`
- App is built and working; blocked only by missing Vercel credentials (Odoo + HubSpot)
- Planning/coordination session only — no code changes
