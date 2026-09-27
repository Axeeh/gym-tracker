# Scheda (gym tracker)

## Scope

Alessio's gym log, replacing the iPhone note where he rewrote weights by hand, and shared
with his friends through the same link. A PWA installed from Safari on the home screen:
each phone keeps its own data. First launch asks where to start (ready-made Push / Pull /
Legs plan, build your own from the exercise catalog, or restore a backup). Then sets of
weight + reps, full session history, progress charts, progression hints and an
in-app plan editor. UI in Italian, "tu", no jargon. No accounts, no backend, no analytics.

Stack: Vite 8 + React 19 + TypeScript, hand-written CSS with OKLCH tokens
(`src/styles.css`), `lucide-react` icons, Vitest for the logic. npm, not pnpm.

## Commands (run from this folder)

- `npm run dev`: dev server on port 5180 (launch config `gym-tracker` at workspace root)
- `npm run build`: typecheck + production build into `dist/`
- `npm run preview`: serve the build on 5181 (launch config `gym-tracker-build`); the only
  way to test the service worker, which is registered in production builds only
- `npm test`: Vitest on `src/logic.test.ts`
- `npm run icons`: regenerate `public/` icons with Pillow (`scripts/icone.py`)

## Architecture

- `src/types.ts`: data model. `src/seed.ts`: `freshState()` (empty, `onboarded: false`,
  shows the Welcome screen), `templateDays` (Alessio's Push / Pull / Legs plan **without**
  weights; range "6 8" became a single target, the higher number) and `noteSessions()`.
- Alessio's own note weights are **not** in the app: `scripts/scheda-alessio.ts` writes
  `dati/scheda-alessio.json`, a backup he imports with "Ripristina un backup". Keep his
  personal numbers out of `src/`, the bundle is public.
- `src/catalog.ts`: the exercise catalog (id, muscle group, icon, default sets / target /
  rest / step). `fromCatalog` keeps the catalog id as exercise id when free, so a rebuilt
  plan finds its history again. `suggestedGroups` maps day names (Push, Pull, Legs, Upper,
  Lower...) to muscle groups for the picker's "Consigliati" filter.
- `src/screens/Welcome.tsx` (first launch), `Builder.tsx` (`#/crea`: days, then exercises
  per day, then summary; replaces the plan, keeps history, reuses day ids by name),
  `AddExercises.tsx` (`#/scheda/aggiungi/<dayId>`), both built on `Picker.tsx`.
- `src/logic.ts`: pure functions (prefill from the last session, progression hint, next
  day in rotation, records, chart series, backup validation). Covered by tests.
- `src/store.ts`: one `AppState` in `localStorage` key `scheda.v1`, exposed through
  `useSyncExternalStore`. Every action writes immediately; the in-progress workout
  (`drafts[dayId]`) survives the app being closed mid-session.
- `src/icons.ts`: the exercise pictograms, original line drawings on a 48x48 grid (data
  only: `d`, thin cable strokes, head circles), `guessIcon` picks one from the exercise
  name, `iconFor` prefers the icon chosen in the editor. To review them as an image, write
  a small sheet SVG from `ICONS` and render it with `rsvg-convert`.
- `src/screens/`: Home, Workout, History, Progress, Plan. Hash routing (`#/allenamento/push`)
  so it works on any static host.
- `vite.config.ts` emits `dist/sw.js` with the precache list of the build (offline in
  the gym). The cache name changes with every build.

## Rules

- **Data lives only on the phone** (`localStorage`). Never change the storage key or the
  `v: 1` shape without a migration in `normalizeState`: Alessio's history is in it.
  Backup = export/import JSON from the Scheda tab.
- Supersets are exercises with `parts: [A, B]`; every set holds one entry per part.
  Keep that invariant in any new feature (chart, text export, records).
- A set is saved only when ticked; ticking with empty reps fills in the target.
- Day colors: `[data-color]` tokens in `styles.css`, validated with the dataviz palette
  script (dark L 0.67, light L 0.62). Chart marks use `--day`; text never uses it.
- `node_modules` is a symlink to `node_modules.nosync/` (iCloud trick). `npm install`
  replaces the symlink with a real folder: afterwards run
  `mv node_modules node_modules.nosync && ln -s node_modules.nosync node_modules`.
  `resolve.preserveSymlinks` in `vite.config.ts` is what makes the dev server work with it.
- Live at **https://la-mia-scheda-gym.netlify.app** (Netlify site `la-mia-scheda-gym`,
  team "Axeeh's team"). Hosting headers in `netlify.toml`. Update = `npm run build` then
  `netlify deploy --prod --dir dist` from this folder (the site link lives in the
  gitignored `.netlify/`). **Never change the site address**: every phone's data is tied
  to it, a new address means starting from zero. On iOS the home screen app has storage
  separate from Safari, which is why Welcome tells people to install first.
- In this Chrome, `window.scrollTo()` returns a Promise: never return it from a
  `useEffect` arrow without braces (React treats it as a broken cleanup and the screen
  goes blank).

## Verify before done

`npm test`, `npm run build`, then check the dev server at mobile width (375) in dark and
light: first launch (clear `localStorage` key `scheda.v1`), the builder, home, a workout
with a ticked set, a superset, the progress chart, the plan editor.
