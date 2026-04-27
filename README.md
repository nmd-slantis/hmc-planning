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

- **Details tab: sort by stage descending by default** — old/dead deals still showing at top; default sort should push them down
- **Active filter: old deals still visible** — deals from before 2025 without SO still appearing; review active filter logic

---

## Dev Quickstart

```bash
cp .env.example .env   # fill in values
npm install
npm run dev            # → http://localhost:3000
```

---

## Session Log

### 2026-04-27
- Office color picker fix — debounced `onChange` (700ms) replaces broken `onBlur` on hidden input
- "Lost" group in Office tab — Canceled rows isolated in rose group at the bottom
- Databases tab: color column after Notes; auto random brand color on new office; "Randomize colors" button (`POST /api/offices/seed-colors`)
- Scrollbar gutter (16px) added to `ServiceOrdersTable` and `OfficesTable`
- Manual month HRS override — click any month cell to override (bold when set, ⟳ to clear); `distributeWithOverrides` redistributes remaining hrs proportionally by weekday; API deletes key on null
- Brand color picker panel — portal panel with 7 /slantis brand swatches + custom color section (localStorage, 20 max)
- Brand colors corrected — actual /slantis palette: Orange #FF7700, Yellow #FFE900, Sky Blue #5BD9D6, Greenie #44C15D, Pinky #F479D1, Deep Purple #552497, Blackie #202022
- FTE start-exclusive fix — `getMonthWeekdaysForProject` counts from `date_start + 1`; Hoover MS_CCDs Oct 25 → 1 workday → 1.0 FTE

### 2026-04-21
- Filter enhancements: numeric toggle (= / ≥ / ≤) on Effort Hrs + per-month Hrs columns; multi-word AND matching on all text filters (split on space); month Hrs filter inputs in Planning tab
- Stage pills colored white → full group color by HubSpot `displayOrder`; gradient stable when filtering; removed static `HS_STAGE_COLORS` map
- Group renames: Service Pipeline → Ongoing, Sales Pipeline → Opportunities, Closed Lost → Canceled
- Closed Won deals merged into Ongoing; forced `hsStageOrder = -1` so they sort before Kick off Meeting in gradient
- "Project Canceled/Cancelled" stage labels now route to Canceled group (fixed ordering bug in `hsGroup()`)
- Active filter: hides deals ending 2025 or earlier without SO; uses end date falling back to start date; hides "Project Closure" stage label
- Fixed 1970 date bug: `isValidDate` guard applied to HubSpot ms timestamps before using them for dates
- Color picker for Offices and Service Orders: colored swatch column, native browser color input, saves on close; auto text contrast via luminance (`src/lib/color.ts`); chips in SoRelationCell and OfficeRelationCell use stored colors
- Turso DDL migration: added `color TEXT` to `OfficeOption` and `ServiceOrder` tables

### 2026-04-20 (session 2)
- Offices tab (4th): `OfficesTable.tsx` CRUD; `OfficeOption` schema + `address`/`contactName`/`contactEmail`/`notes`; API routes; `LinkedProjectsCell` shows linked planning rows
- Manual dates: editable Start/End in all tabs; breaks live Odoo sync; bold when manual; ⟳ hover resets to live; `startDateManual`/`endDateManual` flags on ManualData
- Tab renames: "Planning" → "Pipeline", "Administration" → "Details"
- DocuSign moved from Admin/Details row to Service Orders tab (per-SO modal URL editor)
- Stage labels: `fetchDealPipelineStages()` fetches real labels from HubSpot `/crm/v3/pipelines/deals`; `hsStageLabel` on PlanningRow; StageCell shows e.g. "Appointment Scheduled"
- Office column: replaced `OfficeDropdown` (inline CRUD) with clean `OfficeRelationCell` picker using pre-loaded offices
- Date picker: `type="date"` → `type="text"` MM/DD/YYYY — consistent format, no locale jump
- HubSpot/Odoo icons: `w-6 h-6` → `w-5 h-5`
- Pipeline scroll fix: body `maxHeight` `calc(100vh - 260px)` in Pipeline (vs 220px in Details)
- Multiple ESLint/TypeScript fixes for Vercel builds

### 2026-04-20
- Added Service Orders third tab: Prisma models (`ServiceOrder` + `ServiceOrderProject`), API routes (GET/POST, PATCH/DELETE), full CRUD `ServiceOrdersTable` component
- Bidirectional relations: Admin SO# column → single-select Service Orders picker (`SoRelationCell`); Service Orders Project/Deal → multi-select back to planning rows (`ProjectRelationCell`)
- HubSpot Stage column in Administration (after icons): colored pills via `HS_STAGE_MAP` + `StageCell`
- Office dropdown pre-warm: `prewarmOfficeCache()` exported and called in `HmcClientLayout` `useEffect` at page load
- Removed row count "185 projects · Odoo + HubSpot" from header
- All table headers left-aligned and uppercase across all tabs
- Table full-width fix: Comments `col` has no fixed width (absorbs extra viewport); inner container block layout
- Service Orders UX: big orange circle ✓ at left of new row; X delete on hover; auto SO# placeholder = max+1

### 2026-04-17 (evening)
- Removed collapsible header toggle — single compact black bar with title, tab pills, sign-out inline
- Admin column order: HS/Odoo/DocuSign now admin-only (hidden in Planning); SO # and SO Confirmation between SO and Comments; Office at end
- Body scroll area wrapped in `rounded-xl overflow-hidden` outer frame — group card corners stay rounded during horizontal scroll
- Merged "Active only" filter into sticky Name cell of Row 2 (labeled "Active"); Planning now has 2 header rows instead of 3
- Row 2 height unified to 36px across both Planning and Administration tabs

### 2026-04-17
- Rebranded: Vercel `hmc-capacity` → `hmc-slantis`, GitHub → `hmc-planning`, page titles → "HMC Planning", domain → `hmc-slantis.vercel.app`
- NEXTAUTH_URL updated; Google OAuth redirect URI updated in GCP
- Column reorder: HS icon first, ODOO icon second; white SVG icons (HubSpot sprocket, Odoo circle)
- HubSpot: seed dates from `project_start_date`/`project_end_date`; SO lookup in Odoo by name for `odooSoUrl` + `soldHrs`
- Odoo rows: seed dates from linked project(s) via `project_ids` (min start / max end)
- Fixed critical Odoo auth bug: cookie now extracted from Set-Cookie and forwarded via `Cookie` header on all call_kw requests
- Fixed 2 TS build errors (Array.from for Map/Set iterators)

### 2026-04-16 (session 2)
- Group collapse/expand: all groups start collapsed; click header to toggle (▲/▼)
- Frozen header: two-table layout — black header card static above scrollable body div; JS syncs horizontal scroll
- Group cards: each group is a separate rounded card with colored header, bullet, name, count
- Effort Hrs: computed from sum of monthly hours (read-only); replaces manual Effort field
- Sold Hrs: new editable column; auto-seeded once from Odoo SO `x_studio_sold_hours` (soSeeded flag)
- Dates editable for all rows; Odoo rows seeded once from SO project start/end dates
- Prisma schema: `soldHrs Float?` + `soSeeded Boolean @default(false)` added to ManualData

### 2026-04-16 (session 1)
- Registered project: memory file + registry entry created
- Cloned repo from `nmd-slantis/hmc-capacity`
- Documented full stack, env vars, file structure, DB schema, and open tasks
- Planning/coordination session only — no code changes
