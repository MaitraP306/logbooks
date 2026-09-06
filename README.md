# Logbooks

A React + Supabase operations portal for restaurant store logbooks, temperature checks, manager checklists, administration, and completion reporting.

## UI

The application uses a professional operations-dashboard visual system:

- restrained navy/slate palette with teal operational accent
- responsive desktop/tablet/mobile layouts
- sticky navigation with active report/admin states
- card-based store selection and task dashboards
- clear completed/pending status badges
- consistent form controls, focus states, validation/error/success states
- polished temperature and checklist workflows
- tabbed administration and reporting surfaces
- responsive tables with mobile-friendly layouts

## Project structure

```text
src/
├── App.jsx
├── main.jsx
├── App.css
├── index.css
├── components/
│   ├── Layout.jsx
│   ├── TemperatureRow.jsx
│   ├── admin/
│   └── reports/
├── pages/
│   ├── Home.jsx
│   ├── StorePage.jsx
│   ├── TaskPage.jsx
│   ├── admin/
│   └── reports/
├── lib/
│   └── supabase.js
└── utils/
    ├── date.js
    ├── errors.js
    └── tasks.js
```

`App.jsx` is intentionally kept as a routing entry point. Page-specific logic lives under `pages/`, reusable UI under `components/`, Supabase connectivity under `lib/`, and small shared helpers under `utils/`.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and supply your Supabase project values.

3. Start Vite:

```bash
npm run dev
```

4. Open `http://localhost:5173/`.

## Production build

```bash
npm run lint
npm run build
npm run preview
```

The repository intentionally does not include `node_modules` or `.env.local`. `node_modules` should be recreated with `npm install`, and environment credentials should stay local.

## Routes

- `/` — store selection
- `/store/:id` — today's store tasks
- `/store/:id/:taskType/:timePeriod/:mode` — task completion/view
- `/reports` — completion reports
- `/admin` — administration
- `/admin/temperature/:logId` — temperature-log editing

## Admin configuration additions

The Admin area now includes:

- **Store Setup** — create stores and soft-remove stores when removal is enabled.
- **Settings** — controls whether store removal is allowed and defines per-store, per-field temperature-log validation rules.
- **Checklist Builder options** — each checklist question can define its own answer choices instead of being limited to Yes/No/N/A.
- **Edit Temperature Logs** remains available as its own tab.

### Supabase migration

Run `supabase/migrations/20260906_admin_settings_checklist_options.sql` in the Supabase SQL Editor before using these features. It adds `checklist_items.options` and the `app_settings` table with safe defaults.

## Admin configuration migration

After the original `20260906_admin_settings_checklist_options.sql` migration, run:

```text
supabase/migrations/20260906_per_store_temperature_rules.sql
```

in the Supabase SQL Editor. This adds per-store/per-field temperature validation rules, seeds rules for existing stores and temperature items, and adds authenticated admin policies for configuration mutations.

### Temperature validation model

Validation is configured independently for each store and each user-entered field:

- Completed by: text schema, required state, min/max length
- Log date: date schema, required state, earliest/latest date
- Notes: text schema, required state, min/max length
- Every temperature item: decimal/whole-number schema, required state, min/max value, decimal places, and range enforcement

The employee temperature form and the admin historical-log editor both apply these rules before saving. Database triggers also enforce the configured metadata and numeric rules on writes.

### Store RLS

The admin configuration migration grants authenticated users the required SELECT/INSERT/UPDATE access to store configuration. If you have already run the first two migrations, also run `20260906_admin_rls_complete.sql` so the admin editor can read/write every operational table it needs without RLS failures.
