# GTD System — Design & Architecture

> Reference document for AI assistants (and human collaborators) working on Kevin Pickhardt's personal GTD system. Read this end-to-end before making non-trivial changes.

## 1. Purpose

This is a single-user personal task management system implementing the **Getting Things Done (GTD)** methodology, with extensions for strategic horizons (areas of focus, goals). Kevin is the only user. The system is intended to support both daily execution (what to work on now) and strategic review (am I spending attention where I said I would).

The system is a **single-page web app served from GitHub Pages**, with data persisted to **Google Drive** via the Drive API. There is no backend, no database, no auth beyond Google sign-in.

## 2. Stack

- **Frontend**: One HTML file (`index.html`, ~5,700 lines, ~250 KB) with inline `<style>` and `<script>` blocks. No build step, no framework, no dependencies beyond what's loaded from CDN at runtime.
- **Auxiliary files**: `brand.js` (visual theming), `help.json` (in-app help content), `README.md`.
- **Hosting**: GitHub Pages, `https://kpickhardt-gtd.github.io/gtd/`. Push to `main` branch deploys automatically.
- **Data store**: A single JSON file `gtd-cloud-state.json` in a Google Drive folder. The app uses the Drive REST API directly via OAuth2 (Google Identity Services).
- **Local cache**: `localStorage` mirrors the cloud state so the app remains usable when offline or when the Drive token expires; reconciliation happens on next successful Drive load.

## 3. Repository layout

```
kpickhardt-gtd/gtd/
├── index.html           # The entire application
├── brand.js             # Visual branding constants
├── help.json            # Help docs content (loaded at runtime)
├── README.md            # Public-facing description
└── SYSTEM_DESIGN.md     # This file
```

Local development clone (Kevin's machine):

```
G:\My Drive\Git Repository for GTD\gtd\
```

This is **inside Google Drive File Stream** but is a real git working tree. Edits go through GitHub Desktop (commit + push). **Do not edit `index.html` inside the OneDrive Artifacts folder** — that path is legacy and not the deployment source anymore.

## 4. Data model (v2)

The cloud state file is v2. Shape:

```js
{
  version: 2,
  savedAt: "<ISO timestamp>",
  data: {
    items: [...],          // Single unified array of all items
    areas: [...],          // First-class strategic categories
    people: [...],         // First-class person roster (Phase 1+)
    nextIdCounters: {...}, // Per-day ID allocation tracking
    reviewState: {...},    // Daily/weekly/monthly review checklist progress
    horizons: {...},       // Goals, vision, purpose (strategic layer)
    sessionlog: [...]      // Decision log / context for future sessions
  }
}
```

### Item shape (every entry in `data.items[]`)

```js
{
  id: "260609-07",        // YYMMDD-NN, no type prefix; ID is stable across kind changes
  kind: "inbox" | "action" | "project",
  text: "...",            // Display name
  notes: "...",
  tags: ["@computer", "#estate"],   // Multi-select; replaces v1 'context'
  status: "next" | "waiting" | "someday" | "done" | "active" | "blocked",
  created: "2026-06-09",
  completed: null | "<ISO>",
  priority: "high" | "med" | "low",
  projectId: null | "260605-03",    // Actions/Waiting/Calendar -> parent project
  areaId: null | "a1",              // Direct link (overrides project's area)
  dueDate: null | "2026-06-15",     // Must be done by
  scheduledAt: null | "<ISO>",      // Locked-in fixed time
  focusDate: null | "2026-06-09",   // User-chosen "I plan to work on this then"
  outcome: null | "...",            // Project only — the success outcome
  who: null | "Bill",               // Waiting only — DEPRECATED, use personIds instead
  since: null | "...",              // Waiting only
  energy: null | "focused" | "quick",
  personIds: ["p-003", "p-007"],    // People explicitly tagged on this item (Phase 1+)
  excludedPersonIds: ["p-005"],     // Actions only — project-inherited people to opt out of (Phase 5)
  history: [{ ts: "<ISO>", note: "..." }]   // Audit trail
}
```

Status valid sets (enforced by `VALID_STATUSES` constant):

- **action**: `next`, `waiting`, `someday`, `done`
- **project**: `active`, `blocked`, `someday`, `done`
- **inbox**: no status (pre-triage)

### Area shape

```js
{
  id: "a1",
  name: "Work delivery & strategy",
  description: "...",
  active: true,            // Inactive areas excluded from sum & default view
  targetPct: 25,           // 0-100, target share of attention
  goals: []                // Strategic 1-yr goals (future expansion)
}
```

### Person shape (`data.people[]`, Phase 1+)

```js
{
  id: "p-007",             // p-NNN, allocated by nextPersonId() — stable across renames
  name: "Shane Phillips",
  email: "sphillips@pharos.com",
  phone: "",
  title: "Partner Program Manager",
  org: "Pharos",
  category: "pharos",      // Enum: pharos | elm-oak | vistage | vendor | family | friend | other
  active: true,
  cadence: "weekly",       // Free-string label: weekly | monthly | quarterly | ''
  lastInteraction: null,   // Reserved for future cadence/neglect detection (not yet wired)
  notes: ""
}
```

Category is single-select; the enum drives group ordering in the People tab. `cadence` is currently a label only — no neglect check yet; Kevin explicitly deferred that in Aug 2026.

### ID convention

- **Format**: `YYMMDD-NN` (e.g. `260609-07`), 9 chars, no type prefix.
- **Stable** across kind/status changes. An item promoted from Inbox → Project keeps its ID.
- **Collision strategy**: on creation, if `YYMMDD-NN` already exists, NN is bumped. Day counter persisted in `data.nextIdCounters`.
- **Legacy IDs** (`n1`, `p3`, `n-mp...`, `i-rdt-...`, `i-trello-...`) may remain in older items; treat as opaque strings. Do NOT assume a particular prefix maps to a particular kind — use the `kind` field.

### Tag convention

Tags are a multi-string array. Two prefix conventions in use:

- `@mode` — `@computer`, `@email`, `@phone`, `@home`, `@work`, `@meeting`, `@errands`, `@think`, `@ask`, `@draft`
- `#topic` — `#josh`, `#estate`, `#vistage`, etc.

The first `@`-prefixed tag is aliased to a synthetic `item.context` field for legacy code that expected it. Render code can read either.

## 5. Data flow

### Load (page open)

1. `bootstrap()` runs on `DOMContentLoaded`.
2. Try to load from Google Drive (if `gdriveToken` exists in localStorage and isn't expired).
3. If Drive load succeeds: deserialize, run `migrateV1ToV2()` (no-op if already v2), merge with `DEFAULT_DATA` template, call `syncBucketViews()`, then `render()`.
4. If Drive load fails or token missing: fall back to localStorage; same migration + sync + render chain.
5. If neither exists: empty defaults; user starts fresh.

### Mutation

All in-app mutations should go through helpers:

- `addItemToBucket(bucket, fields)` — creates a new item with proper kind/status/ID
- `removeItemById(id)` — splice from `data.items` + resync
- `changeItemStatus(id, newStatus)` — updates status + history + completed timestamp
- `convertToProject(id)` / `convertToAction(id)` — kind conversion preserving fields

After any mutation: `syncBucketViews()` → `save()` → `render()`. Save persists to localStorage immediately and schedules a Drive save (debounced ~1s).

### Derived bucket views

`syncBucketViews()` re-derives bucket arrays from `data.items[]`:

```js
data.inbox    = items.filter(it => it.kind === 'inbox');
data.next     = items.filter(it => it.kind === 'action' && (it.status === 'next' || it.status === 'done'));
data.projects = items.filter(it => it.kind === 'project');
data.waiting  = items.filter(it => it.kind === 'action' && it.status === 'waiting');
data.calendar = items.filter(it => it.kind === 'action' && it.status !== 'done' && it.status !== 'someday' && (it.dueDate || it.scheduledAt || it.date));
data.someday  = items.filter(it => it.kind === 'action' && it.status === 'someday');
```

Render functions read from these derived arrays — they're never serialized to cloud. Only `items` and `areas` (plus the meta fields above) are written by `_buildV2Payload()`.

### Save

- `save()` triggers localStorage write + debounced Drive save.
- `saveToDrive(force)` writes a complete v2 payload built by `_buildV2Payload()`.
- A guard prevents save when `cloudBootstrapped` is false AND `looksLikeDefaultData(data)` is true — protects against overwriting real cloud data with an empty initial state before first load completes.

## 5.5. People (Phases 1–5, Aug 2026)

### Overview

Every item can be tagged with one or more people via `item.personIds[]`. People are first-class entities with their own tab, table view, categories, and cadence field. The picker widget is reused across the four capture forms (Inbox, Next, Project, Waiting) and as an inline dropdown on rendered item cards.

### Project → Action inheritance (Phase 5)

Actions inherit their linked project's `personIds` by default. Users can override at the action level:

- **Add extra people** to a specific action → stored in `action.personIds`
- **Remove an inherited person** for one action → stored in `action.excludedPersonIds`
- The **effective set** is computed via `effectivePersonIds(item)`:
  ```
  effective(action) = (project.personIds − action.excludedPersonIds) ∪ action.personIds
  effective(project|inbox) = own personIds only
  ```

Inheritance is live — adding a person to a project immediately propagates to all its actions (unless excluded on a specific one). Removing a person from a project immediately removes them from all inheriting actions.

**Every function that reads personIds for filtering, counting, or display MUST use `effectivePersonIds(item)` — never `item.personIds` directly.** The exceptions are internal helpers that specifically care about "own vs inherited" (`isInheritedPersonId`, add/remove handlers).

### UI conventions

- **Chips on item cards** use `.person-tag`. Inherited chips add `.inherited` class → grey background + `↳` prefix.
- **Click a chip** → jumps to People tab and opens that person's detail view.
- **Click × on inherited chip** → adds to `excludedPersonIds`, project keeps them.
- **Click × on own chip** → removes from `personIds`.
- **Click + Person button** → floating dropdown positioned via `getBoundingClientRect()`; supports search and "+ Add new person" inline (grows roster organically).
- **Person filter chip** on Next / Projects / Waiting toolbars uses `openPersonFilterDropdown()` — scoped to people who currently have items (keeps list short).

### Helpers (all in `index.html`)

- `nextPersonId()` — allocates `p-NNN` with zero padding
- `addPerson()` — creates blank row on People tab and focuses name
- `updatePersonField(id, field, value)` — inline table edit
- `deletePerson(id)` — with confirm + strips personId from any items linking to them
- `effectivePersonIds(item)`, `isInheritedPersonId(item, personId)`
- `itemsForPerson(personId)`, `openItemCountForPerson(personId)`
- `renderItemPersonLine(item)` — chip line under item text
- `openItemPersonPicker(itemId, buttonEl)` — floating inline picker

### Deprecations

- `waiting.who` (free-text string) is superseded by `personIds`. Existing values are preserved for read; the input on the waiting form was hidden in Aug 2026. Don't set it on new items.

## 6. UI architecture

### Navigation (left sidebar, desktop)

Grouped into three sections:

- **Capture**: Dashboard · Focus · Inbox
- **Lists**: Projects · Next Actions · Waiting For · Calendar · Someday/Maybe · Done · Goals & Horizons · Areas of Focus
- **Reflect**: Session Log · Review

Each nav button has `data-tab="<id>"`. Tab switching is plain JavaScript — clicking a button hides all `.section` elements and shows the one whose ID matches `section-<tab>`.

### Render dispatch

`render()` is the central re-render function. It calls every per-tab render function in sequence:

```
renderDate, renderCounts, renderDashboard, renderInbox, renderNext,
renderProjects, renderWaiting, renderCalendar, renderSomeday,
renderDone, renderFocus, renderAreas, renderHorizons, renderSessionLog,
renderReview, populateProjectSelects, populateAreaSelects,
renderImportPreview, updateSaveButtonLabels
```

Plus a hook (`_renderOrig`) that wraps `render` to also call `updateMobileBadges()`.

### Item card structure (canonical)

All item cards use the same DOM layout:

```html
<div class="item">
  <input type="checkbox" />               <!-- where applicable -->
  <div class="item-body">
    <div class="item-text">{text}{age}</div>
    <div class="item-meta">{chips...}</div>
    <div class="item-notes">{notes}</div>  <!-- conditional -->
  </div>
  <div class="item-actions">{buttons + status dropdown}</div>
</div>
```

`.item` is `display: flex; flex-wrap: wrap;`. Children are flex siblings. The `item-body` is the vertical stack of text + chips + notes; `item-actions` wraps to a new line on narrow screens.

**Critical**: when adding a new render function, match this structure exactly. Putting chips above the text (`item-header` div) breaks the flex layout — chips and text end up on the same row.

### Status dropdown

Every action and project card renders `renderStatusDropdown(item)` which produces a `<select class="status-dropdown">` with options drawn from `VALID_STATUSES[item.kind]`. Changing the dropdown calls `changeItemStatus(item.id, newValue)` which mutates the item, re-syncs derived views, saves, re-renders, and toasts.

### Toast

`showToast(msg, opts)` creates a transient bottom-center notification (fades after 2.2s). Used for status changes, conversions, focus-clear, etc.

## 7. Key conventions

- **IDs are stable**. Never regenerate an ID during a mutation. Cross-references (`projectId`, `areaId`, `_origNext`) point at IDs and must not break.
- **`history[]` is append-only**. Every significant mutation should push a `{ts, note}` entry. Aids debugging and accountability.
- **Migration is one-way**. Once an item is v2, never write v1-style fields to the canonical payload. `_buildV2Payload()` strips aliases (`done`, `date`, `title`, `area`, `context`) before saving.
- **`DEFAULT_DATA` is empty**. Do not put seed items here. The empty-state UI in each bucket guides new users.
- **Render code never mutates data**. All mutations go through helpers.
- **Save defensively**. The `cloudBootstrapped` flag protects against destructive overwrites. Don't bypass it unless you understand the race it prevents.

## 8. Files and paths reference

| File | Purpose | Where to edit |
|---|---|---|
| `index.html` | The entire app | `G:\My Drive\Git Repository for GTD\gtd\index.html` |
| `brand.js` | Visual constants | Same folder |
| `help.json` | Help docs | Same folder |
| `gtd-cloud-state.json` | User's live data | NOT in the repo — lives in Google Drive folder via Drive API |
| Local cloud-state copy (legacy) | OneDrive snapshot — kept as belt-and-suspenders backup | `C:\Users\kpickhardt\OneDrive...\Task Management\Kevins GTD Task List\gtd-cloud-state.json` |

## 9. Working in this codebase (for future AI sessions)

### Before making changes

1. **Read this file end-to-end.**
2. **Check `data.sessionlog`** for entries describing recent changes / known issues. Recent entries take priority over this doc.
3. **Confirm the file size** — `wc -l index.html`. If it doesn't match git's HEAD, the working tree may have local edits.
4. **Run a syntax check**: extract the inline `<script>` block and `new Function(body)`. Should report no errors.

### When editing

- **Surgical edits only.** Use the `Edit` tool with sufficient context to make the `old_string` unique. Avoid sweeping rewrites.
- **Don't rewrite render functions wholesale.** They're long but mostly mechanical. Targeted changes are easier to review.
- **Use the same Drive folder for storage AND data.** Both `index.html` (code) and `gtd-cloud-state.json` (data) live in the user's Google Drive — but the code is in a git clone at `Git Repository for GTD/gtd/`, while the data is in `Kevin - Google` folder accessed via Drive API.
- **OneDrive write ceiling**: when this file lived in OneDrive, the disk-write ceiling around 248 KB caused tail truncation. Now in Google Drive File Stream, that issue hasn't recurred — but watch for similar symptoms (file appears truncated mid-statement; bash mount shows a stale view; the Read tool sees the full file but it isn't on disk).
- **Bash mount lag**: Google Drive File Stream may not propagate file changes to the Linux bash mount immediately. The `Read`, `Edit`, `Grep`, `Glob` tools see the live Windows view; bash sees an eventually-consistent view. Use the file tools for verification.

### When deploying

1. Kevin uses GitHub Desktop for commits. He reviews the diff there before committing.
2. Commit messages should describe the *behavior change* concisely. Example: "Phase 4: Areas dashboard with target % allocation"
3. After push, GitHub Pages takes ~1 minute to publish. Hard-reload Edge (Ctrl+Shift+R) to bypass cache.

### Common pitfalls

- **`OneDrive truncation` (legacy)**: occurred when many small `Edit` calls in sequence pushed file size over a ceiling. Recovery was to `cp` the full file. Now in Google Drive — fewer occurrences, but watch out.
- **Stale data.next during render**: if you mutate `data.items` directly without calling `syncBucketViews()`, the derived arrays will be wrong on next render. Always go through helpers.
- **Legacy field aliases**: render code reads `n.done`, `n.context`, `n.date`, `p.title`, `p.area`, `w.resolved`. These are aliased onto items by `syncBucketViews()` from their canonical v2 fields. Don't WRITE to these aliases — write to the canonical fields (`it.status`, `it.tags`, `it.dueDate`, `it.text`, `it.areaId`). The aliases will re-derive on next sync.
- **Status `'completed'`** is legacy for projects (was v1's value). v2 uses `'done'`. Some code still has dual `=== 'done' || === 'completed'` checks for safety. New code should write `'done'`.
- **Browser extensions** often produce console errors like `"A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"` — those originate from 1Password, LastPass, etc., NOT from the app. Don't chase them.

## 10. Operation (user's daily flow)

1. **Open** `https://kpickhardt-gtd.github.io/gtd/` in Edge.
2. **Authenticate** with Google (token expires ~1 hr; reconnect button always visible in header).
3. **Capture** anything that's on his mind via the top-right Quick Capture box → lands in Inbox.
4. **Triage Inbox** during morning or weekly review — promote each item to Action, Project, Someday, or delete.
5. **Plan day** by setting `focusDate` on items he intends to work on today (set on Next Actions tab; surfaces on Focus tab).
6. **Execute** through the day, marking items done via dropdown or checkbox.
7. **Weekly review** (Friday or Monday): clear Inbox, check Waiting For, review Areas allocation, capture decisions in Session Log.

## 10.5. Scan protocol — people matching

When running an ad-hoc email / Teams / Trello scan and appending items to Kevin's inbox, tag known people via `personIds` at capture time. This is the payoff for the roster — Kevin should never have to hand-tag items whose people are already in the system.

### Matching rules

For every candidate inbox item:

1. Collect signals:
   - **Email**: `from` address, cc'd addresses mentioned as action-drivers
   - **Teams**: chat participants for direct chats; message author for group chats
   - **Trello**: card assignee(s), commenter, mentioned members
2. For each signal, look up against `data.people`:
   - Match `person.email` case-insensitive first
   - Then substring name match (`person.name.toLowerCase().includes(signal)` or vice versa)
   - Prefer active people (`active !== false`) — skip inactive
3. Collect matched `person.id`s into a `personIds` array on the new item.
4. Attach at creation via `addItemToBucket('inbox', { text, personIds, captured: ... })`.

### When no match found

If a sender / participant clearly represents a person Kevin should track (repeat colleague, board member, family, vendor with a real name — not a mailer daemon or notification bot), suggest the addition at the end of the scan report so Kevin can decide.

**Do not silently create people during scans.** The roster grows via Kevin's explicit action, not automation. This matches his "grow organically" philosophy.

### Auto-tagging in progress notes

If a scan adds a note to an existing item (not a new one), still resolve the sender to a `personId` and mention them in the note text (e.g., "Katie Engel forwarded update on Q3 offsite" rather than "Someone forwarded update"). This gives future scans context for matching.

## 11. Future work — known opportunities

- **Goals & Horizons** tab exists but is lightly used. Could grow into 1-year and 3-year goal tracking that ties up from Areas.
- **Tags as first-class filter** — currently context tags are filterable on Next Actions; could extend to all kinds.
- **Calendar polish** — currently a derived view, could grow into a month-grid layout. Lowest priority.
- **Dead code cleanup** — Phase 1 left behind unused functions (`waitingToNext`, `nextToSomeday`, `submitNextToWaiting`, `completeProject`, etc.) and the prompt-form blocks they used. Safe to delete in a future pass.
- **Mobile bottom-nav drawer** order doesn't yet match the desktop nav reorder. Sync on a future pass.
- **Neglect detection** on Areas (days since last project activity) — discussed but not implemented.

## 12. Contacts / context

- **Primary user**: Kevin Pickhardt, Executive Chairman, Pharos Systems International.
- **Time zone**: US Eastern.
- **AI assistance**: Cowork (Claude) sessions, sometimes multiple sessions in parallel. Session Log entries by author `claude` annotate work done in those sessions. If unclear about something, check Session Log first.
