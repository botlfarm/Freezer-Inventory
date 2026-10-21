# Technical Architecture & Context Reference Document
**Project:** Freezer Inventory Tracker  
**Current Version:** `2.53.5`  
**Target Environment:** Standalone Web Application & Live Home Assistant Add-On (Ingress Compatible)

---

## 1. Executive Overview & System Purpose
The **Freezer Inventory Tracker** is a full-stack, real-time inventory and cold-chain traceability management platform designed for farms, butcheries, commercial kitchens, and household storage. It manages physical meat cuts and general food inventory across on-site physical freezers, display cases, storage containers/boxes, off-site commercial cold storage facilities, palletized bulk freight, and custom butcher processing orders.

### Key Functional Capabilities
- **Automated Regression Testing & CI Quality Gates**: Integrated `vitest` test suites verifying mission-critical inventory operations before release: moving products across containers/freezers, splitting cuts, inbounding/outbounding, preventing negative stock, and calculating butcher yields and loss breakdowns. Wired into GitHub Actions (`.github/workflows/build-addon.yml`) to block Docker builds if tests or type checks fail.
- **Live Inventory Item & Container Matching**: Real-time live search across active and archived catalog items and containers during product intake and container creation. Automatically detects duplicate names, highlights archived items (`📁 Archived`), provides 1-click unarchive & restore workflows, and allows placing existing spare containers into target freezers with 1-click.
- **Progressive Web App (PWA) & Offline Resiliency**: Service Worker asset caching for 0-network boot, client-side IndexedDB database caching (`freezer_inventory_offline_db`) for 0ms loads, custom PWA app name/icon branding, dedicated PWA & Devices main-level settings tab, and persistent offline mutation queue with automatic FIFO background replay upon reconnect.
- **Automated PWA Push Updates & Background Cache Invalidation**: Automatic background detection of new add-on releases through dynamic version injection into `/sw.js`, Server-Sent Events (`appVersion`), window focus/visibility listeners, and 10-minute periodic worker checks. Implements Network-First navigation with cache fallback, automatic cache invalidation (`skipWaiting` and `clients.claim()`), and an automated floating update banner with auto-refresh countdown when idle, eliminating the need for PWA users to manually check or click update buttons.
- **PWA Device Registry, User Grouping & Access Control**: Persistent hardware device identification (`deviceId` UUID) per device, initial operator & device setup prompts, relational SQLite `pwa_devices` registry, PWA Device Manager dashboard in Settings. Features user-centric grouping (viewing all devices organized by operator handle), multi-criteria filtering (status, online presence, standalone PWA vs. browser, search), individual device killswitch, and user-level bulk revocation (`/api/devices/user/:operator/revoke`) which severs real-time SSE streams and blocks all of a user's registered devices with `403 DEVICE_REVOKED` regardless of persistent cookies.
- **On-Site & Display Case Inventory**: Real-time bin, shelf, and container tracking with instant quantity adjustments, math expression evaluation (`+5`, `-2`, `3*4`), split cuts, tag filtering, customizable hierarchy sorting (alphabetical or user-defined category/sub/cut sequence), and restock alerts.
- **Off-Site Cold Storage & Movement Planning**: Multi-facility tracking, pallet and box hierarchies, drag-and-drop staging worksheets, unified worksheet spreadsheet with synchronized sticky multi-select toolbar and column headers, barcoded QR scanning, pick/delivery order execution, and movement history.
- **Butcher Processing & Traceability**: Harvest lot tracking, animal counts, live/hot/cold weights, yield calculations, butcher document attachments, and full parent-cut lineage.
- **Automated Custom Lists & Notifications**: Inventory-controlled lists (min/max thresholds based on on-site counts, off-site counts, or off-site weights) with Home Assistant notifications, SMTP emails, or webhook alerts.
- **Real-Time Collaboration & Presence Lifecycle**: Two operating modes (Smart Auto Mode and Exclusive Single-User Lock) with Server-Sent Events (SSE), instant `sendBeacon` leave notifications on tab close/unload, immediate collaborative sync when multiple users work in the same zone, atomic action queuing, and sub-second delta synchronization.
- **Enterprise Audit Trail & Undo**: Full mutation history tracking client devices, companion app signatures, and instant reversible undo snapshots.

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
- **`CustomList`**: Dynamic or manual inventory lists. Attributes: `id`, `name`, `isInventoryControlled`, `controlType: 'auto' | 'prompt'`, `controlCondition: 'min' | 'max'`, `items: CustomListItem[]`.
- **`NotificationSettings`**: Configuration for HA, SMTP, Webhook, and digest schedules.

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

- **Complete Multi-Table Coverage (20 Database Tables)**: All backups (SQLite `.db`, full `.zip` capsules, and `.json` files) capture the entire relational database state across all 20 system tables: `freezers`, `container_templates`, `containers`, `categories`, `products`, `meat_cuts`, `locations`, `pallets`, `boxes`, `off_site_entries`, `movement_orders`, `butcher_orders`, `custom_lists`, `tags`, `app_config`, `notification_settings`, `notification_logs`, `history`, `pwa_devices`, and `undo_sql_journal`.
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
