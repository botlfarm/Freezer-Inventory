# Technical Architecture & Context Reference Document
**Project:** Freezer Inventory Tracker  
**Current Version:** `2.41.4`  
**Target Environment:** Standalone Web Application & Live Home Assistant Add-On (Ingress Compatible)

---

## 1. Executive Overview & System Purpose
The **Freezer Inventory Tracker** is a full-stack, real-time inventory and cold-chain traceability management platform designed for farms, butcheries, commercial kitchens, and household storage. It manages physical meat cuts and general food inventory across on-site physical freezers, display cases, storage containers/boxes, off-site commercial cold storage facilities, palletized bulk freight, and custom butcher processing orders.

### Key Functional Capabilities
- **On-Site & Display Case Inventory**: Real-time bin, shelf, and container tracking with instant quantity adjustments, math expression evaluation (`+5`, `-2`, `3*4`), split cuts, tag filtering, customizable hierarchy sorting (alphabetical or user-defined category/sub/cut sequence), and restock alerts.
- **Off-Site Cold Storage & Movement Planning**: Multi-facility tracking, pallet and box hierarchies, drag-and-drop staging worksheets, barcoded QR scanning, pick/delivery order execution, and movement history.
- **Butcher Processing & Traceability**: Harvest lot tracking, animal counts, live/hot/cold weights, yield calculations, butcher document attachments, and full parent-cut lineage.
- **Automated Custom Lists & Notifications**: Inventory-controlled lists (min/max thresholds based on on-site counts, off-site counts, or off-site weights) with Home Assistant notifications, SMTP emails, or webhook alerts.
- **Real-Time Collaboration & Presence Lifecycle**: Three operating modes (Auto Multi-User, Forced Multi-User, and Exclusive Single-User Lock) with Server-Sent Events (SSE), instant `sendBeacon` leave notifications on tab close/unload, immediate multi-to-single auto switching, atomic action queuing, and sub-second delta synchronization.
- **Enterprise Audit Trail & Undo**: Full mutation history tracking client devices, companion app signatures, and instant reversible undo snapshots.

---

## 2. Technical Stack & Runtime Environment

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 / 19, TypeScript | Strict typing, functional components, custom hooks, React portals. |
| **Styling & UI** | Tailwind CSS (Tailwind v4 `@import "tailwindcss";`) | Mobile-first responsive design, dark/cool-gray neutral palettes, custom SVG icon system, Lucide icons. |
| **Build & Tooling** | Vite, `tsx`, `esbuild` | Node.js native ESM/CJS bundling, TypeScript type checking (`tsc --noEmit`). |
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
- **`Container`**: Storage bins, boxes, shelves, or dividers inside or outside a freezer. Attributes: `id`, `name`, `freezerId`, `templateId`, `imageUrl`, `deleteOnEmpty`, `icon`, `isBox`, `color`, `isArchived`.
- **`ContainerTemplate`**: Reusable container blueprint definitions (`id`, `name`, `icon`, `imageUrl`).
- **`Product`**: Canonical item definition. Attributes: `id`, `name`, `primaryCategory`, `subCategory`, `productNumbers[]`, `barcode`, `salePrice`, `salePriceUnit`, `listThresholds`, `listControlSources`, `defaultTagIds`, `isArchived`.
- **`MeatCut`**: Actual on-site physical package inventory record. Attributes: `id`, `productId`, `containerId`, `quantity`, `notes`, `tagIds`, `originalCutName`, `wrongLabel`, `isWrongLabel`, `serial`, `lot`, `packDate`, `weight`.

#### 2. Off-Site Storage & Freight Entities
- **`AppLocation`**: Physical facilities or destinations (`id`, `name`, `address`, `contact`, `isHome`, `type: 'storage' | 'delivery_pickup'`, `hasPallets`).
- **`AppPallet`**: Pallet identifier (`id`, `storageLocationId`, `tagIds`, `notes`, `isArchived`).
- **`AppBox`**: Box identifier (`id`, `palletId`, `tagIds`, `notes`, `isArchived`).
- **`OffSiteEntry`**: Individual package or bulk record located in off-site storage. Attributes: `id`, `serial`, `originalCutName`, `productId`, `packDate`, `lot`, `pieces`, `netWeight`, `box`, `pallet`, `currentLocation`, `storageLocationId`, `tagIds`, `archived`, `staged`, `wrongLabel`.
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
   - When multiple clients operate concurrently in the **same zone**: seamlessly transitions to collaborative 1.2s synchronization to keep active records aligned.
   - When users work in **different zones** (e.g., one on-site cataloging items, one off-site managing butcher logs): both users enjoy solo zero-lag performance without triggering unnecessary multi-user locks or friction.
2. **Zone-Aware Forced Multi-User Mode (`'multi'`)**:
   - Enforces real-time live sync across devices within the active operational zone or globally.
3. **Zone-Aware Exclusive Single-User Lock Mode (`'single'`)**:
   - Acquires an exclusive server-side mutex lock scoped to the active operational zone (`onsite`, `offsite`, or global `all`) for uninterrupted high-volume operations (such as major physical inventory counts or bulk imports).
   - Prevents global cross-zone collisions so locking on-site does not disrupt or revert off-site operators and vice-versa.
   - Other clients within the locked zone receive read-only status and can submit interactive break-in requests.

### Client-Side State Reconciliation (`useInventory.ts`)
- **Action Queueing (`queuePromiseRef`)**: All dispatched actions chain through a sequential promise queue to prevent HTTP race conditions.
- **Structural Sharing (`reconcileStateReferences`)**: When a server response returns, unaffected entity collections (`offSiteEntries`, `products`, `freezers`, `customLists`, etc.) retain their exact JavaScript memory references. This eliminates unnecessary React re-renders and skips heavy computation passes.
- **Client Metadata Tracking**: Every action captures client environment headers (`X-Client-Device`, `X-Client-Info`, `X-Client-Id`, `X-User-Name`) for granular audit attribution.

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

- **Full JSON Backups (`/api/backups/create`)**: Generates complete database snapshots with timestamped filenames.
- **ZIP Package Backups (`/api/backups/export-zip`)**: Packages the entire database, configuration, and image uploads directory (`/data/uploads`) into a single portable `.zip` archive.
- **Automated Periodic Snapshots**: Configurable daily/weekly auto-snapshots with automated retention pruning.
- **Database Undo Subsystem (`/api/inventory/undo`)**: Reconstructs previous entity states from transactional undo snapshots without requiring full database rollbacks.

---

## 7. Version Control & SemVer Governance

Every modification to the codebase must strictly follow the repository's versioning rules:

1. **Simultaneous Version Bumps**:
   - `/freezer_inventory_tracker/package.json` (`"version"`)
   - `/freezer_inventory_tracker/config.yaml` (`version`)
   - `/freezer_inventory_tracker/CHANGELOG.md` (Top-level release block)
2. **Bumping Criteria**:
   - **Patch (`0.0.1`)**: Bug fixes, performance optimizations, cosmetic refinements, documentation additions.
   - **Minor (`0.1.0`)**: New features, views, workflows, or components.
   - **Major (`1.0.0`)**: Breaking schema changes or major architectural redesigns.
3. **Changelog Formatting**:
   - Must include release version, date, categorized bullet points (`### Added`, `### Changed`, `### Fixed`), and an explicit `### Files Modified` section.
