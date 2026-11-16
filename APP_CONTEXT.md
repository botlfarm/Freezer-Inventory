# Technical Architecture & Context Reference Document
**Project:** Freezer Inventory Tracker  
**Current Version:** `2.72.1`  
**Target Environment:** Standalone Web Application & Live Home Assistant Add-On (Ingress Compatible)

---

## 1. Executive Overview & System Purpose
The **Freezer Inventory Tracker** is a full-stack, real-time inventory and cold-chain traceability management platform designed for farms, butcheries, commercial kitchens, and household storage. It manages physical meat cuts and general food inventory across on-site physical freezers, display cases, storage containers/boxes, off-site commercial cold storage facilities, palletized bulk freight, and custom butcher processing orders.

### Key Functional Capabilities
- **Automated Regression Testing & CI Quality Gates**: Integrated `vitest` test suites verifying the entire farm-to-freezer lifecycle:
  1. *Database Restore & Backup Roundtrip*: Restoring sample SQLite `.db` databases across all 24 tables, taking on-disk snapshots (`VACUUM INTO`), simulating catastrophic data wipes, and restoring identically.
  2. *Butcher Intake & CSV Deduplication*: Uploading butcher CSV cutsheets, parsing item numbers and weights, assigning cuts to the butcher location on pallets, and importing updated CSVs with deduplication guarantees.
  3. *Multi-Facility Off-Site Logistics*: Movement orders routing cuts between processor, cold storage on pallets, and home staging intake.
  4. *Home Freezer Operations*: Allocating from staging into freezers, restocking display freezers based on inventory deficits, sales deductions with automatic empty container retirement, container templates, container combining with variant consolidation, and physical reconciliation audits.
  5. *Reverse Movement*: Staging home inventory, packing into off-site boxes with tare/gross weights, and dispatching to cold storage.
  Wired into GitHub Actions (`.github/workflows/build-addon.yml`) to block Docker builds if tests or type checks fail.
- **Live Inventory Item & Container Matching**: Real-time live search across active and archived catalog items and containers during product intake and container creation. Automatically detects duplicate names, highlights archived items (`📁 Archived`), provides 1-click unarchive & restore workflows, and allows placing existing spare containers into target freezers with 1-click.
- **Progressive Web App (PWA) & Offline Resiliency**: Service Worker asset caching for 0-network boot, client-side IndexedDB database caching (`freezer_inventory_offline_db`) for 0ms loads, custom PWA app name/icon branding and Direct PWA URL helpers in **Settings**, and persistent offline mutation queue with automatic FIFO background replay upon reconnect (suppressed automatically on `401 AUTH_REQUIRED` or `403 DEVICE_REVOKED`).
- **Cloudflare Access & Security Token Re-Authentication (Toggleable)**: Built-in zero-data-loss security token renewal designed for Cloudflare Access / Zero Trust deployments where session tokens expire periodically (typically every 30 days). Configurable via a single **Settings** card (`cf_token_refresh_enabled` persisted in SQLite `app_config` and `localStorage`). When enabled, if token expiration causes requests to fail and the status menu displays "Offline", a prominent "Refresh Security Token" card and header badge shortcut appear, preserving device credentials (`deviceId`, `deviceName`, `operatorName`) and bypassing service worker cache interception to follow Cloudflare redirects. When disabled (default for non-Cloudflare environments like local LAN, Tailscale/WireGuard VPN, or Home Assistant Nabu Casa), the status menu and header badge remain clean and uncluttered by Cloudflare-specific prompts.
- **Unified Status-Triggered Header Menu (`#sync-status-dropdown`), PWA Push Updates & Per-Device Auto-Update Controls**: Consolidates all navigation, storage mode switches (**On-Site**, **Off-Site**, **Butcher Records**), contextual inbound actions (**Inbound Stock** on-site / **Bulk CSV Intake** off-site), workspace/account tools (**Catalog & Settings**, **User / PIN**, **Audit History**, **Traceability**), operating mode toggles (**Auto Mode** / **Force Single**), sync/device controls (**Sync Now**, **Connected Devices**), and a bottom **Database Freshness & App Version** footer (`v{APP_VERSION}`, `Check Updates`, `Refresh Cache`) into a single compact 2-column dropdown anchored to the dynamic connectivity/mode status button (icon + chevron on phones, full label on larger screens), removing the separate hamburger menu and verbose explanatory prose so the entire menu fits on mobile screens without scrolling. Automatic background detection of new add-on releases runs through dynamic version injection into `/sw.js`, Server-Sent Events (`appVersion`), window focus/visibility listeners, and 10-minute periodic worker checks. **Auto-Update Cache** always defaults to **Auto** (`pwa_devices.autoUpdateCache = 1`) for all devices and is managed exclusively per device by Admins inside **Users & Devices** (`PwaDeviceManagerCard.tsx`, synced live via `PUT /api/devices/:id` and SSE `device_config_changed`).
- **Unified Users & Devices Registry, PIN Auth, Edit Policy & Legacy Migration**: Persistent hardware device identification (`deviceId` UUID) per device linked to named local accounts via `pwa_devices.userId`, relational SQLite `app_users` and `user_sessions` tables, salted `scryptSync` PIN authentication (no Cloudflare dependency), first-run admin bootstrap (`Set Up Admin`), persistent `HttpOnly` cookie + `X-User-Session` token delivery, configurable **Inventory Edit Access Policy** (`require_login_for_edits` in `app_config`, defaulting to `true` once admins are configured so unauthenticated users remain read-only while toggleable to Open Floor mode), **Legacy Non-PIN User Migration** (`UsersAndDevicesPanel.tsx`) to upgrade named non-PIN operators into PIN accounts or link unowned/legacy devices, per-device account assignment, standard user self-service (`UserAccountModal` for changing own PIN and managing only owned devices), consolidated admin **Users & Devices** tab (`users_devices`, keeping `pwa` as backwards-compatible alias), admin-only gating on `Import / Manage Data`, `Users & Devices`, `Settings`, backups, config mutations, notifications, and demo mode, plus Home Assistant add-on (`admin_recovery_mode` / `admin_recovery_pin`) and CLI (`npm run admin:recover`) lockout recovery. Also includes PWA Device Manager user-first grouping (`PIN Admin` / `PIN Account` vs `Legacy • No PIN`), multi-criteria filtering, and exact `deviceIds` batch revocation/authorization (`/api/devices/batch-revoke`, `/api/devices/batch-authorize`) with `403 DEVICE_REVOKED` SSE enforcement.
- **On-Site & Display Case Inventory**: Real-time bin, shelf, and container tracking with instant quantity adjustments, math expression evaluation (`+5`, `-2`, `3*4`), split cuts, tag filtering, customizable hierarchy sorting (alphabetical or user-defined category/sub/cut sequence), and restock/removal priority rules governed strictly by explicit user-configured tag action flags (`utils/tagRestockRules.ts`, SQLite `tags` columns, zero hardcoded tag IDs or names): any tag with `excludeFromDisplayRestock: true` never counts as eligible Display backstock, is blocked from automatic restocking, and warns if explicitly moved to Display (`DisplayCaseView.tsx`, `ProductView.tsx`, `MoveModalContent.tsx`), while any tag with `prioritizeItem: true` pushes tagged stacks to the front for both Display Case restocking and inventory removal (`ContainerCard.tsx`, `DisplayCaseView.tsx`, `ProductView.tsx`).
- **On-Site Local Voice Control (`VoiceControlView`, `VoiceDictionaryManager`, & `voiceCommandParser.ts`)**: Dedicated, 100% local, zero-AI voice and keyboard-dictation command workspace (`#voice`) scoped strictly to on-site inventory (freezers, display cases, containers, and staging; off-site and butcher records are locked out). Captures speech via the browser Web Speech API alongside an editable input tailored for mobile OS keyboard dictation (Gboard / iOS Dictation), features a sectioned interactive **Sample phrases & full command guide** (`Removing & Selling`, `Moving Items`, `Adding Items & New Containers`, `Bulk & Direct Inventory Changes`, `Display Restock & Stock Alerts`, `Container Moves, Lifecycle, Emptying & Combining`, `Custom Lists & Threshold Alerts`, `Tags & Label Corrections`, `Inventory Checks & Container Lookups`, and `Chaining, Dictation & Shortcuts`), supports a SQLite `app_config`-persisted **Primary Voice Display Freezer** setting (`voice_primary_display_freezer_id` managed inside the **Voice Dictionary** page) and deterministic multi-special-freezer resolution (singular `"display"` / `"display case"` resolves via configured Primary Display -> literal `"Display"` name match -> `isSpecial` fallback, prompting only when tied, while plural `"all displays"` / `"special freezers"` / `"specialty freezers"` intentionally span every Special Freezer together) as well as direct `<freezer> loose` targeting (`"display loose"`, `"canada loose"`, `"staging loose"`), enforces flag-driven tag rules (`excludeFromDisplayRestock` filtering/warnings and `prioritizeItem` pull/removal prioritization via `utils/tagRestockRules.ts`) across `restock_display`, `inventory_alert_query`, `remove`, Display `move`, and `empty_container`, strips conversational openers (`"hey"`, `"can you tell me"`, `"let's"`, `"please"`, `"just"`), parses broad natural phrasing across all intents—including multi-item post-sale dictations split at quantity boundaries, `"sold out of"` / `"finished"` / `"grabbed"` / `"wipe out"` / `"empty <product or category> from <location>"` (expanding categories like `"Empty Broths from display"` to all stocked category items in that location without colliding with `"empty <container>"`), `"consume"` / `"discard"` / `"write off"`, `"there are N <item> left in <loc>"` physical count statements, `"bring/grab <items> from <src> to <dest>"`, `"top off/refill display with N <item>"`, `"what do I need to restock?"`, `"what's low stock in display?"`, `"check a list"` with threshold-breach sorting & `"below min"` indicators, `"take that back"` undo, container synonym nouns (`bin/box/bag/tote/bucket/crate/tray/tub`), and natural stock checks (`"do we still have..."`, `"any ... left"`, `"what's on the sorting table?"`)—and supports a dedicated **Voice Dictionary** tab (`#library/voice_dictionary`, `voice_dictionary` table) mapping custom spoken words/phrases directly to canonical on-site **Products**, **Containers**, **Freezers**, **Command Actions**, or **Phrase Rewrites**. Also includes a temporary, self-contained **Save Prompt** capture bar (`TempVoicePromptRecorder.tsx` + `utils/tempVoicePromptServer.ts` storing `/data/temp-voice-prompts.json` outside SQLite) to log unrecognized live queries with optional notes while refining the voice model.
- **Off-Site Cold Storage & Movement Planning**: Multi-facility tracking, pallet and box hierarchies, drag-and-drop staging worksheets, unified worksheet spreadsheet with synchronized sticky multi-select toolbar and column headers, barcoded QR scanning, pick/delivery order execution, and movement history.
- **Butcher Processing & Traceability (`ButcherRecordsView`, `TraceabilityView`)**: Harvest lot tracking, animal counts, live/hot/cold weights, yield calculations, butcher document attachments, and full parent-cut lineage. `TraceabilityView` uses an $O(N)$ pre-indexed lookup engine (`buildTraceRecords`) across products, movement orders, active on-site cuts, and removal logs alongside on-demand single-record history enrichment (`enrichTraceRecordWithHistory`), memoized `Intl.DateTimeFormat` date formatting, and paginated cohort tables for instant (<50ms) view mounting even on multi-thousand-package inventories.
- **Automated Custom Lists & Admin Notification Center (`#library/notifications`)**: Inventory-controlled lists (min/max thresholds across on-site/off-site counts and weights) paired with an admin-only **Notification Center** (`components/NotificationCenterPanel.tsx`, `utils/notifications.ts`) supporting multiple named delivery channels per gateway type (`smtp_email`, `webhook`, `in_app`), global default fallback channels (`defaultChannelIds`), and simultaneous multi-channel + multi-frequency list subscriptions (**Daily Digest** `combined` or `separate`, **Custom Schedules** `daily`/`weekly`/`interval`, and edge-triggered **Immediate Alerts** on item add or threshold breach, plus optional per-trigger channel and recipient overrides). Future notification-consuming features (such as PIN reset emails) will choose from configured channels directly within their own settings rather than cluttering the Notification Center with unused routing selectors.
- **Real-Time Collaboration & Presence Lifecycle**: Two operating modes (Smart Auto Mode and Exclusive Single-User Lock) with Server-Sent Events (SSE), instant `sendBeacon` leave notifications on tab close/unload, immediate collaborative sync when multiple users work in the same zone, atomic action queuing, and sub-second delta synchronization.
- **Stock Controller & Quantity Plus / Minus Interaction Engine**: High-specificity CSS and state engine in `index.css` and row components (`MeatCutRow.tsx`, `ProductView.tsx`, `DisplayCaseView.tsx`, `AddForms.tsx`, `MoveModalContent.tsx`, `UnifiedInboundMoveForm.tsx`, `ReconciliationView.tsx`). Guarantees vivid Red (`#ef4444` / `#dc2626`) for decrements (-) and Green (`#22c55e` / `#16a34a`) for increments (+) on hover, focus, and active push across all native Home Assistant themes and custom CSS overrides. Uses explicit `.btn-qty-minus` / `.btn-qty-plus` classes with negative selector guards (`:not(.btn-qty-minus):not(.btn-qty-plus):not([data-action])`) protecting interactive controls from general pill/card overrides, accompanied by tactile press scaling (`scale(0.9)`) and a 250ms reactive feedback state (`.is-pushed`) for instant color changes on fast mobile taps.
- **Unified Catalog & Settings Workspace (`views/LibraryView.tsx`, `utils/libraryNavigation.ts`, `components/OffSiteSettingsPanel.tsx`, `components/CatalogSearchFilterBar.tsx`)**: Organizes all 13 management views into three logical groups (**Catalog**: `Products & Categories`, `Containers`, `Freezers`, `Lists`, `Tags`, `Locations`, `Photo Manager`; **Operations**: `Off-Site Settings`, `Voice Dictionary`; **System & Admin**: `Import / Manage Data`, `Users & Devices`, `Notifications`, `General Settings`) rendered via a grouped vertical sidebar (`lg+`) and a compact mobile active-section selector + collapsible grouped drawer (`< lg`), eliminating horizontal tab scrolling. Multi-mode sections (`Products`, `Containers`, `Lists`, `Notifications`, `Photo Manager`, `Import / Manage Data`) share a uniform Section Header + segmented sub-mode switcher with `hideInternalHeader` suppression on embedded panels. All seven Catalog sections share `<CatalogSearchFilterBar />` beneath the `<header>` with search input, active-count **Filters** drawer collapsed by default (`useState(false)`), and Reset action, alongside compact horizontal row-card stacks with modal configuration across **Lists**, **Tags**, and **Locations**. **Lists** and **Tags** enforce clear two-step flows separating overview cards & configuration/delete modals from full-width Item / Default-Product management views. **Off-Site Settings** (`#library/offsite_settings`) hosts `report-from-name`, `report-from-address`, and `offsite-theoretical-box-weight` (default `40 lbs`) for all regular users while preserving admin gating on System & Admin routes and settings.
- **Enterprise Audit Trail & Undo (`HistoryView`, `UndoConfirmationModal`, `historyRetention.ts`)**: Full mutation history tracking client devices, companion app signatures, and instant reversible undo snapshots. `HistoryView` presents a streamlined search bar paired with a **Filters** toggle button (`#history-filters-toggle-btn`, collapsed by default with an active filter count badge) that expands the full filter panel (`#history-filters-panel`: timeframe selector, custom date range, quick window pills `Last 24h`/`7 Days`/`30 Days`/`All Time`, and multi-select Freezers/Containers/Products/Users/Devices dropdowns). Defaults to loading the **Last 24 Hours** (falling back to the latest 25 changes if no actions occurred in the last 24h, and automatically expanding to All Time when searching/filtering), with $O(1)$ pre-indexed entity location resolution, memoized `Intl.DateTimeFormat` timestamp formatting, paginated row rendering, and admin-only lazy on-demand purge calculation & execution (`#history-purge-maintenance-btn`, gated by `canAccessAdmin` in UI and `PURGE_HISTORY` admin check in `/api/inventory/action`; `calculateHistoryRetention` tokenized to $O(H + S)$ and executed only when the Purge modal is opened).

---

## 2. Technical Stack & Runtime Environment

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 / 19, TypeScript | Strict typing, functional components, custom hooks, React portals. |
| **Styling & UI** | Tailwind CSS (Tailwind v4 `@import "tailwindcss";`) | Mobile-first responsive design, dark/cool-gray neutral palettes, custom SVG icon system, Lucide icons. |
| **Build & Tooling** | Vite, `tsx`, `esbuild`, Vitest | Node.js native ESM/CJS bundling, TypeScript type checking (`tsc --noEmit`), Vitest automated unit & workflow tests (`npm test`). |
| **Backend Server** | Node.js, Express | RESTful API routes (`/api/*`), SSE streaming (`/api/inventory/stream`), multipart image uploads, ZIP archive compression. |
| **Database Engine** | SQLite via `better-sqlite3` | Local persistent database (`/data/inventory.db` or `./data/inventory.db`) with WAL mode, transactions, and automated schema migrations. |
| **Integrations** | Home Assistant API & Ingress | Reverse proxy ingress compatibility, HA persistent notifications, companion app client detection. |

---

## 3. Relational Data Architecture & Core Schemas

The backend uses a normalized SQLite relational architecture to eliminate data duplication. Entities are stored in primary tables and referenced across transactions via foreign keys.

```
+----------------+       +-------------------+       +--------------------+
|    freezers    | 1---* |    containers     | 1---* |     meat_cuts      |
+----------------+       +-------------------+       +--------------------+
                                                        | references
                                                        v
+----------------+       +-------------------+       +--------------------+
|   categories   | 1---* |     products      | *---1 |  off_site_entries  |
+----------------+       +-------------------+       +--------------------+
                                                        | grouped by
                                                        v
+----------------+       +-------------------+       +--------------------+
|  app_locations | 1---* |      pallets      | 1---* |       boxes        |
+----------------+       +-------------------+       +--------------------+
```

### Primary Entity Definitions (`types.ts`)

#### 1. Core On-Site Entities
- **`Freezer`**: Physical cold storage unit (e.g., Chest Freezer, Walk-In, Display Case). Attributes: `id`, `name`, `isSpecial`, `isLooseOnly`.
- **`Container`**: Storage bins, boxes, shelves, or dividers inside a freezer or placed on the Staging Area / Sorting Table (`freezerId: undefined`). Attributes: `id`, `name`, `freezerId`, `templateId`, `imageUrl`, `deleteOnEmpty`, `icon`, `isBox`, `color`, `isArchived`. Staging containers holding meat cuts remain safely unassigned to any physical freezer. If a container's physical freezer is deleted or missing, it is automatically relocated to the Staging Area (`freezerId: undefined`) so inventory is never lost. When retiring a container with active items, operators can choose between relocating contents to the Sorting Table (`emptyCuts: true`) or permanently deleting all items with the container (`deleteCuts: true`).
- **`ContainerTemplate`**: Reusable container blueprint definitions (`id`, `name`, `icon`, `imageUrl`).
- **`Product`**: Canonical item definition. Attributes: `id`, `name`, `primaryCategory`, `subCategory`, `productNumbers[]`, `barcode`, `salePrice`, `salePriceUnit`, `listThresholds`, `listControlSources`, `defaultTagIds`, `isArchived`.
- **`MeatCut`**: Actual on-site physical package inventory record. Attributes: `id`, `productId`, `containerId`, `quantity`, `notes`, `tagIds`, `originalCutName`, `wrongLabel`, `isWrongLabel`, `serial`, `lot`, `packDate`, `weight`. If a cut's container is deleted, archived, or lost, it is automatically recovered and moved to the Sorting Table (`staging_loose`).

#### 2. Off-Site Storage & Freight Entities
- **`AppLocation`**: Physical facilities or destinations (`id`, `name`, `address`, `contact`, `isHome`, `type: 'storage' | 'delivery_pickup'`, `hasPallets`).
- **`AppPallet`**: Pallet identifier (`id`, `storageLocationId`, `tagIds`, `notes`, `isArchived`).
- **`AppBox`**: Box identifier (`id`, `palletId`, `tagIds`, `notes`, `isArchived`).
- **`OffSiteEntry`**: Individual package or bulk record located in off-site storage. Attributes: `id`, `serial`, `originalCutName`, `productId`, `packDate`, `lot`, `pieces`, `netWeight`, `box`, `pallet`, `currentLocation`, `storageLocationId`, `tagIds`, `archived`, `staged`, `wrongLabel`. Tags are fully mutable and can be cleared (`tagIds: []`) with one-click direct removal buttons (`✕`) on badges, via `OffSiteTagPopover` ("Clear All Tags"), in the item edit modal, or bulk edit modal. The server normalization routine preserves empty `tagIds: []` arrays without forcibly re-injecting product `defaultTagIds`.
- **`MovementOrder`**: Planned or completed stock transfer. Attributes: `id`, `name`, `date`, `status: 'planning' | 'finalized' | 'completed'`, `palletsInPlay[]`, `locationsInPlay[]`, `moves: MovementItem[]`, `pickedBoxIds[]`, `deliveredBoxIds[]`, `pickedItemIds[]`, `deliveredItemIds[]`.

#### 3. Butcher Processing & Lineage
- **`ButcherOrder`**: Batch processing master order. Attributes: `id`, `orderNumber`, `species`, `killDate`, `pickupDate`, `animalCount`, `liveWeight`, `hotWeight`, `coldWeight`, `butcherFee`, `documents: ButcherOrderDocument[]`.

#### 4. Audit Trail, Lists & Configuration
- **`HistoryEntry`**: Immutable audit log. Attributes: `id`, `timestamp`, `description`, `targetId`, `user`, `clientDevice`, `clientInfo`, `undoData`.
- **`CustomList`**: Dynamic or manual inventory lists. Attributes: `id`, `name`, `isInventoryControlled`, `controlType: 'auto' | 'prompt'`, `controlCondition: 'min' | 'max'`, `items: CustomListItem[]`, `notificationEnabled`, `notificationType` (`all_items` | `newly_added_only` | `item_specific` | `threshold_breaches`), `notificationChannelIds`, `notificationRecipientOverride`, `notificationDailyDigestMode` (`none` | `combined` | `separate`), `notificationDigestChannelIds`, `notificationCustomSchedule`, `notificationImmediate`, `lastNotifiedAt`.
- **`NotificationChannel`**: Reusable named delivery gateway persisted in `notification_channels` (`id`, `name`, `type: 'smtp_email' | 'webhook' | 'in_app'`, `enabled`, `config`, `createdAt`, `updatedAt`, `lastTestedAt`, `lastTestStatus`).
- **`NotificationSettings`**: Global digest schedule (`digestEnabled`, `digestTime`, `timezone`), `defaultChannelIds`, optional backward-compatible `systemRoutes` metadata, and legacy connection fields retained for automated migration.
- **`VoiceDictionaryEntry`**: Relational custom voice alias, command shortcut, and phrase rewrite rule (`id`, `spokenPhrase`, `targetType: 'product' | 'container' | 'freezer' | 'command' | 'phrase'`, `targetId`, `replacementText`, `notes`, `createdAt`) persisted in SQLite `voice_dictionary`. Store foreign key `targetId` without duplicating canonical entity names.

---

## 4. Real-Time Concurrency & State Synchronization

The application features a hybrid synchronization architecture designed for zero client latency and collaborative consistency.

```
  [User Action] ──> (Optimistic UI Update: 0ms)
                          │
                          ▼
             [Debounce Buffer: 800ms - 1200ms]
                          │
                          ▼
            [HTTP Action POST /api/inventory/action]
                          │
           ┌──────────────┴──────────────┐
           ▼                             ▼
   [SQLite Transaction]        [SSE Broadcast /stream]
   - Delta Table Updates       - Excludes Sender Client
   - Audit Log Entry           - Notifies Active Peers
   - Snapshot Creation                   │
           │                             ▼
           ▼                      [Peer Clients]
   [HTTP Response 200]            - State Invalidation
   - Next State                   - Background Refresh
   - _affectedTables Metadata
           │
           ▼
[Client Structural Reconciliation]
 - Reuses Unchanged Object Refs
 - Zero Downstream React Re-renders
```

### Operating Modes & Zone Segregation
1. **Zone-Aware Auto Mode (`'auto'`)**:
   - Default operating mode.
   - Segregates client presence into two functional operational zones: **On-Site** (Products, Freezers, Management, Settings, Display Cases) and **Off-Site** (Butcher Logs, Off-Site Storage, Freight Orders, Traceability).
   - When only 1 client is active in a zone: runs with zero-lag local debounced batching and memory buffering.
   - When multiple clients operate concurrently in the **same zone**: seamlessly transitions to collaborative 1.2s synchronization to keep active records aligned without requiring manual mode toggles.
   - When users work in **different zones** (e.g., one on-site cataloging items, one off-site managing butcher logs): both users enjoy solo zero-lag performance without triggering unnecessary multi-user locks or friction.
2. **Zone-Aware Exclusive Single-User Lock Mode (`'single'`)**:
   - Acquires an exclusive server-side mutex lock scoped to the active operational zone (`onsite`, `offsite`, or global `all`) for uninterrupted high-volume operations (such as major physical inventory counts or bulk imports).
   - Prevents global cross-zone collisions so locking on-site does not disrupt or revert off-site operators and vice-versa.
   - Other clients within the locked zone receive read-only status and can submit interactive break-in requests.
   - Automatically releases after 5 minutes of total user inactivity.
   *(Note: The legacy Forced Multi-User mode was removed in v2.47.0 as redundant, since Smart Auto mode dynamically activates collaborative multi-user synchronization whenever multiple users work in the same zone).*

### Client-Side State Reconciliation (`useInventory.ts`)
- **Action Queueing (`queuePromiseRef`)**: All dispatched actions chain through a sequential promise queue to prevent HTTP race conditions.
- **Structural Sharing (`reconcileStateReferences`)**: When a server response returns, unaffected entity collections (`offSiteEntries`, `products`, `freezers`, `customLists`, etc.) retain their exact JavaScript memory references. This eliminates unnecessary React re-renders and skips heavy computation passes.
- **Client Metadata Tracking**: Every action captures client environment headers (`X-Client-Device`, `X-Client-Info`, `X-Client-Id`, `X-User-Name`) for granular audit attribution.

### Browser History & Back Navigation Lifecycle
- **HTML5 History (`pushState` / `popstate`) Integration**: Every primary view change (`product`, `freezer`, `offsite`, `library`, `history`, `traceability`, `reconcile`, etc.) and major sub-tab switch pushes structured state entries into `window.history`.
- **Hardware & Swipe-Back Gesture Support**: Swiping from the screen edge on mobile devices (iOS Safari, Android Chrome, and Home Assistant Companion App) or pressing hardware/mouse/browser back buttons returns to the previous screen rather than kicking the user out of the application.
- **Deep-Linking & Safe Hash Routing**: Screen locations synchronize with URL hashes (`#product`, `#freezer`, `#offsite/hierarchy`, etc.) ensuring compatibility with Home Assistant Ingress reverse-proxied paths without causing page reloads.
- **Hierarchical Modal Back-Dismissal**: Opening an interactive modal dialog, item inspector, photo preview, or confirmation popup pushes a lightweight modal history state. Pressing back or swiping back while a modal is open safely dismisses the modal while keeping the operator on their active screen.

---

## 5. Key Design Decisions & Performance Optimizations

1. **Indexed Map Lookups for Derived State**:
   - In `App.tsx`, off-site quantity and weight computations use pre-indexed hash maps (`productById`, `productByName`, `productByNum`, `productByCleanName`).
   - Replaced $O(N \times P)$ nested regex searches with $O(N + P)$ lookups, cutting recalculation time from ~130ms down to ~2ms.
2. **Component-Level Memoization**:
   - High-density rows (`MeatCutRow.tsx`) and container cards (`ContainerCard.tsx`) are wrapped in `React.memo` to isolate quantity adjustments and prevent cascading re-renders across unaffected containers.
3. **Graceful Degradation & Non-Destructive Migrations**:
   - Schema upgrades run non-destructively in `server.ts` during server startup (`loadStateSync` / `ensureTableSchemas`). Missing columns or legacy data structures automatically fall back to safe defaults (`?? []`, `?? ''`).
4. **Relational Normalization with Audit Snapshotting**:
   - Canonical entity definitions reside strictly in their respective primary tables.
   - Raw text values (such as `originalCutName`) are preserved exclusively when recording immutable physical package labels from external meat processors.

---

## 6. Backup, Restore & Disaster Recovery

- **Complete Multi-Table Coverage (24 Database Tables)**: All backups (SQLite `.db`, full `.zip` capsules, and `.json` files) capture the entire relational database state across all 24 system tables: `freezers`, `container_templates`, `containers`, `categories`, `products`, `meat_cuts`, `locations`, `pallets`, `boxes`, `off_site_entries`, `movement_orders`, `butcher_orders`, `custom_lists`, `tags`, `app_config`, `notification_channels`, `notification_settings`, `notification_logs`, `history`, `pwa_devices`, `undo_sql_journal`, `voice_dictionary`, `app_users`, and `user_sessions`. Credential hashes (`pinHash`, `pinSalt`, `tokenHash`) are included in database backups for disaster recovery parity while staying strictly omitted from runtime `/api/inventory` and SSE payloads.
- **Selective Table-by-Table & Broad Section Restoration**: Interactive preview inspector (`/api/backups/preview/:filename`) allows previewing active database vs. snapshot record counts, net differences, sample items, and restoring either the entire database or an exact subset of tables.
- **Foreign Key Dependency Validation**: Pre-flight dependency checking (`/api/backups/check-dependencies/:filename`) flags missing parent relationships and offers 1-click auto-selection of prerequisite tables before restoration.
- **Full JSON Backups (`/api/backups/create`)**: Generates complete database snapshots with timestamped filenames.
- **ZIP Package Backups (`/api/backups/export-zip` & `/api/backups/import-zip`)**: Packages the entire database, configuration, and image uploads directory (`/data/uploads`) into a single portable `.zip` archive.
- **Automated Periodic Snapshots**: Configurable dual-schedule daily database backups and weekly full ZIP archives with automated retention pruning.
- **Database Undo Subsystem (`/api/inventory/undo`)**: Reconstructs previous entity states from transactional undo snapshots without requiring full database rollbacks.

### Mandatory Future Table Integration Rule
Whenever any new database table or relational entity is introduced in the future, it **MUST** be integrated across all backup and restore layers:
1. **Schema & Types**: Add table schema to `TABLE_SCHEMAS` in `/server.ts`, define TypeScript interfaces, and register in `InventoryState` in `/types.ts`.
2. **State Synchronization**: Include the new table in `loadStateSync` and `saveStateSync` in `/server.ts` with delta-checking.
3. **Metadata & Aliasing**: Register the new table in `DATABASE_TABLE_DEFINITIONS` and `TABLE_ALIAS_MAP` in `/server.ts` with label, category, icon, description, and foreign key dependencies (`dependsOn` / `dependents`).
4. **All Backup Formats**: Ensure complete capture and restoration in `.db` snapshots, `.zip` capsules (`/api/backups/export-zip` & `/api/backups/import-zip`), and `.json` exports (`/api/backups/create`).
5. **Preview & Inspection**: Add the table to table count parsing in `/api/backups/preview/:filename` for `.db`, `.json`, and `.zip` archives.
6. **Dependency Engine**: Add foreign key validation rules in `checkDatabaseDependencies` and `checkJsonDependencies` in `/server.ts`.
7. **Selective Restore UI**: Add the table to the Table-by-Table comparison matrix and quick-selection filters in `/views/DataImportView.tsx`.
8. **Documentation**: Update `/FREEZER_MAPPING_AI_GUIDE.md` and `/APP_CONTEXT.md` with the new table schema and relations.

---

## 7. Version Control & SemVer Governance

Every modification to the codebase must strictly follow the repository's versioning rules:

1. **Simultaneous Version Bumps**:
   - `/package.json` (`"version"`)
   - `/config.yaml` (`version`)
   - `/version.ts` (`APP_VERSION`)
   - `/CHANGELOG.md` (Top-level release block)
2. **Repository & Directory Structure**:
   - The entire application lives at the root of the repository (`/`), containing `config.yaml`, `Dockerfile`, `build.yaml`, `server.ts`, `App.tsx`, `index.html`, etc.
   - The GitHub Actions workflow (`.github/workflows/build-addon.yml`) uses `home-assistant/builder` targeting the root directory (`--target .`), publishing multi-arch images (`amd64`, `aarch64`) directly to GHCR.
3. **Bumping Criteria**:
   - **Patch (`0.0.1`)**: Bug fixes, performance optimizations, cosmetic refinements, documentation additions.
   - **Minor (`0.1.0`)**: New features, views, workflows, or components.
   - **Major (`1.0.0`)**: Breaking schema changes or major architectural redesigns.
4. **Changelog Formatting**:
   - Must include release version, date, categorized bullet points (`### Added`, `### Changed`, `### Fixed`), and an explicit `### Files Modified` section.

---

## 8. Continuous Integration & Mandatory Automated Testing Policy

Every new feature, database entity, business logic enhancement, or endpoint must include accompanying automated test coverage in `/tests/` to guarantee zero regressions.
- **CI Test Runner**: The test suite runs via `npm test` (`vitest run`) in GitHub Actions (`.github/workflows/build-addon.yml`) prior to the Docker build step. If any test fails, image building and publishing are halted immediately.
  - `tests/workflow-demo-sandbox.test.ts`: Demo sandbox playground lifecycle, ephemeral database cloning, isolation integrity, and cold-boot safety.
  - `tests/workflow-restore-and-backup.test.ts`: Database restore, snapshotting, and disaster recovery roundtrips.
  - `tests/workflow-butcher-csv-dedup.test.ts`: Butcher order creation, cutsheet parsing, and deduplication.
  - `tests/workflow-offsite-and-home-logistics.test.ts`: Multi-facility logistics, cold storage pallets, and staging intake.
  - `tests/workflow-home-inventory.test.ts`: Home operations, restocking, sales reductions, container templates, merging, and reconciliations.
  - `tests/workflow-reverse-staging-offsite.test.ts`: Staging packaging, weights, and off-site transfer.
  - `tests/inbound-outbound.test.ts`: Traceability, lot tracking, and inventory bounds.
  - `tests/inventory-movement.test.ts`: Product and container relocations.
  - `tests/butcher-reports.test.ts`: Yield, dressing percentages, and cooler shrinkage calculations.
  - `tests/voice-command-parser.test.ts`: Local on-site voice command parsing, multi-item post-sale lists, hierarchical location resolution, partial-match ambiguity blocking, category/item emptying (`"Empty Broths from display"`), stock/category/tag/list/alert/container queries (`"What do I need to restock? Check a list"`, `"What's low stock in display?"`), guided display restock and inventory removal (`remove`) with flag-driven `excludeFromDisplayRestock` & `prioritizeItem` rules (verifying zero hardcoded tag defaults), custom lists, container lifecycle, tag toggles, wrong-label fixes, quick undo, expanded natural phrasing variants, and off-site exclusion.
  - `tests/temp-voice-prompt-log.test.ts`: Temporary voice prompt capture store CRUD, optional notes updates, and export formatting helpers.
  - `tests/tag-restock-rules.test.ts`: Flag-driven `excludeFromDisplayRestock` and `prioritizeItem` rules (restock + removal sorting, badge icon resolution, SQLite `tags` column roundtrip, and verification that unflagged `"not-for-sale"` / `"use-first"` tags trigger zero hardcoded behavior).
  - `tests/user-auth-and-admin.test.ts`: Local salted PIN hashing, rate limiting, first-admin setup, `require_login_for_edits` policy lifecycle, legacy non-PIN operator migration/linking, single-device user reassignment & session revocation, per-user device isolation, last-admin protection, 24-table SQLite backup roundtrips, HA recovery parsing, and Non-HA CLI recovery.
  - `tests/library-settings-redesign.test.ts`: Grouped Catalog & Settings navigation (`Catalog`, `Operations`, `System & Admin` across 13 sections including admin-only `notifications`), hash alias normalization (`#library/pwa` -> `users_devices`), regular-user access to `offsite_settings`, scoped `app_config` key allowlist checks (`canNonAdminWriteAppConfig`), SQLite `app_config` persistence roundtrips, unified `LibraryView` layout assertions, uniform `CatalogSearchFilterBar` condensed-by-default filter coverage across all 7 catalog pages, and tightened `ManageLocations` card spacing checks.
  - `tests/notification-center.test.ts`: Legacy notification migration (`migrateLegacyNotificationData`), multi-channel + multi-frequency list trigger resolution (`resolveListChannelIdsForTrigger`, `resolveEffectiveDailyDigestMode`), timezone-aware `daily`/`weekly`/`interval` custom schedule evaluation (`isCustomScheduleDue`), edge-triggered threshold breach detection (`detectNewlyBreachedListItems`), report formatting, and SQLite backup/restore persistence for `notification_channels` and updated `custom_lists` / `notification_settings` / `notification_logs` columns.

---

## 9. Demo Sandbox Playground Architecture

The application includes an isolated **Demo Sandbox Playground** mode accessible via **Settings**:

1. **Database Isolation (`inventory_demo.db`)**:
   - When entering demo mode (`/api/demo/start`), the server runs a `wal_checkpoint(TRUNCATE)` on the active database, duplicates `inventory.db` into `inventory_demo.db`, and repoints the SQLite connection (`db`) to the cloned sandbox file.
   - All mutations, bulk imports, deletions, and moves executed by the user operate strictly on `inventory_demo.db`.
   - The production database (`inventory.db`) remains completely untouched and pristine.
   - Automatic rolling snapshots are bypassed (`isDemoMode || isPreviewMode`) to avoid polluting backup archives.

2. **Ephemeral Lifecycle & Cold Boot Safety**:
   - Sandbox status is managed via in-memory execution state (`isDemoMode`).
   - When exiting demo mode (`/api/demo/end`), the server closes the sandbox database connection, completely deletes `inventory_demo.db` (including `-wal` and `-shm`), sets `isDemoMode = false`, and restores connection to the live `inventory.db`.
   - On server startup or container initialization, `sanitizeStartupDemoState()` executes once to guarantee that any legacy persisted flags or abandoned demo files from ungraceful shutdowns are wiped, ensuring the live database is always accessed.

The application provides an optional, self-hosted and client-configured connectors architecture located under **Settings > Connectors**:

1. **Zero Centralized Project Lock-in**:
   - Built specifically for open-source self-hosting and Home Assistant installations without requiring a shared Google Cloud project or centralized OAuth consent screen.
   - All credentials and configuration values are stored securely within the local SQLite `app_config` table and included in standard SQLite/JSON backups.

2. **Nextcloud Connector**:
   - **Protocol**: Standards-compliant WebDAV over HTTP/HTTPS with Basic Authentication using a personal Nextcloud username and App Password/Token.
   - **Backend Proxy**: `/api/connectors/nextcloud/*` proxies `PROPFIND` and file `GET` requests to avoid cross-origin (CORS) blocking by browsers when contacting external or internal local subnets.
   - **Capabilities**: Interactive multi-level directory traversal, folder creation inspection, file size formatting, live latency ping testing, cutsheet CSV selection, and order document linking.

3. **Google Docs & Sheets Connector**:
   - **Direct Sheet CSV Converter**: Converts public or shared Google Sheets URLs (`https://docs.google.com/spreadsheets/d/{id}/edit#gid={gid}`) into direct CSV export endpoints (`https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`) for zero-API instant cut intake.
   - **Personal API Credentials**: Allows individual users to optionally provide their own Google API Key and Client ID for self-service integrations.
   - **Capabilities**: Live sheet row count inspection, preview grid rendering, cutsheet CSV parsing, and document link attachments with provider attribution.

4. **Configuration Keys (`app_config`)**:
   - `nextcloud_enabled`, `nextcloud_url`, `nextcloud_username`, `nextcloud_password`, `nextcloud_folder`, `nextcloud_test_status`, `nextcloud_test_message`, `nextcloud_last_tested`
   - `google_connector_enabled`, `google_api_key`, `google_client_id`, `google_default_sheet_url`, `google_connector_status`

---

## 10. Local User Accounts, PIN Authentication, Edit Policy, Legacy Migration & Recovery

1. **Purely Local First-Run Bootstrap & Salted PIN Auth (`utils/userAuthServer.ts`)**:
   - No external identity provider or Cloudflare deployment is required; works identically on localhost, LAN, Tailscale/VPN, and Cloudflare Access setups.
   - Until the first active `admin` user is created (`usersConfigured === false`), the app remains open with a **Set Up Admin** prompt (`POST /api/auth/setup-first-admin`).
   - User PINs (4–16 characters, no whitespace) are salted per user with 16 random bytes and hashed via `crypto.scryptSync` (verified with `crypto.timingSafeEqual`), protected by an in-memory `PinRateLimiter` (5 failures / 60s lockout).
   - Successful authentication stores a SHA-256 `tokenHash` in `user_sessions`, issues an `HttpOnly` cookie (`freezer_user_session`, dynamically using `SameSite=None; Secure` for HTTPS/proxied iframes and `SameSite=Lax` for plain HTTP) plus an `X-User-Session` token persisted across `localStorage`, `sessionStorage`, and in-memory fallback (`utils/clientDevice.ts`) and safeguarded by monotonic auth-epoch deduplication in `UserAuthProvider` (`hooks/useUserAuth.tsx`), and auto-links the client hardware `deviceId` in `pwa_devices.userId`.

2. **Configurable Inventory Edit Access Policy (`require_login_for_edits`)**:
   - Controlled via SQLite `app_config` key `require_login_for_edits` (exposed on `GET /api/auth/status` and toggled via `PUT /api/admin/auth-policy`), configurable during first-admin setup (default `true` = **Protected**) or anytime inside **Users & Devices**.
   - When `true` and signed out (`isEditLockedByAuth`), inventory/catalog/butcher/off-site read browsing remains open in **View-Only Mode** while backend `requireEditAuth` rejects mutations (`401 AUTH_REQUIRED`) on inventory actions, movements, uploads, photos, client modes, and break-in requests; the client rolls back optimistic updates without queueing offline mutations and prompts PIN sign-in. Switching to **Open Floor / Kiosk Mode** (`false`) allows unauthenticated inventory edits while keeping admin tabs and routes PIN-protected.

3. **Consolidated Users & Devices Workspace & Legacy Non-PIN Operator Migration**:
   - Admin user management (`AdminUsersManagerCard`), edit policy control, legacy migration, and device management (`PwaDeviceManagerCard`) live together in **Users & Devices** (`UsersAndDevicesPanel.tsx`, tab `'users_devices'` with `'pwa'` kept as a hash/navigation alias). General PWA Installation / App Branding and the single Cloudflare Token Refresh card reside in **Settings**.
   - Once admin auth is active, `/api/admin/legacy-users` scans `pwa_devices` lacking a valid `userId` (`NULL`, blank, or orphaned) and groups them case-insensitively by operator name (or `Unassigned / Anonymous`). Admins can upgrade any legacy operator to a full PIN account (`POST /api/admin/legacy-users/migrate`), 1-click link matching-name or anonymous devices to an existing account, or reassign individual devices (`PUT /api/admin/devices/:id/assign-user`) while automatically revoking prior-owner sessions on that device.

4. **Standard User Self-Service & Admin Master Control**:
   - Standard users (`role = 'user'`) can change their own PIN (`POST /api/account/change-pin`) and inspect/rename/revoke/delete only devices where `pwa_devices.userId === currentUser.id`.
   - Administrators (`role = 'admin'`) access **Import / Manage Data**, **Users & Devices**, and **General Settings**, create/edit/promote/demote/deactivate users, reset PINs, revoke active sessions, and manage all devices, while database guards protect the sole remaining active admin (`LAST_ADMIN_PROTECTED`).
   - Backend middleware (`requireAdmin`) enforces `401`/`403` once configured on `/api/backups/*`, `/api/devices*` (except `/api/devices/register`), `/api/app-config` (`DELETE`, plus `POST` for non-allowlisted keys; regular users may write `OFFSITE_USER_CONFIG_KEYS` via `canNonAdminWriteAppConfig` subject to `require_login_for_edits`), `/api/config` (`POST`), `/api/notifications/*`, `/api/demo/start|end`, and `/api/admin/*`.

5. **Home Assistant & Non-HA Lockout Recovery**:
   - **Home Assistant**: Add-on config options `admin_recovery_mode` and `admin_recovery_pin` (`/data/options.json`, or `ADMIN_RECOVERY_MODE` / `ADMIN_RECOVERY_PIN` env vars) unlock a temporary HMAC recovery admin session via `/api/auth/recovery-login` and display a persistent Recovery Mode banner.
   - **Non-Home Assistant CLI**: `npm run admin:recover -- <list|create-admin|reset-pin|promote|revoke-sessions> [--db <path>]` (`scripts/admin-recovery.ts`) directly recovers locked-out accounts against local or custom SQLite database paths.
