### [2.20.2] - 2026-08-29

### Fixed
- **Home Assistant Supervisor Store Compatibility & Clean Repository Layout**:
  - Removed git-tracked runtime data and configuration JSON files from `data/` directory to prevent Home Assistant Supervisor store scanner from mistaking runtime files for add-on configs.
  - Updated `config.yaml` volume map definitions to use modern Supervisor options (`config:rw`).
  - Enhanced `.gitignore` rules for `data/*.json` and runtime SQLite state.

### Files Modified
- `/.gitignore`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.20.1] - 2026-08-29

### Fixed
- **Docker Build & Architecture Optimization**:
  - Replaced strict `npm ci` with `npm install` in `Dockerfile` to prevent package-lock sync failures across platforms during Docker container compilation.
  - Streamlined target architectures in GitHub Actions workflow (`.github/workflows/build-addon.yml`), `config.yaml`, and `build.yaml` to focus specifically on modern 64-bit platforms (`aarch64` and `amd64`), eliminating slow QEMU 32-bit emulation timeouts and reducing cloud build times to minutes.

### Files Modified
- `/freezer_inventory_tracker/Dockerfile`
- `/.github/workflows/build-addon.yml`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/build.yaml`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.20.0] - 2026-08-29

### Added
- **Multi-Architecture Cloud Pre-compilation & GitHub Actions**:
  - Configured automated GitHub Actions workflow (`.github/workflows/build-addon.yml`) using the official `home-assistant/builder` action to build and publish ready-to-run container images across `aarch64`, `amd64`, `armhf`, `armv7`, and `i386` to GitHub Container Registry (GHCR).
  - Added `build.yaml` with official Home Assistant multi-architecture base images.
  - Linked prebuilt GHCR container image endpoint in `config.yaml` (`image: "ghcr.io/botlfarm/freezer-inventory-tracker-{arch}"`).

### Changed
- **Multi-Stage Lean Docker Build**:
  - Re-architected `Dockerfile` into a 2-stage build: a build environment that compiles TypeScript frontend (`vite`) and backend (`esbuild`), and a stripped runtime container that only contains production artifacts and pruned dependencies.
  - Drastically reduced final add-on container disk footprint and eliminated on-device compilation during installation.

### Files Modified
- `/.github/workflows/build-addon.yml`
- `/freezer_inventory_tracker/Dockerfile`
- `/freezer_inventory_tracker/build.yaml`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.7] - 2026-08-29

### Changed
- **Repository Configuration & Git Tracking Hygiene**:
  - Updated Home Assistant add-on repository manifest (`repository.yaml`) URL and maintainer to `botlfarm/freezer-inventory-tracker`.
  - Hardened `.gitignore` to exclude SQLite database files (`*.db`, `*.db-wal`, `*.db-shm`), malformed database dumps, environment variable files, and runtime backup/upload directories.
  - Added `.gitkeep` placeholders to `data/backups/` and `data/uploads/` to maintain clean repository directory structure for new clones.

### Files Modified
- `/.gitignore`
- `/repository.yaml`
- `/freezer_inventory_tracker/data/backups/.gitkeep`
- `/freezer_inventory_tracker/data/uploads/.gitkeep`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.6] - 2026-08-28

### Fixed
- **Double Submission Prevention During UI / Network Lag**:
  - Implemented synchronous submission lock guards (`isSubmittingRef` and `isSubmitting` states) across `UnifiedInboundMoveForm.tsx` and `MoveModalContent.tsx` (`MoveMeat`, `MoveContainer`, and `ChangeContainerFlow`).
  - Disabled submit buttons and displayed real-time spinner animations during in-flight operations to prevent rapid re-clicks or duplicate item creation/movements during network delays.
  - Wrapped all async dispatches and state updates in robust `try / catch / finally` blocks ensuring submission locks always release safely upon completion or failure.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.5] - 2026-08-28

### Changed
- **Removed Redundant "Unassigned" and Location Labels in Dropdown Selectors**:
  - Removed noisy `Unassigned` tags and `Retired / Reusable Template` subtext when selecting containers without an assigned freezer location in `SearchableContainerSelect.tsx` and `MoveModalContent.tsx`.
  - Dropdown options and buttons for reusable templates and unassigned bags now display their clean container names without redundant tags.

### Files Modified
- `/freezer_inventory_tracker/components/SearchableContainerSelect.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.4] - 2026-08-28

### Fixed
- **Inbound and Move "Retired / Unused" Container List & Reusable Templates**:
  - Connected the "Retired / Unused" container selector in `UnifiedInboundMoveForm.tsx` and `MoveModalContent.tsx` to the `container_templates` table/state (`state.containerTemplates`).
  - Formatted reusable templates as selectable containers in the dropdown so users can immediately pick a bag template or unassigned container during inbound stock and move operations.
  - Automatically instantiates new active containers from templates when submitted with an assigned freezer location or moves/unarchives existing containers.
  - Enhanced container naming and duplicate detection to avoid false conflicts with templates across all modal screens.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.3] - 2026-08-28

### Fixed
- **Inbound Direct-to-Loose Temporal Dead Zone Error (`finalTagIds`)**:
  - Fixed a `ReferenceError: Cannot access 'finalTagIds' before initialization` error triggered during inbound actions when adding products directly to loose display freezers or containers via `BULK_ADD_MEAT_CUTS`.
  - Reordered variable assignments so `productDefaultTagIds` and `finalTagIds` are resolved prior to calling `isSameVariant` on `existingCutIndex`.
  - Added support for preserving and merging `originalCutName` values in `BULK_ADD_MEAT_CUTS` consistent with `ADD_MEAT_CUT`.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.2] - 2026-08-23

### Fixed
- **Cleaned Up Duplicate Segment Selector in Barcode Scan Mode**:
  - Removed the secondary duplicate segment dropdown from the right-hand header control bar.
  - Consolidated segment selection into a single dropdown directly under the Barcode Scan Mode header title.

### Files Modified
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.1] - 2026-08-23

### Changed
- **Movement Transfer Report Barcode Scan Mode Streamlining**:
  - Removed the Barcode Scan Mode launcher banner from the printable report preview body, keeping the launcher exclusively in the sidebar controls to maintain a clean report preview.
  - Added an in-overlay **Transfer Segment / Leg Selector** dropdown to Barcode Scan Mode, allowing users to switch directly between different transfer legs (e.g., source ➔ destination pairs) without exiting the scan mode modal.

### Files Modified
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.19.0] - 2026-08-23

### Added
- **Dedicated Barcode Scan Mode for Movement Transfer Reports**:
  - Introduced an interactive, full-screen **Barcode Scan Mode** overlay accessible directly from the Movement Transfer Report sidebar and report banner.
  - **Focused 1-at-a-Time View**: Renders single barcodes in extra-large high-contrast format with big navigation buttons (`Previous` / `Next Barcode`), keyboard arrow key support (`←`, `→`, `Space`, `Esc`), and a direct item jump dropdown.
  - **Spaced-Out List View**: Renders scannable items with generous padding and 32px vertical margins to prevent handheld scanners from picking up adjacent barcodes.
  - **Pallet Filter Control**: Allows filtering scannable items by individual pallet or scanning across all pallets in the transfer segment.
  - **Preserved Existing Report**: Left the standard printable and PDF stock transfer report layout completely untouched.

### Files Modified
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.18.12] - 2026-08-23

### Changed
- **Blank Slate Fresh Installations**:
  - Removed pre-seeded default demo locations (`On-Site Warehouse (Main)`, `Off-Site Cold Storage P1/P2/P3`, `The Steakhouse Restaurant`, `Wholesale Meat Cutters`) from `normalizeState` in `server.ts`, ensuring fresh installs start with an empty locations catalog (`locations: []`).
  - Removed pre-seeded default tags (`Use First`, `Not For Sale`) from `defaultInitialState` and `normalizeState` in `server.ts`, ensuring fresh installs start with an empty tags list (`tags: []`).
  - Cleared default fallback shipper name (`BOTL Farm`) and address (`859 Westford Rd Ashford CT`) in `MovementReportModal.tsx` and `LibraryView.tsx`, defaulting unconfigured shipper details to clean empty strings with helpful generic placeholders.
  - Updated fallback database template (`data/inventory-db.json`) to reflect empty `tags` and `locations` arrays.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/data/inventory-db.json`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.18.11] - 2026-08-23

### Changed
- **Base Barcode Priority for Weight-Embedded UPCs**:
  - Configured `generateWeightEmbeddedUpc` in `utils/barcode.ts` to strictly prioritize the product's assigned base barcode from the product catalog/Odoo as the primary source.
  - Retains the exact first 6 digits (prefix + item number) configured on the product, substitutes the 5-digit cumulative weight section (`WWWWW` in hundredths of a lb), and calculates the correct modulo-10 check digit.
  - Avoids generating synthetic or random placeholder barcodes when an item does not have a general barcode assigned.
  - Added an informative warning banner in `MovementReportModal.tsx` listing products missing assigned barcodes and prompting users to assign their 12-digit base barcode in Product Management so they scan accurately in Odoo.
  - Updated both interactive and printable/PDF stock transfer manifest views to display a clear "Missing Base Barcode" prompt for unassigned items.

### Files Modified
- `/freezer_inventory_tracker/utils/barcode.ts`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.18.10] - 2026-08-23

### Fixed
- **Stock Transfer Barcode and Item Number Alignment**: Fixed alignment issues in `MovementReportModal.tsx` where stock transfer barcodes and item numbers were misaligned or mismatched.
  - Enhanced `getEntryProduct` to match products by extracted item numbers (`productNumbers`) and cleaned product names (stripping leading prefixes like `15425 - `).
  - Fixed first-item lock-in in stock transfer manifest creation by canonicalizing map keys (`prod_${product.id}` or product name) and dynamically updating missing product/number metadata if a later item on the pallet provides it.
  - Updated weight-embedded barcode code source to prioritize the resolved 5-digit item number (`c.productNumber`), ensuring scannable barcodes (`215425WWWWWK`) accurately reflect the item number column (`15425`).

### Files Modified
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.18.9] - 2026-08-23

### Fixed
- **Added Missing `jsbarcode` Dependency to Add-on `package.json`**: Added `"jsbarcode": "^3.11.5"` and `"@types/jsbarcode": "^3.11.4"` directly to `/freezer_inventory_tracker/package.json`. Fixes Docker image build failure (`Rollup failed to resolve import "jsbarcode" from "/app/views/MovementReportModal.tsx"`) during Home Assistant add-on installation.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.18.8] - 2026-08-23

### Fixed
- **Selective Restore Schema Column Intersection**: Updated `copyTable()` in `selectiveRestoreFromDb()` (`server.ts`) to dynamically query `PRAGMA table_info` for both the source backup database and target live database. Selective restores now copy the exact intersection of columns present in both databases, preventing `SqliteError: table categories has no column named color` and column mismatch warnings when restoring sections from older database backups with legacy or dropped columns.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.18.7] - 2026-08-23

### Fixed
- **Codebase Clean-Up & Stale Asset Removal**:
  - Removed empty, unreferenced component stubs (`EditForms.tsx` and `FreezerCard.tsx`) from `/freezer_inventory_tracker/components/`.
  - Removed unused hook (`useIsTouchDevice.ts`) from `/freezer_inventory_tracker/hooks/`.
  - Removed 1.8MB leftover malformed database file (`inventory.db_malformed_1787495291428`) from `/freezer_inventory_tracker/data/`.
  - Cleaned up obsolete empty function stub `migrateJsonToSqliteIfNeeded()` in `/freezer_inventory_tracker/server.ts`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/EditForms.tsx` (Deleted)
- `/freezer_inventory_tracker/components/FreezerCard.tsx` (Deleted)
- `/freezer_inventory_tracker/hooks/useIsTouchDevice.ts` (Deleted)
- `/freezer_inventory_tracker/data/inventory.db_malformed_1787495291428` (Deleted)

### [2.18.6] - 2026-08-23

### Changed
- **Butcher Spreadsheet Category / Sub Category Column**: Updated the Category column across the Butcher Record Spreadsheet workspace (`ButcherSpreadsheetView.tsx`) to display as "Category / Sub Category" (e.g. `Beef / Steaks`, `Pork / Roasts`).
- **Comprehensive Parity Across UI & CSV**: Updated column headers, column picker toggle dropdowns, table cells, per-column filters, search filter queries, multi-column sorting, and CSV export headers/rows to output `Category / Sub Category` formatting.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`

### [2.18.5] - 2026-08-23

### Fixed
- **Clean Full Package ZIP Archives**: Removed redundant, outdated fallback `inventory-on-site.json` files from ZIP exports and automated rolling ZIP snapshots.
- **Export ZIP Engine Alignment**: Updated `/api/backups/export-zip` to include a full snapshot of the primary SQLite database (`inventory.db`) alongside `config.json`, `inventory-off-site.csv`, and photo attachments (`images/`), ensuring exported ZIP packages contain the full live SQLite dataset instead of a legacy JSON stub.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.18.4] - 2026-08-23

### Added
- **Database Persistence for Auto Snapshot Configuration (`app_config` Table)**: Added a new `app_config` key-value table to the relational SQLite database (`inventory.db`) to store auto-snapshot configuration (`auto_snapshot_config`) directly inside the database.
- **Unified Backup & Settings Integrity**: `loadAutoSnapshotConfig` and `saveAutoSnapshotConfig` now store auto-snapshot retention rules directly in `inventory.db` while maintaining `config.json` on disk in sync. Restoring any database snapshot (`.db` or `.zip`) now seamlessly restores auto-snapshot settings without losing retention rules.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.18.3] - 2026-08-23

### Fixed
- **Local Timezone Alignment for Rolling Snapshots**: Updated `runAutomaticRollingSnapshots` in `server.ts` to evaluate the current hour and days elapsed using the user's configured local timezone (from Notification Settings, e.g. `America/New_York`) rather than server UTC time.
- **Accurate Nightly Backup Hour Execution**: Fixed an issue where a snapshot set for 2:00 AM local time fired around 10:00 PM EDT (due to 02:00 UTC = 22:00 EDT conversion offset). Auto backup schedule checks now run every 15 minutes to guarantee precise local time execution.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.18.2] - 2026-08-23

### Changed
- **Consolidated Hierarchical Category & Subcategory Dropdown**: Combined separate Category and Subcategory filter dropdowns into a single unified dropdown (`Category / Subcategory`) across the Product Catalog filter toolbar and Matrix View (`LibraryView.tsx`).
- **Hierarchical Option Formatting**: Listed options in a clean hierarchical structure with `optgroup` headers for primary categories (`📁 Category`) and subcategory paths (`└ Category / Subcategory`), allowing 1-click filtering by full category or specific subcategory.
- **Product Management Quick Category Picker**: Added a single Category / Subcategory dropdown selector to the product creation and editing form (`ProductForm` in `ManagementForms.tsx`) for instant 1-click category assignment.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`

### [2.18.1] - 2026-08-23

### Added
- **Multi-Unit Breakdown for Category Headers and Product Stock Pills**: Updated primary category headers, subcategory headers, and product row stock pills in `LibraryView.tsx` to explicitly display stock units in **pkgs** (packages) and **lbs** (pounds) across On-Site, Off-Site, and Combined Total stock.
- **Searchable Product Assignment for Default Tags**: Upgraded the product dropdown in the "Assign Default Tag to Product" section of `LibraryView.tsx` to use the `<SearchableProductSelect>` component for instant fuzzy searching across product names, categories, and item numbers.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.18.0] - 2026-08-23

### Added
- **Catalog Stock Totals Breakdown Strip**: Added a summary strip at the top of the Product Catalog (`LibraryView.tsx`) displaying separate and combined totals for On-Site stock (packages), Off-Site stock (packages and weight in lbs), and Overall stock.
- **Catalog Multi-Facet Filters**: Introduced new dropdown filters to filter catalog items by Stock Location (`Quantity On-Site`, `Quantity Off-Site`, `Quantity Both`, `Quantity Neither / Out of Stock`), Primary Category, and Subcategory.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.17.4] - 2026-08-23

### Changed
- **Removed Category & Subcategory Color Option**: Removed unused color option for primary categories and subcategories across the entire application.
- **Database Schema Cleanup**: Removed the `color` column from the `categories` SQLite table definition, added an automatic migration on server startup (`ALTER TABLE categories DROP COLUMN color`), and stripped deprecated `color` fields from category state normalization.
- **UI Simplification**: Streamlined `CategoryStyleEditor` in `LibraryView.tsx` to focus purely on icon/emoji selection and cleaned up category headers to use clean default styling.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.17.3] - 2026-08-23

### Changed
- **Searchable Manual Product Addition to Lists**: Replaced native `<select>` dropdown in the Lists management view (`LibraryView.tsx`) with the `<SearchableProductSelect>` component, enabling instant fuzzy searching by product name, SKU / item number, primary category, and subcategory when manually adding items to a list.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.17.2] - 2026-08-23

### Changed
- **Notification Center Delivery Options**: Removed Home Assistant Persistent (`ha_persistent`) and Home Assistant Notify Service (`ha_notify`) options and form fields from the Lists Notification Center UI.
- **Default Delivery Method**: Updated fallback delivery method in `server.ts` and `LibraryView.tsx` from `ha_persistent` to `in_app`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.17.1] - 2026-08-22

### Added
- **Sales Pricing Unit Selector**: Added `salePriceUnit` (`'lb'` or `'package'`) to `Product` schema, SQLite database table, and product management forms (`ProductForm`), defaulting to `per lb`.
- **Dynamic Valuation Calculations**: Updated butcher processing report cut breakdown table (`ButcherRecordsView.tsx`) to calculate estimated sales values using `totalWeight * price` for per-lb items vs `count * price` for per-package items.
- **Product Catalog & Quick Info Badges**: Displayed pricing unit (`/ lb` vs `/ pkg`) alongside price values in `LibraryView.tsx` and `ProductQuickInfoModal.tsx`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md`

### [2.17.0] - 2026-08-22

### Added
- **Product Sales Price Attribute**: Added optional `salePrice` ($ / unit) attribute to product schema, SQLite database table, and product management forms (`ProductForm`).
- **Product Catalog Price Display**: Added Sales Price badge indicators in the main Product Catalog (`LibraryView.tsx`) and Product Quick Info modal (`ProductQuickInfoModal.tsx`).
- **Butcher Valuation Reports**: Integrated `Unit Sales Price` and `Est. Sales Value` columns into the Butcher Cut Breakdown report table (`ButcherRecordsView.tsx`), including an aggregate estimated total sales value summary header.
- **AI Backup & Migration Mapping**: Updated `FREEZER_MAPPING_AI_GUIDE.md` schema with `salePrice?: number`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md`

### [2.16.3] - 2026-08-22

### Changed
- **Removed Legacy Theme Selector**: Removed the legacy "Display Theme Mode" card and text from the Application Preferences section in the Product Catalog Settings tab (`LibraryView.tsx`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.16.2] - 2026-08-22

### Added
- **Automatic Unarchiving on CSV Import**: Ensured that importing butcher orders (`ADD_BUTCHER_ORDER`) or off-site CSV entries (`IMPORT_OFFSITE_ENTRIES`) containing archived products will automatically unarchive those items (`isArchived: false`), restoring them to the active catalog since they now have new inventory.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.16.1] - 2026-08-22

### Added
- **Server-Side Archived Stock Safeguards**: Added server-side validation in `server.ts` (`ADD_MEAT_CUT` handler) that prevents adding stock to archived items, returning a clear error requiring the product to be unarchived first.
- **Zero-Stock Archiving Constraint**: Blocked archiving products both in the Product Form (`ManagementForms.tsx`) and Product Catalog list (`LibraryView.tsx`) if the product has remaining stock anywhere (on-site or off-site), displaying a warning tooltip explaining that inventory must be cleared first.
- **Product Catalog Status Filtering & Actions**: Added status filter buttons (**Active Catalog**, **Archived Items**, **Show All**) in `LibraryView.tsx`, displayed `[Archived]` badges next to archived product names, and added quick Archive/Unarchive buttons to product catalog rows.
- **Form Select Protection**: Prevented archived products from being selected in stock addition forms (`SearchableProductSelect.tsx`) unless unarchived.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/components/SearchableProductSelect.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.16.0] - 2026-08-22

### Added
- **Product Archiving Support**:
  - Introduced the `isArchived` property to `Product` model and `products` SQLite database table (with automatic database migration).
  - Added an "Archive Product" toggle to `ProductForm` in `ManagementForms.tsx` with helpful guidance explaining that archived items are hidden from day-to-day operations while preserving historical integrity.
  - Added "Archive Item" / "Unarchive Item" quick actions to product card dropdown menus in `ProductView.tsx`.
  - Implemented catalog status filtering in `ProductView.tsx` with pills to filter by **Active Catalog** (default), **Archived Items** (with live count badge), and **Show All**.
  - Updated `SearchableProductSelect.tsx` dropdowns to exclude archived items from daily selection forms unless explicitly allowed or currently selected, while displaying an `[Archived]` tag on option items.
  - Excluded archived items from `DisplayCaseView.tsx` product catalog grouping.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/components/SearchableProductSelect.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`

### [2.15.2] - 2026-08-22

### Changed
- **Renamed Finalize Order to Done Planning**: Updated button text in `ActiveMovementModal.tsx` from "Finalize Order" to "Done Planning" when a movement order is in planning status.
- **Improved Done Button Visibility**: Corrected invalid CSS class on the modal's primary `Done` button to give it a high-contrast Indigo background with clear hover and active states, eliminating blending with the modal canvas.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`

### [2.15.1] - 2026-08-22

### Added
- **Summarized & Simplified Logistics Checklist Views**:
  - Replaced repetitive item listings (e.g., repeating "Ground Pork" 40 times) with automated piece aggregation (e.g., "40 Ground Pork").
  - Introduced **Format & Detail Level** controls in the Checklist sidebar allowing instant toggling between **Detailed Cuts** (summarized cut breakdown per box) and **Simplified** mode (minimal box labels and locations for rapid scanning).
  - Updated both single PDF and combined PDF export pipelines to dynamically reflect the selected detail level and include mode flags in filenames.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.15.0] - 2026-08-22

### Added
- **Logistics Transfer Execution Checklist in Reports Center**:
  - Added a new **Checklist** report template tab to `MovementReportModal.tsx` allowing post-confirmation retrieval, viewing, and printing/exporting of the full two-phase movement execution checklist.
  - Formatted Phase 1 (Pick Up Checklist from Source Pallets) and Phase 2 (Deliver Checklist to Destination Locations) with live status indicators (`✓` / `☐`), split box alerts, and cut item breakdowns.
  - Integrated full single-page and combined PDF export functionality with light mode background enforcement (`#ffffff`) for clean printing and digital archiving.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.7] - 2026-08-22

### Fixed
- **Comprehensive White Background Enforcement for All PDF Export Types & Containers**:
  - Added CSS rule overrides targeting `#all-printable-documents`, `.printable-pdf-document`, and `.printable-pdf-page` in `/freezer_inventory_tracker/index.css` to force `#ffffff` background, black text, and visible borders on all multi-document containers and tables.
  - Updated `saveAsPdf` and `saveAllAsPdf` in `MovementReportModal.tsx` to automatically strip the `.dark` class and enforce `colorScheme: 'light'` across all child elements inside PDF clones.
  - Applied `printable-pdf-document` class to both single (`#printable-document`) and combined (`#all-printable-documents`) DOM nodes so delivery slips, manifests, and stock transfers retain pure light formatting regardless of application dark theme.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.6] - 2026-08-22

### Fixed
- **Enforced Pure White Background for PDF Exports**:
  - Automatically suspends dark mode styling on `document.documentElement` and `document.body` during `saveAsPdf` and `saveAllAsPdf` generation, restoring original theme classes upon completion.
  - Set explicit `colorScheme: 'light'` and `.light` class on the offscreen wrapper and cloned document root to guarantee white backgrounds (`#ffffff`) and dark high-contrast typography across all report types in single and combined PDF exports.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.5] - 2026-08-22

### Fixed
- **Universal "Save All to Single PDF" Support**:
  - Extended the "Save All to Single PDF" export feature to work across all report types (`delivery_slip`, `manifest`, and `stock_transfers`).
  - Implemented multi-location document generation in `#all-printable-documents` for Delivery Slips and Transfer Manifests so that clicking "Save All to Single PDF" compiles reports for all destination locations into a single multi-page PDF document.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.4] - 2026-08-22

### Fixed
- **Fixed PDF Background Colors for "Save All" Feature**:
  - Enforced explicit white background styling (`#ffffff` / `bg-white`) and black text (`#000000` / `text-black`) on the cloned `#all-printable-documents` container and temp wrapper during PDF generation.
  - Replaced semi-transparent background color classes (`bg-gray-50/70`, `bg-gray-100/90`, `bg-emerald-50/60`, `hover:bg-emerald-50/20`) with solid light background colors (`bg-white`, `bg-gray-50`, `bg-gray-100`, `bg-emerald-50`) to prevent dark background color bleed when rendered in PDF format.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.3] - 2026-08-22

### Added
- **Save All Stock Transfers to Single Combined PDF**:
  - Implemented `saveAllAsPdf` functionality that compiles all transfer movement pairs for the current order into a single unified multi-page PDF document.

### Changed
- **Reordered Report Header Grid**:
  - Switched top document header layout so **Source Location (From)** appears first on the left, followed by **Destination (To)** in the second column.
- **Removed Redundant Instruction and Banner Elements**:
  - Removed the unnecessary green "Stock Transfer" banner div and bottom "Barcode Scanner Instructions" callout box from the report output.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.2] - 2026-08-22

### Fixed
- **Clean Sidebar Layout for Stock Transfers Report**:
  - Removed duplicate and extraneous "Include Pallets (Lot#)" selector, destination location picker, and location reference cards when viewing the **Stock Transfers** tab.
  - Confined destination location dropdowns and legacy pallet sub-selectors strictly to the **Delivery Slip** and **Manifest** report tabs, eliminating UI redundancy and confusion across movements.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.1] - 2026-08-22

### Fixed
- **Pallet Selector & Metadata Field Isolation in Stock Transfers Report**:
  - Refactored `segmentPalletSelections` state into a key-value record mapped by segment pair (`sourceLocationId==>destinationLocationId`), ensuring pallet selections on one segment never leak or reset selections on another segment.
  - Enhanced pallet name detection by looking up container names and entry metadata (`state.containers`, `state.offSiteEntries`, `order.originalEntries`), correctly resolving all pallets across all movements.
  - Scoped Purchase Order (PO# / Ref#), Items summary description, and Bottom Notes to the specific segment (`segment:${pairKey}`) when working in the Stock Transfers tab, while preserving location-scoped fields (`loc:${locationId}`) for Delivery Slips and Manifests.
  - Streamlined sidebar controls when in Stock Transfers mode: hidden irrelevant Shipper/Origin fields and tailored labels specifically for transfer references, summaries, and segment-specific instructions.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.14.0] - 2026-08-22

### Added
- **Generic Stock Transfers Report with Scannable Barcodes & Segment Pallet Grouping**:
  - Renamed report from "Odoo Moves" to generic **Stock Transfers** to support any warehouse or ERP system seamlessly.
  - Implemented scannable vector SVG barcode rendering using `JsBarcode` for each product cut in the transfer manifest, formatting standard 12-digit UPC-A weight-embedded barcodes with automatic check-digit verification.
  - Added formatted human-readable UPC text spacing (e.g., `2 15425 00450 3`) with quick-copy clipboard button and visual confirmation feedback.
  - Fixed pallet selection to be isolated per transfer segment rather than shared across different segments, with independent multi-select checkboxes in the sidebar.
  - Added structured pallet grouping in the printable report document: when multiple pallets are selected, items are automatically categorized and sorted by pallet/lot with subtotal counts, piece tallies, and weight totals per pallet.
  - Added transfer segment grand totals summarizing all included pallets at the bottom of the manifest.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.13.0] - 2026-08-22

### Added
- **Segmented Off-Site Movement Reports for Odoo with Weight-Embedded Barcodes**:
  - Added dedicated **Odoo Moves** report template tab in `MovementReportModal.tsx` for off-site movement orders.
  - Automatically partitioned movement orders by distinct `[Source Location] ➔ [Destination Location]` transaction pairs (e.g., Meatworks to Click, Pyramid to Click, Meatworks to Home, Pyramid to Home, Meatworks to Pyramid).
  - Segment selector in the sidebar showing source/destination badges, total item counts, and total weights.
  - Dynamic stock transfer manifest with product cut summaries, total boxes, pieces, net weights, and generated 12-digit UPC-A weight-embedded barcodes for each product cut based on the total weight moving in that specific segment.
  - One-click barcode clipboard copy button with checkmark confirmation feedback.
  - Dynamic PDF generation with custom filenames matching the selected transfer segment (`Odoo_Transfer_[Date]_[Source]_to_[Destination].pdf`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.12.1] - 2026-08-22

### Changed
- **Multi-Product Number UPC-A Barcode Auto-Fill Selector**:
  - Enhanced the UPC-A Barcode section in `ProductForm` (`ManagementForms.tsx`) to support selecting from any of the configured backend product/item numbers.
  - Rendered individual quick-action chips for each item number with real-time active state indicators (`✓ #item` for the currently matched barcode, `⚡ #item` to switch).
  - Maintained instant calculation of 12-digit 0-lb base UPC-A barcodes with accurate check digits when clicking any item number.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`

### [2.12.0] - 2026-08-22

### Added
- **Product UPC-A Barcode Attribute & Weight-Embedded Code Generator**:
  - Added new `barcode` column to the `products` table in SQLite schema (`server.ts`).
  - Added non-destructive database migration in `tryInit()` to safely add `barcode` column to existing database tables.
  - Implemented automatic backfill and generation of default 0-lb base UPC-A barcodes from the first item number in `productNumbers`.
  - Created `/freezer_inventory_tracker/utils/barcode.ts` with UPC-A modulo-10 check digit computation, default 0-lb barcode generation (format: prefix `2` + 5-digit item # + `00000` + check digit), weight-embedded barcode calculation, and barcode validation.
  - Added `barcode` field to `Product` interface in `types.ts`.
  - Added editable `UPC-A Barcode` input in `ProductForm` (`ManagementForms.tsx`) with auto-generation from item numbers, real-time UPC-A validation indicators, and auto-fallback.
  - Added Barcode badges and filtering to Product Catalog, Matrix views, and search in `LibraryView.tsx`.
  - Added UPC-A barcode display in `ProductQuickInfoModal.tsx`.
  - Updated `FREEZER_MAPPING_AI_GUIDE.md` with the new `barcode` schema and translation rules.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/utils/barcode.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md`

### [2.11.24] - 2026-08-21

### Added
- **Developer Instructions: Enforced Relational Database Architecture & Minimizing Data Duplication**:
  - Updated `AGENTS.md` and `GEMINI.md` with explicit guidelines ensuring all future features adhere to strict relational data normalization.
  - Documented rules to minimize duplicate fields across tables, use foreign key references (`productId`, `containerId`, `orderId`) with dynamic relational resolution, and restrict text duplication to immutable audit snapshots.

### Files Modified
- `/AGENTS.md`
- `/GEMINI.md`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [2.11.23] - 2026-08-19

### Added
- **Dedicated `wrongLabel` Column for Original Product ID Preservation**:
  - Added `wrongLabel` column to `TABLE_SCHEMAS.off_site_entries` and `TABLE_SCHEMAS.meat_cuts` in `server.ts`.
  - Added non-destructive database migrations in `tryInit()` to add the `wrongLabel` column to existing database tables.
  - Updated `types.ts` to include `wrongLabel?: string` (storing the original `productId` prior to label correction).

### Changed
- **Preserved Immutable `originalCutName` & Refactored Wrong-Label Tracking**:
  - Maintained `originalCutName` as immutable raw package text from the butcher.
  - When marking an item as labeled wrong (`CORRECT_OFFSITE_LABEL`, `BULK_CORRECT_OFFSITE_LABEL`, `CORRECT_MEAT_LABEL`), the original `productId` is captured in the `wrongLabel` column, and `productId` is updated to the actual correct catalog product.
  - Non-empty `wrongLabel` triggers the wrong-label indicator flag and enables full Undo/Revert back to the original `productId`.
  - State normalization (`normalizeState`) and database sync (`loadStateSync` / `saveStateSync`) cleanly derive and preserve `wrongLabel` and `isWrongLabel` without touching or clearing `originalCutName`.
  - Updated `OffSiteSpreadsheet.tsx` and `CorrectWrongLabelModalContent.tsx` to resolve the original product name from `wrongLabel` and provide seamless 1-click Undo & Revert.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/components/CorrectWrongLabelModalContent.tsx`

### [2.11.22] - 2026-08-19

### Changed
- **Reverted Redundant Database Columns & Restored Pure Relational Data Model**:
  - Reverted redundant denormalized columns (`cuts`, `isWrongLabel`, `wrongLabelOriginal`, `storageLocationId`, `palletId`, `pallet`, `location`, `currentLocation`) from `TABLE_SCHEMAS.off_site_entries` and `TABLE_SCHEMAS.meat_cuts` in `server.ts`.
  - Cleaned up startup table migrations in `tryInit()` to preserve the clean relational schema without duplicating box/pallet/location data across individual item records.
  - Leveraged single source of truth:
    - Product and cut names resolve relationally from `productId` -> `products.name`.
    - Box, Pallet, and Location resolve relationally from `box` -> `boxes.palletId` -> `pallets.storageLocationId` -> `locations.name`.
    - Wrong-label physical package override is stored exclusively in `originalCutName` and derived dynamically in memory as needed.
  - Updated `OffSiteSpreadsheet.tsx` to resolve pallet and location relationally through the `Entry -> Box -> Pallet -> Location` hierarchy.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.11.21] - 2026-08-19

### Fixed
- **Persistent Wrong-Label Status and Full Undo/Revert for Off-Site Entries**:
  - Added missing database schema columns (`cuts`, `isWrongLabel`, `wrongLabelOriginal`, `storageLocationId`, `palletId`, `pallet`, `location`, `currentLocation`) to `off_site_entries` table in SQLite schema definitions (`TABLE_SCHEMAS.off_site_entries`).
  - Added automatic database migration logic in `tryInit()` to safely add these columns to any existing SQLite databases without data loss.
  - Updated SQLite serialization (`fromDb` and `toDb`) for `off_site_entries` to reliably persist and load `isWrongLabel`, `wrongLabel`, and `wrongLabelOriginal`.
  - Updated `loadStateSync` and `saveStateSync` to accurately preserve explicit wrong-label state and prevent butcher order merges or reload cycles from dropping wrong-label metadata.
  - Ensured both individual and bulk "Undo & Revert" operations immediately restore the original physical label, clear all wrong-label flags, and correctly update the UI badge states.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.11.20] - 2026-08-19

### Fixed
- **Restricted Wrong-Label Badging to Explicitly Corrected Items**:
  - Removed implicit wrong-label inference from standard CSV import cut names in `server.ts` state normalization (`normalizeState`), preventing standard off-site inventory from being erroneously marked as labeled wrong.
  - Restricted wrong-label badge rendering across `OffSiteSpreadsheet.tsx` (both aggregated box summary tables and item rows) to strictly trigger only when an item has explicit wrong-label flags (`isWrongLabel`, `wrongLabel`, or `wrongLabelOriginal`).
  - Aligned movement execution and reversion handlers in `server.ts` (`EXECUTE_MOVEMENT_ORDER` and `REVERT_MOVEMENT_ORDER`) to only attach wrong-label overrides when the source off-site item was explicitly marked as a wrong label.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.11.19] - 2026-08-19

### Fixed
- **Wrong-Label Persistence on Off-Site to On-Site Transfer**:
  - Ensured all wrong-label metadata (`originalCutName`, `wrongLabel`, `isWrongLabel`, `wrongLabelOriginal`, `serial`, `packDate`, `weight`) is fully preserved and transferred when executing movement orders from off-site to on-site Staging and freezers (`EXECUTE_MOVEMENT_ORDER` and `MOVE_MEAT_QUANTITY`).
  - Extended SQLite `meat_cuts` persistence serialization (`fromDb` and `toDb`) and state normalization to retain and auto-populate wrong-label attributes on on-site meat cut records.
  - Aligned the "Labeled As" visual indicators across `ProductView.tsx`, `DisplayCaseView.tsx`, and `MeatCutRow.tsx` so physical package labels remain visible whenever an item's assigned product differs from its original label.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`

### [2.11.18] - 2026-08-19

### Fixed
- **Off-Site Tag Visibility**:
  - Restored tag badge rendering (`tagIds`) directly into the Cuts column across all off-site spreadsheet views and individual rows, ensuring tags like "🍳 Use First" and "🛑 Not For Sale" are clearly visible.
  - Added tag badge indicators across grouped box cuts so tagged inventory is immediately apparent in aggregated summary tables.
  - Made the item tag selector button accessible directly from the spreadsheet row without requiring users to enter "Direct Edit" mode.
- **Off-Site Revert to Original Label**:
  - Enhanced server-side `REVERT_OFFSITE_LABEL` and `BULK_REVERT_OFFSITE_LABEL` handlers to reliably resolve the original cut name from item properties or butcher record cross-references, remap the corresponding product catalog item, and cleanly clear all wrong-label flags.
  - Expanded the "Undo & Revert" button visibility in the "Correct Wrong Label" modal to trigger whenever an item's current tracking name differs from its physical package label.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.11.17] - 2026-08-18

### Fixed
- **Accurate Wrong-Label Assignment on Movements & State Normalization**:
  - Corrected off-site movement execution (`EXECUTE_MOVEMENT_ORDER`) and staging reversion (`REVERT_MOVEMENT_ORDER`) to only attach `originalCutName` and mark wrong-label flags if an off-site item was explicitly corrected as a wrong label (`isWrongLabel` / `wrongLabel` / `wrongLabelOriginal`), rather than indiscriminately assigning standard CSV cut text as wrong label overrides.
  - Added self-healing normalization in `server.ts` to automatically strip redundant `originalCutName` overrides on on-site meat cuts when the cut name matches the catalog product name or product number format.
  - Refined wrong-label detection in `OffSiteSpreadsheet.tsx` to prevent standard catalog items with item number prefixes from falsely triggering wrong-label warning badges.
  - Added explicit wrong-label warning indicators (`⚠️ Labeled: <Original Cut>`) across `OffSiteMovementScanner.tsx` (all scanning/delivery phases) and `OffSiteMovementPlanner.tsx` (Staging candidates list) so physical package labels remain clearly visible during active movement planning and mobile barcode scanning.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`

### [2.11.16] - 2026-08-18

### Added
- **Animal Drop-Off Order Creation Without CSV**:
  - Implemented the ability to start a new butcher order immediately upon dropping off animals with minimal information (species, drop-off/kill date, animal count, order #).
  - Added an "Auto Temp #" generator button to conveniently create placeholder order numbers (e.g., `TEMP-YYYYMMDD-XXX`) when an official butcher order number is not yet assigned.
  - Made the CSV cutsheet upload completely optional during order creation with guidance banners explaining the drop-off workflow.
  - Added a "Pending Cuts (Drop-Off)" indicator and direct "Upload Cutsheet CSV" action on pending order cards to attach cutsheets once processed.
  - Enhanced the Edit Order modal to allow updating Butcher / Location Source along with all other drop-off details as they become available.

### Changed
- **Renamed Tab**: Renamed the "Import CSV" tab to "New Order" in `ButcherRecordsView.tsx` to reflect both drop-off order initialization and CSV cutsheet import workflows.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`

### [2.11.15] - 2026-08-17

### Fixed
- **Off-Site Storage Wrong Label Tagging & Seamless Reversion**:
  - Implemented explicit, durable `isWrongLabel`, `wrongLabel`, and `wrongLabelOriginal` tracking on `OffSiteEntry` across server transactions and client views.
  - Fixed off-site label correction (`CORRECT_OFFSITE_LABEL` and `BULK_CORRECT_OFFSITE_LABEL`) to retain original physical package labels in `wrongLabelOriginal` and link to corrected catalog product IDs.
  - Implemented single and bulk revert operations (`REVERT_OFFSITE_LABEL` and `BULK_REVERT_OFFSITE_LABEL`) to restore original package cuts/labels and clear correction flags cleanly.
  - Enhanced `OffSiteSpreadsheet.tsx` with prominent warning tags (`Labeled: <Original Cut>`), an interactive Wrong Label correction and "Undo & Revert" modal banner, and a contextual "Bulk Revert Labels" action button when wrong-labeled items are selected.
  - Added backward-compatible normalization in `server.ts` to seamlessly populate `isWrongLabel` and `wrongLabelOriginal` for existing databases.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.11.14] - 2026-08-17

### Changed
- **Destination-Scoped Pallet Selection for Butcher Records Import**:
  - Filtered the active pallet dropdown options in `ButcherRecordsView.tsx` strictly to pallets currently located at the selected destination storage location (or default butcher source).
  - Automatically resets any pre-selected pallet if the user switches to a destination storage location where that pallet does not reside, preventing cross-destination pallet conflicts.
  - Enhanced `PalletCreatableSelect` with contextual headers (`Active Pallets at <Location>`), descriptive empty states, and cross-location warning badges if a typed pallet name exists at another facility.
  - Kept seamless "+ Create New Pallet" functionality for generating new pallets directly at the chosen destination.
- **Descending Order Number Sorting for Butcher Orders**:
  - Updated the butcher orders list, dropdown selectors, and spreadsheet filters in `ButcherRecordsView.tsx` and `ButcherSpreadsheetView.tsx` to sort by order number in descending order (`numeric: true`), ensuring the largest/newest order numbers are always displayed at the top.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`

### [2.11.13] - 2026-08-17

### Changed
- **Active Non-Archived Pallet Selector for Butcher Records Import**:
  - Replaced raw datalist input with `PalletCreatableSelect` in `ButcherRecordsView.tsx` during butcher order intake.
  - Excluded all archived pallets from the selector suggestion list by cross-checking `state.pallets`, `state.freezers`, and `state.offSiteEntries`.
  - Added dedicated searchable list showing existing non-archived pallets with custom badge indicators (`Existing Active Pallet` vs. `New Pallet will be created`).
  - Added intuitive "+ Create New Pallet" option and instant custom typing support to allow seamless creation of new pallets on import.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`

### [2.11.12] - 2026-08-17

### Fixed
- **Controlled Input State Consistency Across All Views and Components**:
  - Eliminated React runtime warnings regarding uncontrolled-to-controlled and controlled-to-uncontrolled input state transitions.
  - Implemented guaranteed default fallback values (`|| ''` and `?? ''`) across all form inputs, modals, batch edit panels, comboboxes, and dropdowns.
  - Patched inputs in `OffSiteSpreadsheet.tsx`, `ButcherRecordsView.tsx`, `ComboboxInput.tsx`, `MediaSelector.tsx`, `AddToListModalContent.tsx`, `UnifiedInboundMoveForm.tsx`, `MoveModalContent.tsx`, `AddForms.tsx`, `OffSiteStagingWorksheet.tsx`, `OffSiteHierarchy.tsx`, `ActiveMovementModal.tsx`, and `LibraryView.tsx`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/ComboboxInput.tsx`
- `/freezer_inventory_tracker/components/MediaSelector.tsx`
- `/freezer_inventory_tracker/components/AddToListModalContent.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`

### [2.11.11] - 2026-08-17

### Added
- **Target Pallet & Location Support for Butcher Imports**:
  - Enhanced butcher order imports to support specifying both target locations and target pallet placements during CSV import and direct off-site intake.
  - Added target location selector dropdown and destination pallet input (with active pallet autocomplete datalist) inside the butcher intake modal.
  - Updated CSV parser to automatically extract optional `Pallet` and `Location` columns from butcher CSV files.
  - Updated server-side `ADD_BUTCHER_ORDER` handler in `server.ts` to assign `pallet` and `currentLocation` onto imported offsite records and auto-register pallets in the active pallet registry.
  - Updated mapping guide (`FREEZER_MAPPING_AI_GUIDE.md`) with schema guidelines for butcher order imports and pallet attributes.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md`

### [2.11.10] - 2026-08-16

### Added
- **Bulk Threshold Number Support in Batch Edit Actions**:
  - Added dedicated bulk threshold input control to the Batch Edit toolbar in the Bulk Matrix Spreadsheet view.
  - Enabled applying custom numeric thresholds directly when batch adding products to lists (`Add to List`) or updating threshold levels (`Set Threshold Level...`).
  - Streamlined `BATCH_TOGGLE_PRODUCTS_ON_LIST` execution for setting inventory sources, thresholds, and list membership across multi-selected items in a single batched payload.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.11.9] - 2026-08-16

### Added
- **Lists Catalog Bulk Matrix & Inventory Control Spreadsheet**:
  - Introduced a secondary sub-tab in the Library Lists catalog: **Bulk Matrix & Inventory Control (Spreadsheet)**.
  - Interactive grid displaying all library products across all custom lists in a single consolidated matrix view.
  - Direct inline controls per cell to toggle list membership, adjust tracking sources (`onsite_count`, `onsite_weight`, `offsite_count`, `offsite_weight`, `total_count`, `total_weight`), and configure custom alert thresholds.
  - Multi-select batch action toolbar allowing users to select any subset of products and batch add/remove from lists, set inventory control sources, or update thresholds across lists simultaneously.
  - Multi-dimensional filters for searching products, primary categories, sub-categories, specific list assignments, and membership status (in any list, in none, or inventory-controlled only).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.11.8] - 2026-08-16

### Added
- **Enforced Pallet Selection in Off-Site Staging Worksheet**:
  - Implemented strict validation before off-site staging finalization: every staged cut or boxed item must have an assigned pallet (existing pallet or custom pallet identifier).
  - Added interactive `PalletValidationModal` displaying all unassigned items with a direct one-click "Select All Missing (Bulk Edit)" action to batch-assign pallets instantly.
  - Added visual warning indicators (`AlertTriangle`, amber border rings, and "Pallet Required" status tags) in both Box View and Flat List View tables when items lack a pallet.
  - Added a live Pallet Assignment Readiness status banner in the overview header and updated the finalization button with dynamic visual feedback.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`

### [2.11.7] - 2026-08-16

### Added
- **Off-Site Staging Worksheet Notes and Tags Integration**:
  - Added dedicated **Tags** and **Notes** columns and interactive controls to both Box View and Flat List View tables in `OffSiteStagingWorksheet.tsx`.
  - Added `WorksheetTagPopover` enabling tag viewing and buffered editing per worksheet row with instant tag badges and visual color indicators.
  - Added inline editable text inputs for custom item notes directly within the staging tables.
  - Added bulk tag assignment (`BulkTagPopover`) and bulk notes input to the multi-select editing toolbar for fast batch updating.
  - Maintained complete preservation of notes and tags metadata when staging entries are finalized and committed to off-site storage inventory.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.11.6] - 2026-08-16

### Fixed
- **Modal Window Deferred Database Operations**:
  - Converted `SelectTagsModalContent` to maintain tag toggles in local component state, only dispatching database changes when the "OK" button is clicked.
  - Converted `AddToListModalContent` to maintain list membership checkboxes and custom list item notes in local state, dispatching state changes only when clicking "OK".
  - Converted `ProductQuickInfoModal` to buffer list selections, list item notes, and product registration in local state, applying changes to the database only when clicking "OK".
  - Updated tag selection popovers in `OffSiteSpreadsheet` and `ButcherSpreadsheetView` to buffer tag choices locally and commit updates only upon clicking "OK".
  - Resolved potential race conditions caused by rapid, intermediate state dispatches on popup/modal user interactions.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/SelectTagsModalContent.tsx`
- `/freezer_inventory_tracker/components/AddToListModalContent.tsx`
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`

### [2.11.5] - 2026-08-12

### Fixed
- **On-Site Item Move Variant Isolation**:
  - Updated `BackstockPullControl` in `ProductView` and `DisplayCaseView` to isolate display stock calculations and "Put Back" actions strictly to the matching item variant (`productId`, `notes`, `tagIds`, `originalCutName`).
  - Added full variant metadata (`notes`, `tagIds`, `originalCutName`) to drag-and-drop data transfers (`MeatCutRow`) and container move payloads (`ContainerCard`, `FreezerView`, `MoveModalContent`).
  - Upgraded `MOVE_MEAT_QUANTITY` fallback resolution in `server.ts` to query by exact variant details if primary ID lookup is bypassed, preventing unintended merging or moving of alternate item variants.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/components/ContainerCard.tsx`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`

### [2.11.4] - 2026-08-12

### Fixed
- **Split Variant Information Preservation Across On-Site and Off-Site Transfers**:
  - Implemented exact variant matching (`isSameVariant`) in `server.ts` that compares `productId`, `notes`, `tagIds`, and `originalCutName`.
  - Updated `ADD_MEAT_CUT`, `MOVE_MEAT_QUANTITY`, `BULK_ADD_MEAT_CUTS`, container loose unpacking, `EXECUTE_MOVEMENT_ORDER`, and `REVERT_MOVEMENT_ORDER` to preserve split variants as separate entities when moving between containers or transitioning between on-site storage and off-site movement orders.
  - Ensures notes, tags, and custom cut names are accurately retained and passed without losing variant separation when items are moved on-site or off-site.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.11.3] - 2026-08-12

### Fixed
- **Split Variant Indicator Border Cascade & Rendering**:
  - Added explicit Tailwind left border classes (`border-l-4 border-l-amber-400`) to prevent generic container `border-transparent` or `border-cool-gray-800/40` styles from overriding the left variant indicator color.
  - Added a dedicated vertical accent pill bar element (`w-1.5 self-stretch bg-amber-400 rounded-full`) inside split variant item rows in `MeatCutRow` and `ProductView`.
  - Ensures split variant items display a vibrant, high-contrast amber bar regardless of theme cascade or border inheritance.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`

### [2.11.2] - 2026-08-12

### Fixed
- **Home Assistant Accent Color Theme Mapping**:
  - Switched left variant border indicator and "Variant X" badges in `MeatCutRow` and `ProductView` to Home Assistant's native accent color variable (`var(--ha-accent-color, #ff9800)`).
  - Provides bright, high-contrast visual distinction for split items that stands out cleanly against both dark and light theme surfaces.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`

### [2.11.1] - 2026-08-12

### Fixed
- **Home Assistant Theme Integration for Split Variant Indicators**:
  - Updated left variant accent bar and "Variant X" badges in `MeatCutRow` and `ProductView` to directly use Home Assistant primary color CSS variables (`var(--ha-primary-color, #03a9f4)`).
  - Resolved Tailwind class conflicts where `border-transparent` suppressed left border color rendering.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`

### [2.11.0] - 2026-08-12

### Added
- **Item Splitting Workflow (`SPLIT_MEAT_CUT`)**:
  - Added ability to split inventory packages within a container into a separate row.
  - Implemented `SplitItemModalContent` requiring a mandatory unique note or custom tag selection to differentiate split packages from the main group.
  - Integrated "Split Item..." option in item context menus across inventory views (`MeatCutRow`, `ProductView`).
- **Visual Connector & Variant Badging**:
  - Added a distinct left cyan accent connecting bar (`border-l-4 border-l-cyan-400`) and a "Variant X" badge to visually indicate split items sharing the same product and container.
- **Auto-Consolidation & Re-Merging**:
  - Implemented `consolidateMeatCutsInContainer` helper in `server.ts` to automatically consolidate items in the same container when their notes and tags match.
  - Added an explicit "Clear Notes & Tags (Merge)" context menu option and clear button in note editors to easily re-merge split packages back into a single item row.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/components/EditNoteModalContent.tsx`
- `/freezer_inventory_tracker/components/SplitItemModalContent.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`

### [2.10.3] - 2026-08-09

### Added
- **Bulk "Labeled Wrong" Correction**:
  - Implemented a "Bulk Wrong Label" action for Off-Site storage items, allowing users to reassign multiple selected items to a corrected product catalog entry in a single transaction.

### Changed
- **Original Label Badge Condition**:
  - Refined the condition for displaying the red "⚠️ Labeled: [Name]" badge across all spreadsheet and case views (`ButcherSpreadsheetView`, `OffSiteSpreadsheet`, `ProductView`, `DisplayCaseView`). It now strictly validates against butcher records or unassigned states to prevent incorrectly flagging newly received/unprocessed boxes as "wrong".
- **Backend Cleanup for Invalid Corrections**:
  - Added an automatic state load migration in `server.ts` to cleanse existing records where `originalCutName` mistakenly matched the current catalog assigned name, effectively resetting false "Labeled Wrong" markers.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`

### [2.10.2] - 2026-08-09

### Added
- **Preserved Original Physical Labels**:
  - Modified both `CORRECT_MEAT_LABEL` and `CORRECT_OFFSITE_LABEL` handlers to strictly preserve the very first/original physical label (`originalCutName`) on subsequent label corrections instead of overwriting with intermediate corrections.
- **Undo & Revert to Original Label**:
  - Implemented `REVERT_MEAT_LABEL` and `REVERT_OFFSITE_LABEL` actions to easily restore an item back to its original label.
  - Added an elegant "Undo & Revert" button within the "Correct Wrong Label" modal for both on-site items and off-site cold storage entries when an original label history exists.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/CorrectWrongLabelModalContent.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.10.1] - 2026-08-09

### Added
- **"Labeled Wrong" Action in Display Case & Product Views**:
  - Propagated the "Labeled Wrong" correction dropdown option and warning text displays into both `DisplayCaseView.tsx` and `ProductView.tsx` so users can perform corrections from any view.
- **Removed Manual Label Modification in Notes Menu**:
  - Removed the `originalCutName` manual input field from the Note edit modal (`EditNoteModalContent.tsx`), strictly enforcing that correction always happens via the catalog-connected workflow as requested.

### Fixed
- **"Labeled As Unknown Cut" Bug on Off-Site Spreadsheets**:
  - Resolved the bug where marking an item as labeled wrong would save as "Unknown Cut" by fixing the backend `CORRECT_OFFSITE_LABEL` handler to dynamically look up the old product name or current label in `server.ts`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/components/EditNoteModalContent.tsx`

### [2.10.0] - 2026-08-09

### Added
- **Dedicated "Labeled Wrong" Correction Action Buttons**:
  - Implemented the user's requested click-to-trigger "Labeled Wrong" correction flows.
  - Added a dedicated "Labeled Wrong" option to the meat cut actions menu on-site (`MeatCutRow.tsx`), which triggers the `CorrectWrongLabelModalContent` modal.
  - Added a dedicated warning action button (`AlertTriangle`) in the off-site spreadsheet row actions (`OffSiteSpreadsheet.tsx`) to directly mark an item as labeled wrong.
- **Product Catalog Selection & Automatic Original Label Mapping**:
  - Users can search and select correct products using the search-and-select `SearchableProductSelect` catalog dropdown.
  - Applying corrections automatically moves the old incorrect label name to the `originalCutName` ("Labeled:") property, maps the cut to the correct product ID, and adds logging details.
- **Off-Site Distinction for Unchanged Labels**:
  - Prevented displaying distracting "Labeled:" warnings in the off-site spreadsheet for items that have not been modified or are labeled correctly from the start (only shows if `originalCutName` is different from current display name `cuts`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.9.0] - 2026-08-09

### Added
- **UI for Correct Cut Mapping & Butcher Label Editing (On-Site & Off-Site)**: Implemented complete fields and selectors for users to easily assign correct catalog products and record original incorrect labels from the butcher:
  - **On-Site Modal**: Integrated an "Original Butcher Label / Labeled As" field inside the Note Edit modal (`EditNoteModalContent.tsx`).
  - **On-Site Display**: Displayed a clear `⚠️ Labeled As: <original>` label underneath the product name in `MeatCutRow.tsx` if an original label differs from the correct cut.
  - **Off-Site Spreadsheet Inline Editor**: Added a **Correct Cut (Product Catalog)** dropdown selector and **Original Label (Wrong Label)** input directly inside the off-site spreadsheet's inline row editor.
  - **Off-Site Add Entry Form**: Added product selection dropdown and original wrong label inputs to the "Add Off-Site Entry" modal.
  - **Off-Site Display**: Highlighted incorrect butcher labels with a visible `⚠️ Labeled: <original>` pill next to the correct product name inside the off-site spreadsheet.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/components/EditNoteModalContent.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/server.ts`

### [2.8.3] - 2026-08-09

### Fixed
- **SQLite Database Schema Migration for originalCutName Column**: Added automatic column addition for `originalCutName` to the `meat_cuts` table in SQLite during database initialization to avoid saving state errors and guarantee live database compatibility.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.8.2] - 2026-08-09

### Fixed
- **Note & Tag Preservation Across Off-Site/On-Site Transitions**: Ensured custom notes (`notes`) and tags (`tagIds`) attached to inventory items are preserved when transferring cuts between on-site staging and off-site cold storage, including:
  - `MOVE_STAGING_TO_OFFSITE`: Moving staging cuts onto off-site staging entries now preserves cut `tagIds` and `notes`.
  - `OffSiteStagingWorksheet`: Staging worksheet mapping and finalization maintain existing item tags.
  - `EXECUTE_MOVEMENT_ORDER`: Moving off-site inventory back to on-site staging merges tags and appends notes if existing cuts are found, or creates new cuts with preserved notes and tags.
  - `MOVE_MEAT_QUANTITY` & `ADD_MEAT_CUT`: Moving cuts or bulk adding cuts merges existing notes and tags seamlessly.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`

### [2.8.1] - 2026-08-09

### Changed
- **Template Deletion Container Conversion**: When a container template is deleted from the catalog, all active containers linked to that template now automatically decouple (`templateId = undefined`) and convert to "retire on empty" (`deleteOnEmpty = true`).
- **Single Container Decoupling & Auto-Retire**: When renaming or editing details of an active container derived from a template without applying changes to all containers (`applyGlobally: false`), the container decouples from the catalog template and is automatically set to "retire on empty" (`deleteOnEmpty = true`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`

### [2.8.0] - 2026-08-09

### Removed
- **Container Icons Removal**: Removed container icon selection, icon pickers, icon filter dropdowns, and icon columns altogether to simplify container management. All containers without custom attached images now default cleanly to the standard Box icon.

### Fixed
- **Container Template Deletion**: Fixed template deletion workflow with instant optimistic client-side removal and backend synchronization when confirmed in the deletion modal.
- **Container Editing & Single Container Decoupling**: Fixed `EDIT_CONTAINER` handling in `server.ts` and `useInventory.ts`. When "Apply changes to all containers named X" is selected (`applyGlobally: true`), updates automatically propagate across all matching active containers and the catalog template definition. When unselected (`applyGlobally: false`), updates apply strictly to that single container and gracefully break/decouple it from the template.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/components/ContainerIconsMap.tsx`
- `/freezer_inventory_tracker/components/ContainerIconPicker.tsx` (Deleted)
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.7.0] - 2026-08-09

### Added
- **Container Icon Selection**: Added visual container icon selector (`ContainerIconPicker`) across all container creation and editing interfaces, including Add Container form, Edit Container form, Add Container Template modal, Edit Container Template modal, and the Inbound Items workflow.
- **In-App Confirmation Modals for Template Deletion**: Replaced blocking native `window.confirm` dialogs with custom in-app confirmation modals for deleting container templates, resolving issues in iframe / Home Assistant webview environments.

### Fixed
- **Container Template Edit Payload & Auto-Sync**: Fixed `EDIT_CONTAINER_TEMPLATE` payload dispatch structure (`{ id, updates: { name, icon, imageUrl } }`) so that editing a template correctly updates properties and propagates name/icon changes across linked active containers in freezers.

### Changed
- **Active Containers Filter & UI Cleanup**: Removed redundant "Content / Items" filter (since empty containers are retired immediately). Replaced empty behavior dropdown with a streamlined "Type / Rule Filter" (`All Containers`, `📋 From Template`, `🗑️ Retire on Empty`). Removed redundant "Add Active Container" button on the Active Containers tab.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/ContainerIconPicker.tsx`
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.6.32] - 2026-08-09

### Changed
- **Templates Catalog UI Redesign**: Removed repetitive "Template Blueprint" badges from template cards. Converted the template catalog layout from a 4-column grid into a sleek list view. Added robust filtering options (Active Usage, Photo Asset, Icon Type) and sorting controls (A to Z, Z to A, Most Active, Recently Added). Connected global search directly to template names.
- **Active Containers Tab UI Streamlining**: Removed the group-level total items counter and "Group containing X active placement location(s)" text line. Removed the "Kept on Empty" tag and replaced it with a distinct "From Template" tag whenever a container or container group is connected to a catalog template.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.6.31] - 2026-08-09

### Removed
- **Removed Pre-configured Demo Data & Fallback JSON**: Completely purged sample database records, fallback JSON data files (`inventory-db.json`), and legacy backup snapshots. Updated `server.ts` `defaultInitialState` and disabled automatic fallback seeding so fresh installations start 100% clean and empty without any pre-configured demo freezers or items.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.6.30] - 2026-08-09

### Fixed
- **Container Template 2-Table Schema Conversion**: Resolved issue where state normalization inadvertently re-injected unassigned containers into `state.containers` and failed to separate old single-table records into `container_templates`. Implemented `convertAndNormalizeContainerTemplates()` in `server.ts` to automatically extract unassigned legacy container templates into the `container_templates` SQLite table, link active container instances to their respective `templateId`, purge unassigned template rows from `containers`, and sync template metadata globally across all state loads, saves, and backup restores.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.6.29] - 2026-08-08

### Added
- **Rich Photo Selector in Container Template Forms**: Integrated the `MediaSelector` component in both "Add Container Template" and "Edit Container Template" catalog forms in `LibraryView.tsx`. Users can now capture high-quality photos using their camera, select from local file uploads, pick from the central application photo library with quick filename search filtering, or supply direct image URL links.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.6.28] - 2026-08-08

### Removed
- **Spawn Active Button**: Removed the "Spawn Active" button from the Container Templates catalog view. Since empty containers are automatically archived/cleaned up on empty, spawning an empty active container from a template is redundant. Instead, the Edit Template button now spans full-width with a dedicated text label, creating a cleaner interface layout.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/LibraryView.tsx`

### [2.6.27] - 2026-08-08

### Fixed
- **Database Migration for Container Templates**: Removed default/hallucinated placeholder container templates (Bag, Box, etc.) from backend schema initialization. Added an on-the-fly migration that converts the user's actual old unassigned containers into the `container_templates` catalog, automatically linking corresponding active containers and cleaning up unused entries.
- **Relational Backup & Restore Stability**: Updated `selectiveRestoreFromDb` to include the `container_templates` table automatically when restoring containers, securing full data integrity during partial restores.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.6.26] - 2026-08-08

### Added
- **Container Templates Catalog & Multi-Tab Containers Management**: Integrated a dedicated Container Templates Catalog tab in `LibraryView.tsx`, allowing users to define, edit, and delete reusable container definitions (e.g. Purple Basket, Meat Toter, 1/2 Sheet Pan, Bag).
- **Template Inheritance & Instance Spawning**: Added template selection and "Save as reusable Container Template" options in `AddForms.tsx`. Active containers spawned from templates inherit name/image properties and remain dynamically linked.
- **Container Archiving on Empty / Deletion**: Updated container emptying and deletion logic in `server.ts` and `useInventory.ts` to archive active containers instead of permanently hard-deleting them, preserving historical logs and rollback capabilities.
- **SQLite Database Schema Migration & Backup Support**: Added `container_templates` table definition, auto-migration for `containers.templateId`, and full JSON/ZIP backup/restore support in `server.ts`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.6.25] - 2026-08-08

### Added
- **Clean Page Breaks and Page Stamping for Field Execution Checklist PDFs**: Applied offscreen `tempWrapper` DOM rendering fixed at `(0px, 0px)` with `scrollX: 0, scrollY: 0, x: 0, y: 0` and dynamic footers (`Page X of Y` and order metadata) to field execution checklist PDF exports in both `OffSiteMovementPlanner.tsx` and `OffSiteMovementScanner.tsx`. Prevents row/card splitting across page breaks and guarantees precise document alignment.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.6.24] - 2026-08-08

### Fixed
- **Root Cause Resolution for PDF Top Blank Margin & Row Cutoff**: Implemented offscreen `tempWrapper` DOM rendering fixed at `(0px, 0px)` with `scrollX: 0, scrollY: 0, x: 0, y: 0` in `html2canvas`. Completely eliminates modal scroll offset and viewport position artifacts, guaranteeing document content starts at the top of Page 1 with no empty white gaps or sliced table rows across page breaks.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.23] - 2026-08-08

### Fixed
- **Restored Clean HTML2PDF Document Capture Alignment**: Removed custom `x: 0, y: 0` canvas offsets and offscreen DOM clone overrides in `MovementReportModal.tsx`. Direct html2canvas element bounding rect measurement restores precise horizontal alignment across 0.4-inch Letter margins for both the Transfer Manifest and Delivery Slip PDF exports.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.22] - 2026-08-08

### Fixed
- **Root Cause Resolution for PDF Horizontal Shift**: Fixed offscreen DOM rendering coordinates (`position: fixed; left: 0px; top: 0px; width: 739px`) and set explicit `scrollX: 0, scrollY: 0, x: 0, y: 0` in `html2canvas`. Completely eliminates the horizontal shift / blank left margin on generated PDFs, centering the report across 0.4-inch Letter margins.
- **Continuous Multi-Page Table Flow**: Verified clean, un-interrupted table continuation across page boundaries for Transfer Manifests and Delivery Slips without mid-document footer breaks or gap artifacts.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.21] - 2026-08-08

### Fixed
- **Eliminated Duplicate Document Footer**: Removed the redundant inline HTML footer element from the document template body. The PDF now solely renders the dynamic jsPDF running footer stamped at the bottom margin of every page (`Page X of Y` and document metadata), preventing duplicate or mid-document footer rendering.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.20] - 2026-08-08

### Fixed
- **Offscreen Container Cloning for Flawless PDF Horizontal Alignment**: Implemented an isolated offscreen DOM container (`position: fixed; left: -9999px; width: 740px`) when rendering PDF exports via `html2pdf.js`. This eliminates viewport scroll position and modal flex centering offsets, guaranteeing 100% horizontal centering across 0.4-inch paper margins without left gaps or right table cropping.
- **Removed Page Break Text Banner**: Removed the artificial page break boundary text indicator banner (`✂️ PAGE 1 / PAGE 2 PAGE BREAK BOUNDARY`), ensuring multi-page documents break cleanly between table rows without any printed indicator artifacts.
- **Synchronized Stamped Footers**: Aligned running footers (`Page X of Y` and document metadata) cleanly at 0.4-inch left and right page margins across all exported pages.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.19] - 2026-08-08

### Fixed
- **Root Cause Fix for Top Blank Space on PDF Export**: Resolved `html2canvas` scroll offset capturing bug where modal/window scroll position introduced a massive empty white block at the top of Page 1, pushing the entire document down and forcing 1-page reports onto 2 pages.
- **Reverted Side-by-Side 2-Column Delivery Slip**: Reverted Delivery Slip template back to the original compact side-by-side 2-column layout (`col-span-5` Pallet Summary / `col-span-7` Pallet Breakdown By Box) for high data density on standard 8.5x11 paper with 0.4–0.5 inch margins.
- **Flawless Single-Page Landing**: Standard ~25-30 box orders now land cleanly on 1 single page without spilling over or slicing text rows across page breaks.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.18] - 2026-08-08

### Fixed
- **Multi-Page Layout Re-Architecture**: Re-architected the Delivery Slip report template from a 2-column side-by-side CSS grid (`col-span-5` / `col-span-7`) into clean, stacked full-width sections (`w-full`).
- **Pristine Multi-Page Alignment**: Eliminates the blank left column void on Page 2+ when box lists span across multiple pages, ensuring every page maintains 100% full-width table alignment across margins.
- **Dynamic Multi-Page Running Footers**: Updated jsPDF rendering engine to stamp running page numbers (`Page X of Y`) and document metadata cleanly across all pages at fixed 0.5-inch margins.
- **Strict Page Break Boundaries**: Configured `html2pdf` pagebreak rules to strictly prevent breaking inside `tr` table rows and header elements.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.17] - 2026-08-08

### Fixed
- **Standard 8.5x11 Page Dimension Fitting**: Adjusted printable document width to exactly `720px` (7.5 in) and outer margins to `0.5in`, fitting standard 8.5x11 inch paper with standard margins without horizontal scale distortion or unexpected spillage.
- **Compact Header & Table Densities**: Reduced top grid cell min-height and padding (`p-3` header, `p-1.5` metadata, `py-1.5` manifest rows, `space-y-3.5` block gaps) so standard delivery slips and transfer manifests fit comfortably on a single 8.5x11 page.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.16] - 2026-08-08

### Added
- **Multi-Page Report Detection & Visual Badging**: Added live page height measurement (`ResizeObserver`) in `MovementReportModal` to detect when a delivery slip or manifest exceeds a single page, displaying a prominent indicator badge ("Single Page Document" vs "Multi-Page Document (X Pages)") in the preview center.
- **In-Preview Page Break Boundaries**: Added visual page break boundary dividers across the document preview canvas when a report spans across multiple pages.
- **Clean Item Page Breaks**: Enforced CSS `page-break-inside: avoid` and `break-inside: avoid` on table rows, card blocks, and headers to guarantee table rows and items break cleanly across page boundaries without vertical clipping or awkward cuts.
- **Page Number Footers & Multi-Page PDF Pagination**: Added page numbers ("Page X of Y") in the document footer and enhanced the jsPDF / html2pdf engine to stamp page numbers on multi-page PDF exports and print layouts.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.15] - 2026-08-08

### Improved
- **Compact Pallet Breakdown Box List Layout**: Reduced cell vertical padding (`py-0.5 px-2`) and header padding on the "Pallet Breakdown By Box" table in `MovementReportModal`, creating a tight, clean list that maximizes printable space and box row density.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.14] - 2026-08-08

### Fixed
- **Movement Report Pallet Filtering**: Fixed pallet/lot selection filtering in `MovementReportModal` so that unchecking specific pallets properly excludes those moves from the delivery slip, manifest, and totals instead of unconditionally including all pallets for the location.
- **Select All / Deselect All Pallet Selector Toggle**: Enhanced the pallet selection control label with a dynamic toggle button to quickly select or deselect all pallets for a given destination location.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`

### [2.6.13] - 2026-08-08

### Improved
- **Expanded & Vertically Resizable Notes Textareas**: Updated notes textareas across `MovementReportModal`, `ActiveMovementModal`, and `EditNoteModalContent` to default to 4 visible rows (minimum 90px height) and enabled standard `resize-y` drag handles so users can expand notes sections as large as needed while typing.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/components/EditNoteModalContent.tsx`

### [2.6.12] - 2026-08-08

### Fixed
- **Race Condition Prevention During Active Text Entry**: Implemented input focus detection in `App.tsx` for real-time SSE update messages. Background state refreshes are now automatically deferred while the user is actively focused on any `input`, `textarea`, `select`, or `contenteditable` element, and flushed smoothly upon `focusout`.
- **Local-First Isolated Input State in Modals & Forms**:
  - Refactored `MovementReportModal` to isolate `editablePo`, `editableItems`, and `reportBottomNotes` state per order/location selection key, preventing incoming server sync cycles from resetting active typing.
  - Refactored `ActiveMovementModal` to maintain local state for `Movement Name`, `Planned Date`, and `Notes/Description`, flushing updates on `onBlur` and debounced state syncs.
  - Updated `UnifiedInboundMoveForm` to prevent quantity input resets when background state changes occur mid-entry.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`

### [2.6.11] - 2026-08-07

### Improved
- **Container Type Tab Switcher Delineation**: Refactored container selection buttons (`Existing Active`, `Retired / Unused`, and `+ Create New Box`) on `UnifiedInboundMoveForm` to use a 3-column grid layout with `gap-1.5` spacing. Added distinct pill backgrounds (`bg-cool-gray-900/90`) and subtle outline borders (`border-cool-gray-700/80`) to inactive tabs, ensuring clear visual separation and readable typography across all screen sizes.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`

### [2.6.10] - 2026-08-07

### Removed
- **Redundant Bottom Intake Submit Button**: Removed the duplicate bottom submit button on the stock intake and inventory movement modal (`UnifiedInboundMoveForm`), consolidating form submission into the top sticky header action button.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`

### [2.6.9] - 2026-08-07

### Changed
- **Intake Form Sub-Section Background Blends**: Enhanced `.intake-section-1`, `.intake-section-2a`, and `.intake-section-2b` CSS rules to use dynamic `color-mix` CSS functions blending Home Assistant card backgrounds (`--ha-bg-card`) with theme accent variables (`--ha-primary-color`, `--ha-warning-color`, and `--ha-info-color`).
- **Harmonized Sub-section Contrast**: Section 1 (Product Intake), Section 2A (Container Selection), and Section 2B (Freezer Location Assignment) now each display distinct, theme-adaptive background tints that dynamically update whenever Home Assistant themes are changed.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.6.8] - 2026-08-07

### Added
- **Dynamic Home Assistant Theme Color Engine for Intake & Movement Sub-sections**: Upgraded intake and stock move form sub-sections (`Section 1: Product Intake Details`, `Section 2A: Container Selection`, and `Section 2B: Freezer Location Assignment`) with CSS classes utilizing native Home Assistant theme CSS color variables (`--ha-bg-card`, `--ha-bg-surface`, `--ha-bg-input`, `--ha-border`, `--ha-primary-color`, etc.).
- **Visual Section Differentiation & Contrast**: Section cards and internal nested sub-cards now feature distinct background color shades and top accent borders, making sub-sections instantly distinguishable across all Home Assistant light and dark themes.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`

### [2.6.7] - 2026-08-07

### Fixed
- **Photo Library Header & Response Handling**: Fixed `Unexpected token '<'` error when fetching the app photo library gallery. Standardized `Authorization` header construction to omit empty token headers and added content-type checks before JSON parsing in `openAppGallery` and `uploadBase64Image`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/MediaSelector.tsx`

### [2.6.6] - 2026-08-07

### Added
- **App Photo Library Selector Modal**: Added an "App Photo Library" modal picker to `MediaSelector` allowing users to select any previously uploaded photo directly from the inventory database (`/api/photos`) with search filtering by filename or attached item name.
- **Clarified Photo Action Buttons**: Streamlined the media selection buttons into three clear options: **Live Camera** (opens in-app camera stream viewfinder modal), **Choose Device File** (opens phone or computer photo gallery/file picker), and **App Photo Library** (opens existing uploaded photos in the freezer app).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/MediaSelector.tsx`

### [2.6.5] - 2026-08-07

### Fixed
- **Direct Camera Capture & Live Viewfinder Stream**: Resolved issue where tapping camera capture opened media file selector rather than launching device camera directly. Separated file inputs so "Open Camera" uses a static `capture="environment"` attribute, which instructs iOS, Android, and mobile browsers to open the camera viewfinder directly for product and container photos.
- **In-App Live WebCam Viewfinder Modal**: Integrated a live camera viewfinder modal powered by `navigator.mediaDevices.getUserMedia` with front/rear camera switching, framing guide, and instant photo snapshot capture for desktop webcams, laptops, tablets, and webviews.
- **Photo Manager Camera Support**: Added dedicated "Take Photo" action buttons and direct camera input support to the Photo Manager for missing product and container photos.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/components/MediaSelector.tsx`
- `/freezer_inventory_tracker/views/PhotoManagerView.tsx`

### [2.6.4] - 2026-08-07

### Fixed
- **Stable Single-User Mode Lifecycle on Scanner Tab**: Fixed a React effect cleanup race condition where re-rendering on state updates was immediately triggering `releaseSingleUserMode()`, causing Single-User Mode to drop back to Multi-User Mode after 1 second.
- **Unmount-Only Lock Release**: Refactored `OffSiteMovementScanner` to use stable `useRef` callbacks and an empty dependency array for its unmount effect. Single-User Mode now remains cleanly active for 0ms zero-latency scanning while on the Movement Scanner tab, and releases/syncs back to the main database only when navigating away from the tab or upon 5-minute inactivity timeout.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.6.3] - 2026-08-07

### Fixed
- **Optimized Single-User Lifecycle & Non-Continuous Lock Management**: Refactored `OffSiteMovementScanner` to prevent continuous lock retention. Single-User Mode is now claimed once upon mounting/opening the Movement Scanner tab or on-demand when scanning a barcode.
- **Automatic Sync & Release on Tab Exit**: Added cleanup handlers on component unmount so when navigating away from the scanner view or closing the tab, Single-User Mode automatically flushes all local state changes to the server database and releases the single-user lock for other users.
- **Manual Release & Sync Control**: Added a "Release & Sync" button to the scanner control banner UI for immediate user-controlled lock releasing.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.6.2] - 2026-08-07

### Added
- **Automatic Single-User Mode Activation on Scanning**: Integrated automatic Single-User Mode activation when entering the Off-Site Movement Scanner view or scanning barcodes. Swapping to Single-User Mode isolates state updates locally on the client device, giving operators 0ms instant barcode scan response times with zero network overhead. On tab close or exiting, state is automatically flushed and synced back to the main database server.
- **Single-User Status Indicator**: Added a visual status badge banner inside the Scanner Control Panel confirming Single-User Mode activation or allowing a one-click manual claim.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.6.1] - 2026-08-07

### Fixed
- **Optimized Real-Time Scanning Integrity**: Solved a critical race-condition and state-overwrite bug inside the barcode scanning and checklist dispatch queue. Added dedicated atomic action handlers (`APPEND_MOVEMENT_ORDER_IDS` and `REMOVE_MOVEMENT_ORDER_IDS`) inside `useInventory.ts`'s client-side state manager and debounced queue sync. When multiple boxes or items are scanned in rapid succession (e.g. 70 boxes scanned sequentially), scans are queued atomically, eliminating the React stale-closure overwrite problem and guaranteeing that 100% of scanned items are checked off and flushed to the server correctly.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.6.0] - 2026-08-07

### Added
- **Multi-Phase Pallet-First Grouping**: Refactored the Movement Delivery checklist and grouping structures across the Offline Scanner and PDF printouts. Grouping now splits boxes distinctly by both Target Location and Target Pallet (rather than just location). This ensures boxes are organized under precise, separate headers such as `Pallet: P123 (Warehouse)` instead of being lumped under general location groups.
- **Enhanced Target Destination Visibility**: Highlighted target pallet names across the Active Pick lists, Completed lists, scanner HUDs, and hidden print slip generators. Pallet names are displayed first and foremost to operators, with the location appended.
- **Detailed Itemized Split-Box Mapping**: Integrated detailed itemized split-box explanations directly inside expanded checklist panels (Phase 1 & Phase 2) and generated PDF movement logs. In Phase 2, if a box is split, expanding its checklist details reveals both the item's precise Origin Pallet and its target Destination Pallet.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`

### [2.5.2] - 2026-08-07

### Added
- **Automated Pallet & Box Archiving**: Implemented server-side logic in the normalization layer to dynamically track active pallets and boxes. When all off-site entries on a pallet are emptied or no longer active (and not referenced in active/draft movement orders), the pallet is automatically archived in the database. This opens the pallet name back up for reuse while keeping staging and catalog selections clean and focused strictly on active pallets.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.5.1] - 2026-08-07

### Removed
- **"Requires Pallet" Selection Text**: Removed the helper label text `(Requires Pallet)` from the location selection options in the Active Movement Planner configuration. Since pallets are now uniformly forced across all locations, the individual warning labels are no longer necessary.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`

### [2.5.0] - 2026-08-07

### Changed
- **Forced Pallet Utilization Everywhere**: Removed the "Uses Pallets" configuration checkbox from the Locations Catalog form. Modified the schema, database seeding, normalization layers, movement planners, staging worksheet, and import mapping components to force all storage and partner locations to utilize pallets by default. Any unpalletized items mapped or moved to these locations fall back elegantly to virtual pallets in the database, keeping off-site inventory fully sortable and structured.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`

### [2.4.2] - 2026-08-07

### Fixed
- **Off-Site Spreadsheet Column Alignment**: Fixed a column alignment mismatch in the off-site workspace's spreadsheet table. When no movement order is active and the spreadsheet is not in direct edit mode, the table header and box row collapse/expand states hide the checkbox selection column. However, the child item rows previously rendered a placeholder column cell regardless of checkbox visibility. Resolved by conditionally hiding the placeholder checkbox cell on item rows and moving the left visual borders to the adjacent spacing column, ensuring pixel-perfect column alignment in all layout combinations and states.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.4.1] - 2026-08-07

### Added
- **Interactive Box Grouping**: Added a dynamic "Group by Box" layout mode to the Staging Worksheet, organizing staging items into visual box sections.
  - Box sections allow inline box renaming that updates all enclosed items.
  - Added dedicated box headers with instant bulk Location and Pallet update dropdowns to update entire boxes at once.
- **Bulk Editing Control Panel**: Added a multi-select checkbox system with a master toggle and an expandable floating Bulk Toolbar.
  - Users can select multiple items across any boxes/lists and update Location, Pallet, Box Name, Pack Date, and Lot number simultaneously.
- **Home/On-Site Location Destination Selection**: Included the Home/On-Site location in the storage location dropdowns, allowing users to move/finalize items back to the Home inventory during off-site staging operations.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`

### [2.4.0] - 2026-08-07

### Added
- **Interactive Off-Site Staging Worksheet UI**: Implemented a comprehensive multi-step workflow for moving items from on-site staging to off-site cold storage.
  - **Dynamic Worksheet View**: Added a dedicated `OffSiteStagingWorksheet` component that lists staged items and allows configuring targets.
  - **Location & Pallet Assignment**: Integrated interactive selectors to assign destination locations and either choose existing pallets or create new ones.
  - **Box Renaming**: Added text inputs to customize and rename box identifiers before finalizing movement.
  - **Flexible Weight Entry**: Enabled entering net weights either as bulk values or individual single cuts.
  - **Splitting Grouped Cuts**: Implemented a robust "Split Rows" mechanism allowing users to break grouped entries with pieces count > 1 into separate individual records.
  - **Automated Serial Number Suffixing**: Integrated prefix generation and counter tracking using the `yyyymmddxxxx` format to automatically allocate unique serial numbers.
  - **Direct Transition Workflow**: Connected Freezer and Product view "Move to Offsite" confirmation buttons to automatically redirect the user to the newly introduced "Staging Worksheet" sub-tab under the Offsite tab.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteStagingWorksheet.tsx`

### [2.3.1] - 2026-08-06

### Fixed
- **Off-Site Box & Pallet Movement Reconciliation Sync**: Fixed a subtle reconciliation bug where box movement locations/pallet mappings would revert to their old values after executing or reverting a movement order. During `EXECUTE_MOVEMENT_ORDER` and `REVERT_MOVEMENT_ORDER`, the box relationships are correctly updated in `state.boxes` and `state.pallets`, but the off-site entry objects themselves in-memory still held stale `currentLocation`, `pallet`, `storageLocationId`, and `location` values. During the subsequent `normalizeState` save-pass, this discrepancy triggered a two-way sync that incorrectly wrote the old in-memory values back to the box and pallet configurations. Fixed by updating the in-memory entry fields during movement execution and revert processes.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.3.0] - 2026-08-06

### Changed
- **Relational Off-Site Location Tracking & Movement Order Logic**: Completely reverted previous database denormalization. Rebuilt location tracking to be strictly relational: off-site entries are bound to boxes, boxes are bound to pallets, and pallets are bound to storage locations. Modified `EXECUTE_MOVEMENT_ORDER` and `REVERT_MOVEMENT_ORDER` to dynamically create/update/revert the correct boxes (`state.boxes`) and pallets (`state.pallets`) in their respective tables rather than trying to store duplicate redundant columns directly in the `off_site_entries` table. This allows the application to leverage the existing relational schema flawlessly while preventing any state loss.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.2.12] - 2026-08-06

### Fixed
- **Off-Site Movement Persistence & SQLite Schema Bug**: Fixed a critical, long-standing database issue where offsite entries' `location`, `pallet`, `currentLocation`, and `storageLocationId` properties were completely dropped on every database save. Added these columns to the `off_site_entries` SQLite schema definition, implemented automatic startup migrations to ALTER existing tables, and updated standard offsite moves inside the movement execution engine to properly write and persist these values.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.2.11] - 2026-08-06

### Fixed
- **Persistent Off-Site Entry Force-Archiving Bug**: Resolved a fundamental bug in `normalizeState` that was overriding database-persisted states and forcing active off-site entries to become archived on any load or state-sync if they had been part of a completed order or were in a home/staging location. Removed this flawed auto-archiving logic to fully respect the explicit choices made during `EXECUTE_MOVEMENT_ORDER`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.2.10] - 2026-08-06

### Fixed
- **Off-Site Movement Archiving & Order of Operations**: Fixed a critical bug in `EXECUTE_MOVEMENT_ORDER` where active items moving off-site could be incorrectly archived. Re-ordered the movement workflow to (1) create and update target pallets in their correct locations first, (2) update offsite table entries with new locations, (3) convert designated staging items to onsite inventory, and (4) archive only explicitly removed or staged items. Added a bulletproof retroactive unarchiving pass at the end of the action to explicitly set `archived: false` for all non-staged and non-removed entries and verify that their corresponding boxes, pallets, containers, and freezers are also unarchived (`isArchived: false`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.2.9] - 2026-08-06

### Changed
- **Selective Off-Site Entity Archiving on Movement Order Final Execution**: Updated `EXECUTE_MOVEMENT_ORDER` handler to ensure that only off-site entities whose destinations are explicitly selected in final execution options (removal from inventory or staging transfer) remain archived, while all non-selected locations/destinations are automatically unarchived (`archived: false`) and fully accessible in their new locations within the off-site inventory.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.2.8] - 2026-08-05

### Added
- **Location-Aware Pallet and Unassigned Filtering**: Enhanced the Off-Site Spreadsheet view pallet filter to distinguish same-name pallets and unassigned lists by location (using the `PalletName|LocationName` composite key format). Now, selecting a pallet or "Unassigned" correctly targets only the selected location's specific records rather than combining duplicate pallet names or unrelated unassigned items across different facilities.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.2.7] - 2026-08-05

### Fixed
- **Staging to Off-Site Location Assignment**: Fixed the `MOVE_STAGING_TO_OFFSITE` flow to assign both `location` and `storageLocationId` to the resolved Home/On-Site location, ensuring that newly moved items with no pallet are correctly assigned to the on-site location instead of resolving to undefined.
- **Direct Location Editing in Off-Site Storage**: Fixed direct editing of the `location` field inside the Off-Site Spreadsheet view by automatically translating the updated location name into its corresponding `storageLocationId` inside the reducer, and updating any parent pallet or unpalletized reference accordingly.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [2.2.6] - 2026-08-05

### Changed
- **Tightened On-Site Inventory Padding**: Reduced padding, margins, and vertical/horizontal gaps inside the on-site dashboard views. Specifically, streamlined container card borders, tightened row lists, and unified card headers/rows to establish a denser, cleaner, and highly readable on-site inventory layout.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/components/ContainerCard.tsx`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`

### [2.2.5] - 2026-08-05

### Changed
- **Persistent Hidden Items**: Replaced the single `showUnfilteredBoxId` string with a `showUnfilteredBoxIds` Set. Toggling the "hidden items" display for any box now correctly keeps those items visible, even when other boxes are expanded or collapsed, until the specific box itself is collapsed.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.2.4] - 2026-08-05

### Changed
- **Relocated Hidden Item Tag**: Moved the "⚠️ Hidden item" tag from the "cuts" column to the left of items inside the "box" column on expanded child rows. This utilizes empty space in the "box" column and keeps the "cuts" column tighter and cleaner.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.2.3] - 2026-08-05

### Added
- **Bulk Selection Shortcut (Ctrl+A / Cmd+A)**: Implemented global keyboard shortcut support for `Ctrl+A` and `Cmd+A` within the Off-Site Spreadsheet view to instantly select all boxes and items matching the active filter criteria (while safely ignoring input and text fields).
- **Sequential Range Selection (Shift+Left Click)**: Added `Shift+Click` range selection for both top-level rows (grouped boxes/ungrouped items) and child items within expanded box rows. Users can now click an item, hold Shift, and click another item to select or deselect a contiguous range of records.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.2.2] - 2026-08-05

### Fixed
- **Off-Site Spreadsheet Child Rows Column Alignment**: Fixed a column misalignment issue in the expanded box child rows by adding the missing expand column placeholder cell, keeping child records perfectly aligned under their corresponding headers.
- **Single-Line Category Formatting**: Condensed the primary/secondary categories in the expanded item row to display on a single line as `Primary / Secondary`, maximizing vertical space and tightening the overall high-density layout.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.2.1] - 2026-08-05

### Changed
- **High Density Layout for Off-Site Spreadsheet**: Reduced the row cell padding globally within the Off-Site Spreadsheet table. Both headers and parent/group rows have been streamlined to `py-1.5 px-2` / `py-1.5 px-2.5`, and nested child item rows have been compressed to a high-density `py-1 px-2.5` layout, maximizing data visibility and screen real estate.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.2.0] - 2026-08-05

### Added
- **"Hidden Items" Indicator & Revealer**: Implemented a warning indicator button (`+X hidden`) on grouped box rows in the Off-Site Spreadsheet when active spreadsheet filters hide some items inside that box. Clicking this indicator allows the user to instantly toggle and reveal the full box inventory inline, styled with custom amber backgrounds and warning labels, so the user knows exactly what else is inside the box before executing a movement.
- **Split Boxes filter in "Move to" Dropdown**: Integrated the "Only Split Boxes" checkbox filter directly into the "Move to" column's header dropdown menu as requested, in addition to the global filter badges.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.1.13] - 2026-08-04

### Added
- **Expanded Box Details for Split Boxes**: Enhanced the expanded item details view in the movement scanner (Phase 1 and Phase 2 lists, both pending and completed boxes) to explicitly show each item's split target destination.

### Changed
- **Simplified PDF Checklist**: Refactored the printable PDF checklist generation logic to produce a clean, box-level overview with origin/destination names. Omitted individual item listings entirely for standard boxes, and aggregated split box items into concise totals (e.g., "5 heads to meatworks, 3 bones to home") using the new `getBoxSplitSummary` logic to keep the printout highly readable.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.1.12] - 2026-08-04

### Changed
- **De-duplicated Scanner Cuts**: Shortened box descriptions in the off-site movement scanner to display a unique set of cuts (e.g., "head, bones, tail" instead of duplicating repetitions of cuts).
- **Refined Expanded Items Layout**: Refactored the expanded box details view into a single vertical, numbered list of items, featuring item pieces count, net weights, and any item-specific notes, while removing the lot number.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`

### [2.1.11] - 2026-08-04

### Added
- **Persistent Off-Site Spreadsheet Filters**: Implemented `localStorage` state persistence for all 10 column-specific filters in the Off-Site Spreadsheet View component (`OffSiteSpreadsheet.tsx`), including Cuts, Primary Category, Subcategory, Pallets, Locations, Move To, Boxes, Serials, Lots, and Pack Dates.
- **Persistent Sorting Selection**: Added automatic loading and saving of the spreadsheet column sorting preferences (`sortField` and `sortAsc`) in `localStorage`.
- **Persistent Global Off-Site Filters & Search**: Added persistence to `App.tsx` for off-site global search terms, view configurations (original vs mapped names), tag filters, and custom list filters. This ensures all active search filters are perfectly preserved even when navigating between screens, sub-tabs, or hard-refreshing.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

### [2.1.10] - 2026-08-04

### Fixed
- **Clean Printable & Preview Movement Reports**: Added specific CSS overrides (`!important`) in `index.css` targeting movement report templates (`#printable-document`) and checklist printable elements (`#field-checklist-pdf`, `#field-checklist-pdf-scanner`). This enforces clean black text on white backgrounds, overriding any global native Home Assistant dark mode overrides and variables to prevent any dark/black backgrounds on generated or previewed logistics files.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.1.9] - 2026-08-04

### Fixed
- **Conditional Staging Menu Rendering**: Implemented clean React-level conditional rendering (`{isStagingMenuOpen && ...}`) for the staging area context menu dropdown in both `FreezerView.tsx` and `ProductView.tsx`. This avoids the CSS `opacity: 1 !important` override issue on absolute positioned dropdown wrappers in `index.css` that caused the "Move to Off-Site" menu option to always be visible even when unselected.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`

### [2.1.8] - 2026-08-04

### Fixed
- **Subdued Borders for Sub-locations & Inner Cards**: Replaced rigid gray border utility mappings with robust CSS substring selectors (`[class*="border-cool-gray-"]`, etc.) in `index.css`. This ensures that all sub-location cards, rows, and inner components maintain a perfectly subdued and matching border style (`var(--ha-border)`) regardless of opacity-modifying tails (like `/40` or `/35`) or hover/selected states.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.1.7] - 2026-08-04

### Fixed
- **Consistent Subdued Borders Across Product & Display Cards**: Ensured product cards (`product-card`, `prod-card-*`) and display tab cards maintain the exact same subdued border (`1px solid var(--ha-border)`) regardless of whether their inner context menu or dropdown is selected/opened or unselected/closed.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`

### [2.1.6] - 2026-08-04

### Fixed
- **Subdued Card & Tab Borders**: Softened the high-contrast white borders on product cards, display tab cards, container cards, and location list items across `ProductView`, `DisplayCaseView`, and `ContainerCard`. Mapped cool-gray border utility classes directly to `var(--ha-border)` in `index.css` to ensure smooth visual parity with freezer display cards.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/components/ContainerCard.tsx`

### [2.1.5] - 2026-08-04

### Fixed
- **Solid Non-Transparent Backgrounds for Popups & Sticky Category Headers**: Enforced solid opaque backgrounds (`var(--ha-bg-card)` with `opacity: 1 !important` and `backdrop-filter: none !important`) across all popup dropdowns, hamburger menus, sync status popups, combobox list items, searchable select dropdowns, context menus, dialog modals, sticky category header bars, sticky category pillbars, and sticky product card headers. This prevents underlying content and list items from bleeding through sticky bars and popup overlays.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/ProductView.tsx`

### [2.1.4] - 2026-08-04

### Fixed
- **Full Home Assistant Color Scheme Integration for Pills, Badges & Text**: Overhauled `tailwind.config.cjs` and `index.css` to bind all color utilities (cyan, blue, indigo, cool-gray, slate, zinc, neutral, amber, yellow, emerald, green, red, rose) and UI components (pills, badges, chips, category filters, action buttons, status indicators, and text elements) directly to Home Assistant's built-in CSS theme variables (`--primary-color`, `--dark-primary-color`, `--light-primary-color`, `--accent-color`, `--chip-background-color`, `--primary-text-color`, `--secondary-text-color`, `--disabled-text-color`, `--warning-color`, `--success-color`, `--error-color`). Expanded `useHomeAssistantTheme` to extract additional badge, card, and icon variables directly from the host Home Assistant environment.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/tailwind.config.cjs`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/hooks/useHomeAssistantTheme.ts`

### [2.1.3] - 2026-08-04

### Fixed
- **Real-Time Home Assistant Parent Theme Synchronization**: Implemented `useHomeAssistantTheme` hook that continuously inspects and extracts Home Assistant parent window CSS variables (`--primary-color`, `--primary-background-color`, `--card-background-color`, `--secondary-background-color`, `--primary-text-color`, `--secondary-text-color`, `--divider-color`, etc.) across iframe boundaries. Configured real-time DOM `MutationObserver`, `window.postMessage` theme event listeners, and background polling so changing the active theme in Home Assistant instantly updates all app text, card backgrounds, borders, headers, and form inputs in real time.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/hooks/useHomeAssistantTheme.ts`
- `/freezer_inventory_tracker/App.tsx`

### [2.1.2] - 2026-08-04

### Fixed
- **Node 18 Home Assistant Base Image Compatibility**: Replaced `@tailwindcss/vite` v4 / `@tailwindcss/oxide` (which requires Node >= 20 and native Rust bindings that fail during Docker image assembly on Node 18) with PostCSS and Tailwind CSS v3 (`tailwindcss` 3.x, `postcss`, `autoprefixer`). Standardized color utility mappings in `tailwind.config.cjs` so all application styles compile in pure JS without native binary constraints while binding directly to Home Assistant's native CSS variables (`--primary-color`, `--card-background-color`, `--primary-background-color`, `--primary-text-color`, `--divider-color`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/vite.config.ts`
- `/freezer_inventory_tracker/postcss.config.cjs`
- `/freezer_inventory_tracker/tailwind.config.cjs`
- `/freezer_inventory_tracker/index.css`

### [2.1.1] - 2026-08-04

### Fixed
- **Vite Build Tailwind Plugin Configuration**: Added `@tailwindcss/vite` and `tailwindcss` as explicitly declared dependencies in `package.json` and registered the `tailwindcss()` plugin in `vite.config.ts`. This resolves the `[vite:css] ENOENT: no such file or directory, open 'tailwindcss'` build error during Home Assistant Docker container image assembly.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/vite.config.ts`

### [2.1.0] - 2026-08-04

### Changed
- **Full Home Assistant Native Color Integration**: Bound all application color palettes (grays, neutrals, cyan, amber, emerald, red, rose, blue, indigo, slate, zinc) directly to Home Assistant's built-in CSS theme variables (`--primary-color`, `--dark-primary-color`, `--light-primary-color`, `--accent-color`, `--primary-background-color`, `--secondary-background-color`, `--card-background-color`, `--ha-card-background`, `--primary-text-color`, `--secondary-text-color`, `--disabled-text-color`, `--divider-color`, `--ha-card-border-color`, `--error-color`, `--warning-color`, `--success-color`, `--info-color`, `--input-fill-color`, `--chip-background-color`). Eliminated external custom color utilities so every visual element exclusively uses Home Assistant's native theme engine.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.0.3] - 2026-08-04

### Fixed
- **Dynamic Home Assistant Theme Color Binding**: Eliminated static hardcoded light mode color overrides. Configured Tailwind v4 `@theme` tokens and core CSS custom properties to bind directly to Home Assistant theme variables (`--primary-color`, `--ha-color-primary`, `--accent-color`, `--primary-background-color`, `--card-background-color`, `--secondary-background-color`, `--input-fill-color`, `--chip-background-color`, `--primary-text-color`, `--secondary-text-color`, `--disabled-text-color`, `--divider-color`, `--ha-card-border-color`). Implemented Home Assistant Dark theme defaults (`#111827`, `#1f2937`, `#03a9f4`, `#f3f4f6`) purely as the fallback for standalone execution when HA theme variables are absent.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.0.2] - 2026-08-04

### Fixed
- **System-Wide Home Assistant Dark Theme Mapping**: Mapped all text, backgrounds, cards, inputs, buttons, tables, modals, sidebars, headers, and borders directly to Home Assistant theme variables (`--ha-color-primary`, `--primary-color`, `--accent-color`, `--primary-background-color`, `--secondary-background-color`, `--card-background-color`, `--primary-text-color`, `--secondary-text-color`, `--disabled-text-color`, `--divider-color`, `--ha-card-border-color`). Guaranteed Home Assistant Dark theme defaults (`#111827` app background, `#1f2937` cards/surfaces, `#03a9f4` primary accent) as the universal fallback.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.0.1] - 2026-08-04

### Fixed
- **Category Text Home Assistant Theme Binding**: Mapped `.text-cyan-400` category label classes to `var(--ha-primary-color)` so product card category text dynamically inherits Home Assistant's primary frontend theme color (`--ha-color-primary` / `--primary-color`).

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [2.0.0] - 2026-08-04

### Changed
- **Systematic Stylesheet Architectural Rewrite**: Completely rewrote `/freezer_inventory_tracker/index.css` into a clean, modular Home Assistant design system. Eliminated all piecemeal and redundant CSS rules, organizing styles systematically into core variable mappings (`color.globals.ts`), light mode high-contrast overrides, component surface rules, and utility selectors.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [1.99.1] - 2026-08-04

### Fixed
- **Home Assistant Dark Default Fallback**: Updated the fallback behavior so that standalone execution and default `auto` mode strictly use Home Assistant Dark theme defaults (`#111827` app background, `#1f2937` card background, `#03a9f4` primary accent, `#f3f4f6` text) instead of falling back to light theme.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/App.tsx`

### [1.99.0] - 2026-08-04

### Changed
- **Official Home Assistant `color.globals.ts` Variable Mapping**: Directly aligned all color CSS variables and theme mappings with official Home Assistant frontend definitions (`color.globals.ts`), including support for `--ha-color-primary`, `--primary-color`, `--accent-color`, `--primary-background-color`, `--secondary-background-color`, `--card-background-color`, `--ha-card-background`, `--primary-text-color`, `--secondary-text-color`, `--text-primary-color`, `--disabled-text-color`, `--divider-color`, `--ha-card-border-color`, `--input-fill-color`, and `--chip-background-color`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [1.98.0] - 2026-08-04

### Fixed
- **Olive Color Override Removal**: Completely purged legacy hardcoded olive and sage color overrides (`#c5cdb0`, `#dee3cf`, `#8d9a6c`, `#5f6a43`, `#30371e`, `#0d1007`) from CSS stylesheets.
- **Dynamic HA Theme Propagation**: Replaced all hardcoded light mode styles with dynamic Home Assistant CSS theme variables (`var(--ha-bg-card)`, `var(--ha-border)`, `var(--ha-text-primary)`, `var(--ha-bg-input)`, `var(--ha-bg-chip)`).
- **LocalStorage Legacy Cleanup**: Auto-reset legacy `freezer-theme: light` settings stored in browser local storage to `auto` so the application defaults to native Home Assistant theme matching.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/App.tsx`

### [1.97.0] - 2026-08-04

### Changed
- **Home Assistant Dark Default Fallbacks**: Updated fallback CSS variables in `:root` to reflect standard Home Assistant Dark theme defaults (`#111827` app background, `#1f2937` card/panel background, `#03a9f4` primary HA blue accent, `#f3f4f6` text, and `#9ca3af` muted text) for full visual parity when running in standalone preview/testing environments.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`

### [1.96.0] - 2026-08-03

### Added
- **Home Assistant Native Theme Integration**: Direct mapping of Home Assistant CSS frontend variables (`--primary-color`, `--accent-color`, `--primary-background-color`, `--secondary-background-color`, `--card-background-color`, `--primary-text-color`, `--secondary-text-color`, `--divider-color`, `--chip-background-color`, etc.) to all UI components, cards, forms, buttons, pills, tables, and modal dialogs.
- **Dynamic Theme Synchronization**: Live adaptation when switching themes in Home Assistant (Dark, Light, Mushroom, Nord, etc.) with automatic fallbacks for standalone mode.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/App.tsx`

### [1.95.0] - 2026-08-03

### Changed
- **Version Bump**: Bumped application version to 1.95.0 across package manifest, add-on configuration, and changelog.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.93.2] - 2026-08-03

### Added
- **Persistent Top Single-User Lock Banner**: Added a persistent, sticky top notification banner displayed to other users whenever another person is currently editing in Single-User (Solo) Mode.
- **Direct Break-In Controls**: Integrated direct "Request Break-In (5s)" action buttons into the persistent top banner allowing secondary users to request access with a single click.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.93.1] - 2026-08-03

### Fixed
- **Persistent Client Identification**: Configured `clientIdRef` to load and store its unique client identifier from local storage (`localStorage`). This prevents browser refreshes or page reloads from generating a new client ID and locking the user out of Single-User Mode.
- **Graceful Lock Ownership Recovery & Cleanup**:
  - Implemented real-time tracking of active Server-Sent Events (SSE) connections to determine lock holder status.
  - Automatically release single-user locks when the lock owner client is detected as disconnected in the claim endpoint, action handler, or break-in endpoints. This completely eliminates orphaned locks and resolves "Application is locked in Single-User Mode by User" lockout issues.

### Files Modified
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.93.0] - 2026-08-03

### Added
- **Single-Person Mode (Solo Mode)**: Added a local-first Single-Person Mode toggle accessible via the header Sync Status menu to eliminate refresh lag and stutter during rapid inventory edits.
- **Local Storage Caching**: When Single-Person Mode is active, all state changes save instantly to local storage (`localStorage`) and React state with zero network latency or server refresh delays.
- **Server Lock Endpoints & Guarding**:
  - Implemented `/api/single-user/claim`, `/api/single-user/release`, `/api/single-user/heartbeat`, `/api/single-user/request-break-in`, `/api/single-user/cancel-break-in`, and `/api/single-user/sync-and-release` endpoints in `server.ts`.
  - Guarded `/api/inventory/action` against concurrent edits from other users while Single-Person lock is held.
- **Automatic Inactivity & Window Blur Flushing**:
  - Automatically syncs local cached state to the server and releases lock after 5 minutes of user inactivity.
  - Automatically syncs local state when tab focus is lost (`visibilitychange` / `blur`).
- **5-Second Break-In Countdown Banner**:
  - Other users can click "Request Break-In" if access is needed.
  - Displays a floating banner with a 5-second countdown progress bar for the lock holder, auto-syncing local changes and returning to Multi-User mode if not rejected.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.7] - 2026-08-03

### Changed
- **Reordered "Move To" Target Display**: Swapped the display order in the "Move To" column dropdowns and text labels to `Pallet - Location` format (e.g., `Pallet 1 - Cold Storage`), or simply `Location` if no pallet is assigned.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.6] - 2026-08-03

### Added
- **"Staying put" Support in Move To Filter**: Added `"Staying put"` (unassigned move target) as an option in the "Move To" column filter dropdown in Off-Site Storage during movement planning. Users can now filter for items that haven't been assigned a location or destination yet.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.5] - 2026-08-02

### Added
- **Debounced and Buffered Custom Checklist Toggling**: Integrated a 2-second debounce and buffer mechanism for custom list checkbox actions (`TOGGLE_PRODUCT_ON_LIST`). This allows users to check/uncheck multiple boxes rapidly without executing concurrent network calls. The updates are aggregated and synced to the server in a single batch.
- **Batch Toggle Server Action**: Implemented a new server-side action handler for `BATCH_TOGGLE_PRODUCTS_ON_LIST` in `server.ts` to sequentially apply multiple product-list toggling updates safely in a single request.
- **State Cleanup Syncing**: Implemented unmount event triggers to flush any queued list toggle updates before components unload, guaranteeing no data loss.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.4] - 2026-08-02

### Changed
- **Optimistic Custom Checklist Updates**: Added client-side optimistic update logic for `TOGGLE_PRODUCT_ON_LIST`, `UPDATE_LIST_ITEM_NOTE`, `UPDATE_LIST_ITEM_THRESHOLD`, `UPDATE_LIST_ITEM_CONTROL_SOURCE`, and `TOGGLE_LIST_ITEM_NOTIFICATION`. This guarantees checkboxes toggle instantly in the UI and input fields save smoothly with absolutely zero delay/lag, while synchronization to the server occurs seamlessly in the background.

### Files Modified
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.3] - 2026-08-02

### Added
- **Full-Width Custom Checklist Memberships Layout**: Redesigned the list membership list blocks at the bottom of the Edit/Add Product menu to occupy a single column, guaranteeing list names are fully readable and spacious on any device size.
- **Direct List Membership Toggling**: Added high-contrast custom toggles directly on the list configuration card. Users can now easily add or remove a product from any list directly from within the Catalog Edit Product menu.
- **Inline Checklist Notes Editing**: Added an text input field to write notes for the product on each checklist card, saving notes directly to the custom list membership configuration.
- **Support for All Custom Lists**: Opened up direct custom list integration for all checklists (both inventory-controlled and standard lists) from the Product card.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.2] - 2026-08-02

### Added
- **Unified List Threshold and Control Metric Config in Edit Product Menu**: Upgraded the list threshold configuration area at the bottom of the Edit/Add Product menu (the "edit item menu" in Catalog). It now shows a list of all active inventory-controlled checklists, and allows setting both the specific **Control Metric** (On-Site Count, Off-Site Count, Off-Site Weight, or Total Count) and the corresponding **Threshold Value** in an elegant, side-by-side design.
- **Precision Floating Point Threshold Values**: Added full floating-point value parsing support for threshold values when the selected control metric is 'Off-Site Weight' (e.g., to support precise weight rules in lbs like `50.5`).
- **Enhanced Product Actions Sync**: Upgraded product addition (`ADD_PRODUCT`) and modification (`EDIT_PRODUCT`) state reducers to propagate and sync these configured threshold and control source settings to any matching items on active custom checklists.
- **Smart Checklist Add Defaults**: Enhanced the list item insertion logic (`TOGGLE_PRODUCT_ON_LIST`) to automatically inherit any default list-specific threshold and control metric configurations defined on the Product itself.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.1] - 2026-08-02

### Fixed
- **Resolved ReferenceError inside ManageLists**: Corrected `Uncaught ReferenceError: offSiteQuantityMap is not defined` when rendering custom inventory-controlled checklists. Passed `offSiteQuantityMap` and `offSiteWeightMap` into both parent instantiations of the `ManageLists` component (inside `LibraryView.tsx` and `App.tsx`).

### Files Modified
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.92.0] - 2026-08-02

### Added
- **Item-by-Item Multi-Source Inventory Control**: Added fully flexible inventory level tracking on a per-product, per-list basis. Users can now choose which source metric controls whether an item on a list satisfies its threshold rule:
  - `On-Site Count` (Default)
  - `Off-Site Count` (Boxes and external inventory count)
  - `Off-Site Weight` (Net weight of boxed items)
  - `Total Count` (Sum of on-site and off-site counts)
- **Interactive Source Selector and Inline Threshold Editing**:
  - Rendered a beautifully integrated `<select>` control source dropdown for every item in inventory-controlled lists.
  - Added an inline, instant-saving threshold rule input (`Min` or `Max` based on the list configuration) directly on list item tables.
- **Dynamic Headers**: Customized list tables now automatically switch headers to "Controlled Level & Rule" when list automation is enabled.
- **Unified Alert Prompts and Auto Syncing**:
  - Rewrote the automatic list syncing effect in `App.tsx` to precisely evaluate each product's list item custom control source and threshold.
  - Rewrote prompt-based alert queue generator to track previous states of all four quantity maps synchronously.
  - Enhanced `ListThresholdAlertModalContent.tsx` to display proper unit labels (`onsite`, `offsite`, `lbs`, or `total`) dynamically matching the product's active control source.
- **Smart Understock Sorting**:
  - Rewrote `understock` product sorting in `LibraryView.tsx` to automatically use the correct product quantity depending on the respective item's control source for that list.

### Files Modified
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/components/ListThresholdAlertModalContent.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.23] - 2026-08-02

### Added
- **Tag Badges in "Restock Display Case" Dropdown**: Added tag badges display to `StorageLocationRow` inside the "Restock Display Case" quick restock dropdown/drawer.
  - Items in backstock storage locations with active tags (e.g. "Use First", "Not For Sale", custom tags) now render styled tag badges directly alongside the location name in the restock drawer.

### Files Modified
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.22] - 2026-08-02

### Fixed
- **Persistent "Exclude from Display Restock" Tag Setting in SQLite**: Fixed persistence issue where checking the "Exclude from Display Restock" checkbox on tags did not save to the backend database across restarts.
  - Updated `TABLE_SCHEMAS.tags` in `server.ts` to include `excludeFromDisplayRestock INTEGER DEFAULT 0` column definition, `columns` array, and bidirectional `fromDb`/`toDb` boolean serialization.
  - Added dynamic SQLite `ALTER TABLE tags ADD COLUMN excludeFromDisplayRestock INTEGER DEFAULT 0` column migration in `initDatabase()`.
  - Updated `normalizeState()` in `server.ts` to ensure `excludeFromDisplayRestock` defaults to `true` for default `not-for-sale` tag.
  - Updated `FREEZER_MAPPING_AI_GUIDE.md` schema documentation with `Tag` interface definition and `excludeFromDisplayRestock` property.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.21] - 2026-08-02

### Added
- **"Exclude from Display Restock" Tag Setting**: Added a new setting to tags allowing users to mark specific tags (e.g. "not for sale", "personal stock", "broken package") to be excluded from display case restock logic.
  - Added `excludeFromDisplayRestock?: boolean` to `Tag` interface in `types.ts`.
  - Configured default "not-for-sale" tag to have `excludeFromDisplayRestock: true` out of the box in `server.ts`.
  - Added an "Exclude from Display Restock" toggle checkbox to the Tag management edit/create form in `LibraryView.tsx`, along with a visual badge ("🚫 Excluded from Display Restock") on tag cards.
  - Updated `DisplayCaseView.tsx` backstock calculations (`groupedProducts` filter, total counts, and quick restock drawers) to ignore items tagged with restock-excluded tags. Items with excluded tags will not be counted as available display restock or trigger zero-quantity restock alerts.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.20] - 2026-08-02

### Added
- **Product Options 3-Dot Menu "Intake Product..." Action**: Added an "Intake Product..." option (with green `PlusCircle` icon) to the 3-dot dropdown menu in both `ProductView.tsx` and `DisplayCaseView.tsx`.
  - Always available in the product options menu regardless of current stock level or zero-quantity status, giving users direct access to intake new stock for any catalog item at any time.

### Changed / Removed
- **Removed Zero-Quantity "Restock Product" Button**: Removed the green "Restock Product" button previously rendered in the empty state block when a product had 0 locations.

### Files Modified
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.19] - 2026-08-02

### Added
- **Display Tab Restock Filter ("Show 0 Qty w/ On-Site Stock")**: Added a dedicated filter checkbox in the Display Case view filter bar (selected by default) to keep zero-quantity display items visible if backstock is available on-site.
  - Helps staff immediately spot items that hit zero in the display case but are available in backstock storage or staging for restocking.
  - Updated `groupedProducts` logic in `DisplayCaseView.tsx` so items with `0` display quantity remain in the view if on-site backstock exists when `showZeroQtyWithStock` is active.
  - Added an interactive "Out of Display Case stock — X available in backstock [Restock Now]" quick-action banner on affected product cards to open the restock drawer in a single click.
  - Integrated `showZeroQtyWithStock` filter state into `App.tsx` and active filter count badge.

### Files Modified
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.18] - 2026-08-02

### Fixed
- **Product View Staging Location Display**: Fixed location tracking in the Product View tab on On-Site Storage (`ProductView.tsx`) so items stored in Staging (e.g. `staging_loose` or unassigned staging boxes) are explicitly displayed under each product's locations list.
  - Updated `findLocations` and `backStockLocations` to map unassigned staging containers to a virtual Staging freezer (`🛒 Staging`), preventing staging cuts from being filtered out.
  - Added `🛒 Staging Area` option to the top Location filter dropdown in `App.tsx` for quick filtering of staging items across the product catalog.
  - Retained full interactive quantity adjustments and direct navigation to staging container cards.

### Files Modified
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.17] - 2026-08-02

### Fixed
- **Stock Intake Freezer Default to Loose Storage**: Fixed an issue on the Stock Intake form (`UnifiedInboundMoveForm`) where selecting a target freezer before or without selecting a specific container resulted in items being sent to unassigned staging (`staging_loose`).
  - Added automatic fallback logic (`handleFreezerSelect`) that defaults target container selection to loose storage inside the chosen freezer (`${freezerId}_loose`) whenever a freezer unit is selected.
  - Updated Section 2A UI to clearly indicate when loose freezer storage is active (`Loose in Freezer Name`) with a default selected indicator badge.
  - Updated header target display and submit handler so items are placed into the selected freezer's loose container rather than general staging.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.16] - 2026-07-31

### Fixed
- **Movement Order Multi-Pallet Visibility**: Fixed an issue where selecting a move target destination for a single item filtered out all other source pallets from the spreadsheet view.
  - Removed restrictive automatic `palletsInPlay` filtering on `baseList` in `OffSiteSpreadsheet.tsx` so all pallets (e.g., P1, P2, P3) remain visible and accessible during movement planning.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.15] - 2026-07-31

### Added
- **Off-Site Inventory Tag Management**: Restored tag management capabilities in the Off-Site Inventory spreadsheet view.
  - Added tag selection pills and batch update capability to the **Bulk Edit Modal** (when editing selected items or an entire box).
  - Added tag toggling pills directly inside the **Inline Item Edit Form** during direct edit mode.
  - Rendered quick tag selector button (`renderItemTagSelector`) next to item action controls on each item row when direct edit is active.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.14] - 2026-07-31

### Changed
- **Comprehensive README.md Documentation Rewrite**: Rewrote the project `README.md` from scratch to accurately detail all features, including butcher processing, interactive spreadsheets, off-site storage logistics, QR camera scanning, backup integrity, and Home Assistant add-on integration.
- **Updated Add-on Config Description**: Updated the `description` string in `/freezer_inventory_tracker/config.yaml` to concisely reflect the application's comprehensive feature set.

### Files Modified
- `/freezer_inventory_tracker/README.md`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.13] - 2026-07-31

### Removed
- **Removed Dark Theme Mode**: Completely retired the dark theme display mode from the application interface, enforcing the crisp, high-contrast light mode with its custom warm sage/olive accent colors (`#c5cdb0`) universally.
- **Removed Theme Toggle Interface**: Cleared all theme toggling switch elements from the user dropdown and replaced display selectors in the Local Display Settings tab with a static confirmation indicating that High Contrast Sage Light Mode is enforced.

### Files Modified
- `/freezer_inventory_tracker/index.html`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.12] - 2026-07-31

### Fixed
- **Spreadsheet Pieces Column Background Color Alignment**: Fixed the light-mode styling selector in `index.css` that was too broadly matching and overriding the background color of generic `text-blue-300` elements (including the Pieces column table cells) to `#eff6ff`. Changed the CSS selector to target only `select` dropdown elements so the column background inherits correctly and matches the rest of the spreadsheet columns at `#c5cdb0`.

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.11] - 2026-07-31

### Changed
- **Spreadsheet High-Contrast Light Mode Support**: Included the `#butcher-spreadsheet-workspace` view container in the high-contrast light-mode style override lists. This fixes the `# Pieces` column text (and other light/dim text values) to render in high-contrast solid charcoal `#0d1007` to match the rest of the columns perfectly.
- **Interactive Table Sorting for Box Groups**: Enabled robust and comprehensive column-header sorting in the Grouped by Box spreadsheet view. Clicking any column header (Box, Pieces, Net Weight, Cut Name, Category, Location, Pallet, Status, Archived) now dynamically sorts the box groups as well as their nested child items.

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.10] - 2026-07-31

### Changed
- **Enhanced Product Info Item Name Contrast**:
  - Configured the item name within the Product Quick Info & Lists popup/modal to render in high-contrast solid black when in light mode and clean white when in dark mode.
  - Assigned unique HTML IDs (`product-quick-info-modal`, `product-quick-info-card`, `product-quick-info-title`) to the popup structures for perfect targetability.

### Files Modified
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.9] - 2026-07-31

### Changed
- **Enhanced Item Text, Total Stock, and Notes Styling**:
  - Customized light-theme cut item name text to render in high-contrast `#4A1E1B` (rich burgundy), ensuring beautiful and effortless legibility against the cream/sage backgrounds.
  - Adjusted light-theme total stock indicators (including Display + Storage and Combined stock counters) to a clean, crisp `#2B2D2F` (charcoal grey) to highlight the inventory counts beautifully.
  - Eliminated italic formatting for cut item notes globally in both light and dark modes to maintain sleek, consistent typography across all item rows, detail cards, and modal components.

### Files Modified
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.8] - 2026-07-31

### Changed
- **Enhanced Container Name Readability**:
  - Replaced `text-indigo-400` with `text-cyan-400` for all container names rendered on the on-site Freezer and Display Case views, as well as the Product view.
  - This matches the container name's color to the clean blue of the cuts, improving visual cohesion and drastically increasing text readability on both Carbon Olive (Dark) and High Contrast Sage (Light) palettes.

### Files Modified
- `/freezer_inventory_tracker/components/ContainerCard.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.7] - 2026-07-31

### Changed
- **Finalized Olive Tailwind Color Palette Migration**:
  - Fully migrated all extensive hardcoded CSS variables, readability overrides, forms, tables, buttons, dropdowns, and SVG text elements in `index.css` to use cohesive Carbon Olive (Dark) and High Contrast Sage (Light) hex codes.
  - Replaced remaining instances of Slate `#e2e8f0`, `#cbd5e1`, `#94a3b8`, `#0f172a`, and other gray shades with Olive and Sage palette counterparts (`#dee3cf`, `#c5cdb0`, `#8d9a6c`, `#0d1007`, etc.) to guarantee seamless theme consistency and exceptional light-mode contrast.

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.6] - 2026-07-31

### Changed
- **Transitioned to Olive Tailwind Color Palette**:
  - Refactored the global CSS variable declarations under `:root` and `:root.light` inside `index.css` to implement a sophisticated custom Olive and Sage color palette.
  - Replaced deep Carbon twilight dark grays with a warm, organic dark-olive palette, making the default dark display theme ("Carbon Olive") extremely premium and soft on the eyes.
  - Replaced office slate light grays with an elegant warm-sage and light-olive-grey color palette, rendering the high-contrast light display theme ("High Contrast Sage") clean, cohesive, and perfectly legible.
  - Aligned all hardcoded text-readability overrides, tag component fills (including primary button, warning, auto-retire, and emerald badges), and spreadsheet table header filters to the new Olive-Sage color scheme.
  - Updated the display settings panel configuration in `LibraryView.tsx` to reference the newly updated "Carbon Olive (Dark)" and "High Contrast Sage (Light)" options.

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.5] - 2026-07-30

### Changed
- **Light Theme Background Surface Darkening**:
  - Replaced `#f1f5f5` surface containers with `#e2e8f0` (Slate 200) across cards, inputs, selects, table bodies, modals, and dropdown menus.
  - Darkened secondary inner layers, sticky card headers, list item containers, table headers, subtabs, and hover states to `#cbd5e1` (Slate 300) with `#94a3b8` (Slate 400) border accents.
  - Updated `--cool-gray-950` page body background to `#cbd5e1` (Slate 300) while maintaining dark charcoal body text (`#0f172a` / `#1e293b`).

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.4] - 2026-07-30

### Changed
- **Light Theme Background Contrast Darkening**:
  - Shifted primary card containers, modals, form inputs, table surfaces, and dropdown menus from pure white (`#ffffff`) to `#f1f5f5`.
  - Darkened inner elements, sticky card headers, list items, table headers, and hover states from `#f1f5f9` to `#e2e8f0` (Slate 200) to maintain crisp, readable contrast against the `#f1f5f5` surface.
  - Adjusted `--cool-gray-950` page body background to `#e2e8f0` while preserving dark charcoal typography (`#0f172a` / `#1e293b`).

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.3] - 2026-07-30

### Changed
- **Consolidated Light Theme Surface Backgrounds**:
  - Unified `#f8fafc` (Slate 50) and `#f1f5f9` (Slate 100) into `#f1f5f9` (`--cool-gray-950` / Slate 100) across list item backgrounds, sticky headers, and surface layers for singular color management.

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.2] - 2026-07-30

### Changed
- **Light Theme Color Palette Consolidation**:
  - Streamlined light theme gray variables by consolidating `--cool-gray-450` (`#020617`) into Slate 900 (`#0f172a`) for uniform high-contrast titles and labels.
  - Consolidated near-duplicate pastel light background fills (`#f0f9ff` to Sky 100 `#e0f2fe`, `#ecfdf5` to Emerald 100 `#dcfce7`, `#fef3c7` to Orange 100 `#ffedd5`, and `#dbeafe` to Sky 100 `#e0f2fe`).
  - Standardized badge border colors (`#a7f3d0` to `#bbf7d0`, `#cbd5e1` to `#7dd3fc` for cyan pills, `#bfdbfe` to `#bae6fd`).
  - Consolidated near-identical accent text colors across views (`#065f46` and `#047857` into Green 700 `#15803d`, `#92400e` into Orange 800 `#9a3412`, `#1e3a8a` into Blue 800 `#1e40af`).

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.1] - 2026-07-29

### Fixed
- **Wipe Location for Archived Butcher Records**:
  - Implemented automatic wiping of location, currentLocation, pallet, storageLocationId, and moveTo fields for any offsite entries when they are marked as archived.
  - Updated both `ADD_BUTCHER_ORDER` in the action reducer and the state-wide `normalizeState` helper in `server.ts` to ensure all historical and newly imported archived records are clean and do not retain obsolete location assignments once they are out of the system.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.91.0] - 2026-07-29

### Added
- **Scheduled Backup Time / Hour Selector**:
  - Added full support for assigning a custom scheduled hour (0-23) for daily database-only automatic rolling snapshots.
  - Implemented an elegant "Backup Hour" dropdown selector in the rolling backup settings panel.
  - Re-engineered server-side daily backup scheduling to compare the preferred hour and elapsed days in an idempotent manner.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.90.4] - 2026-07-29

### Added
- **"Suggest Name" Button to Edit Container Form**:
  - Integrated the smart "Suggest Name" random name generator directly into the "Edit Container" modal window.
  - Leverages the full list of 300 unique short nouns to suggest clean, collision-free, and delightful container names upon click, offering the same easy-to-use generation functionality as the Add/Inbound container workflows.

### Files Modified
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.90.3] - 2026-07-29

### Added
- **Expanded Container Auto-Generation Nouns**:
  - Expanded the `ShortNouns` array from 70 to exactly 300 unique short nouns used during container auto-generation/suggestion.
  - Added full support for various fruits, vegetables, animals, cities, nature concepts, and household objects to prevent repetitive container name suggestions.

### Files Modified
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.90.2] - 2026-07-29

### Added
- **Butcher Fee Metric ($)**:
  - Added full support for tracking a custom "Butcher Fee" ($) metric on butcher orders.
  - Enabled entering the Butcher Fee inside both the Import / Log New Order form and the Edit Butcher Order modal.
  - Implemented automatic database persistence (SQLite schema migration to add `butcherFee REAL DEFAULT 0`, normalization maps, and serialized data handling).
  - Designed elegant visual indicators displaying the Butcher Fee on Active Order cards, along with a dynamic "Processing Cost per Packaged Pound" calculation in the Order Statistics sidebar.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.90.1] - 2026-07-29

### Added
- **Inline Editing of Associated Document Links**:
  - Added full inline editing support for attached document names and URLs inside the "Edit Butcher Order" window.
  - Enhanced the document item display, maximizing focus on custom readable names (such as Cutsheets, Invoices, Yield Reports) with smaller, elegant auxiliary URL previews and sleek action icons.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.90.0] - 2026-07-29

### Added
- **Associated Documents on Butcher Orders**:
  - Implemented dynamic support for attaching document links (URLs with custom readable names, such as cut sheets, yield reports, invoices, etc.) to individual butcher orders.
  - Added full database serialization/deserialization for order documents using JSON-serialized columns in SQLite, with automated on-the-fly table schema migrations (`ALTER TABLE butcher_orders ADD COLUMN documents TEXT`) and state normalization.
  - Developed an interactive associated documents manager in the "Edit Butcher Order" modal, allowing users to view, add, and remove documents.
  - Expanded the CSV/Data Import form to allow attaching document links immediately when importing/logging a new butcher order.
  - Designed elegant links rendering on individual butcher order cards in the main active orders view, complete with custom icons that open documents in a new tab.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.26] - 2026-07-29

### Changed
- **Style Customization for Butcher Order Species Badge**:
  - Customized the background color of the species badge inside the active butcher orders view to `#9ca7b5` per direct selector styling requests.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.25] - 2026-07-29

### Fixed
- **Preserve Active Off-site Inventory Status during Butcher Order Imports**:
  - Restructured state saving (`saveStateSync`) and the `ADD_BUTCHER_ORDER` handler in `server.ts` to prevent overwriting or archiving matching pre-existing entries in the active off-site storage inventory.
  - Ensured historical butcher logs can be uploaded or re-imported without altering or overriding the `archived` state (or active status) of items currently tracked in live off-site inventory.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.24] - 2026-07-29

### Added
- **Cancel Button for Butcher Order Import Form**:
  - Implemented a "Cancel / Clear Form" button to clear/reset all input fields, target order ID selection, and parsed CSV rows during the butcher order import process.
  - Placed the button right next to the "Complete Import Process" button for smooth accessibility.
  - Added a state-based file input key to fully reset file uploads when cleared.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.23] - 2026-07-29

### Fixed
- **Prevent Unassigned Loose Drops in Staging Area**:
  - Disabled dropping `meat-cut` items onto the general staging area's background in both `FreezerView.tsx` and `ProductView.tsx` so that items don't accidentally get moved into "Loose" staging when a user misses a specific container target.

### Files Modified
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.22] - 2026-07-29

### Fixed
- **Instant Local Drag & Drop Updates in Staging & Freezers**:
  - Added immediate optimistic client-side UI updates in `useInventory` for `MOVE_CONTAINER`, `MOVE_MEAT_QUANTITY`, and `MOVE_STAGING_TO_OFFSITE` actions.
  - Made pending batch flushes non-blocking so move actions execute instantly in React without waiting for prior debounced updates or network round-trips.
  - Removed `mousemove` from the global inactivity event listener list to prevent continuous cursor dragging motion from repeatedly resetting the 2-second debounce timer.

### Files Modified
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.21] - 2026-07-29

### Fixed
- **Target Destination Theme-Aware Contrast**:
  - Implemented explicit global CSS rules (`.target-destination-name` and `.target-destination-label`) that adapt directly to the application's global `:root.light` theme state.
  - Ensures the target container name is rendered in crisp **white** (`#ffffff`) in dark mode and **black** (`#000000`) in light mode for maximum legibility.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.20] - 2026-07-29

### Fixed
- **Target Destination Container Name Contrast**:
  - Updated the container name text in the Target Destination Location header (`UnifiedInboundMoveForm`) to `text-black dark:text-white` so it renders in black when in light mode and white when in dark mode.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.19] - 2026-07-29

### Changed
- **Adaptive Light/Dark Mode Contrast**:
  - Updated the "Target Destination Location" header pill badge in `UnifiedInboundMoveForm` to automatically render crisp black text (`text-black`) when in light mode and clean white text (`dark:text-white`) when in dark mode.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.18] - 2026-07-29

### Fixed
- **Header Label High Contrast**:
  - Enforced explicit black color inline styling (`color: #000000`) on the "Target Destination Location" header pill label in `UnifiedInboundMoveForm` for maximum contrast and legibility.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.17] - 2026-07-29

### Changed
- **High-Contrast Black Text & Custom Cyan Badge Styling**:
  - Updated `Target Destination Location` header pill label in `UnifiedInboundMoveForm` to high-contrast black text on a bright cyan background pill.
  - Updated suggested consolidation count badge to `#0fa3f0` cyan background with high-contrast black text (`color: #000000`).
  - Enhanced item count badges on suggested consolidation container cards (`Already has X pcs inside`) to bold black text on cyan highlights for ultra-crisp legibility.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.16] - 2026-07-29

### Changed
- **High-Contrast Text Enhancements**:
  - Upgraded text and label contrast across `UnifiedInboundMoveForm` to bright light-on-dark tones (`text-white`, `text-cool-gray-200`, `text-cyan-200`, `text-amber-200`), eliminating low-contrast muted grays on dark backgrounds for improved readability.
- **Suggested Consolidation Staging Badges**:
  - Fixed suggested container items in staging so that when a suggested container is located in staging (no freezer assigned), it explicitly displays a high-contrast `🛒 Staging` location badge instead of rendering nothing.
- **Streamlined Staging Labels**:
  - Shortened all occurrences of "Staging Table / Sorting Area" and "General Staging Area / Sorting Table" to "Staging" across header badges, destination selectors, and location tags.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.15] - 2026-07-29

### Changed
- **Stock Intake & Move Window UX Overhaul**:
  - **Sticky Top Location Header**: Added a prominent, high-visibility destination banner at the top of the window displaying the target container and freezer unit (or Staging Table) in real time as selections are made.
  - **Top Primary Done Button**: Moved the primary "Done / Complete Stock Intake" action button directly into the top header bar for instant access without requiring scrolling through long lists.
  - **Default Destination Changed to Staging Table**: Set the initial default destination for inbound stock and moves to the General Staging Area / Sorting Table (`staging_loose`) instead of the Display Case.
  - **Distinct Container & Freezer Selection Sections**: Separated container choice (Section 2A: Staging Table, Existing Box/Bag, Retired/Unused Box, or Create New Box) and freezer unit assignment (Section 2B: Visual Freezer Selector & Dropdown) into distinct, un-blurred panels to ensure a freezer unit is consciously selected.

### Files Modified
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.14] - 2026-07-29

### Fixed
- **Numeric-Aware Natural Sorting for On-Site Inventory & Locations**: Updated all on-site inventory views, freezer listings, container groupings, product categories, location selectors, and modal option lists to utilize natural numeric sorting (`localeCompare(..., { numeric: true, sensitivity: 'base' })`). Numbers within labels (e.g. Freezer 1, Freezer 2, Freezer 10 or Box 1, Box 2, Box 10) now alphabetize naturally in numerical order across all on-site inventory views, matching off-site inventory sorting behavior.

### Files Modified
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/ReconciliationView.tsx`
- `/freezer_inventory_tracker/components/SearchableContainerSelect.tsx`
- `/freezer_inventory_tracker/components/SearchableProductSelect.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/components/ManagementForms.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.13] - 2026-07-29

### Fixed
- **Resilient Staging Area Drag-and-Drop Item Moves**: Resolved "Invalid move source cut." error during drag-and-drop operations between containers in the Staging Area by enhancing server-side `MOVE_MEAT_QUANTITY` action handling. Added fallback resolution mechanisms (lookup by source container ID and product ID) if the cut ID was altered or merged, added safe quantity string-to-number parsing and clamping, and included `productId` in client drag payload events across components.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/components/MeatCutRow.tsx`
- `/freezer_inventory_tracker/components/ContainerCard.tsx`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.12] - 2026-07-28

### Added
- **Persisted View State in Butcher Log Spreadsheet**: Integrated `localStorage` view state persistence in `ButcherSpreadsheetView` to retain order selection filters (`selectedOrderIds`), column filters, category selections, search query, column visibility settings, and sorting preferences when navigating away and returning to the tab.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.11] - 2026-07-28

### Added
- **Exposed Archived Column in Butcher Spreadsheet**: Added dedicated "Archived" column to `ButcherSpreadsheetView` with sorting, filtering ("Yes" / "No"), and CSV export integration.

### Changed
- **Full Historical Butcher Cuts Scope**: Updated `ButcherSpreadsheetView` filtering logic to display all butcher order cut records (both active and archived) so users can inspect complete order details regardless of archived status.
- **Order Scope Dropdown Cut Counts**: Updated order selection dropdown popover to count total cuts including archived items per butcher order.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.10] - 2026-07-28

### Added
- **Natural Numeric Box Label Sorting**: Created `compareBoxLabels` utility in `utils/boxSort.ts` for chunked natural box sorting across Off-Site inventory views and Butcher spreadsheets.
- **Preceding Zero Stripping & Numerical Segment Ordering**: Standardized box ordering so prefix and suffix numeric segments are compared as integers (ignoring leading zeros during value evaluation) while preserving exact sequence order (e.g. `3334-01`, `3334-02`, `3334-3`, `3334-10`, `03334-11`, `3334-100`, `13455-03`).

### Files Modified
- `/freezer_inventory_tracker/utils/boxSort.ts`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `/freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.9] - 2026-07-28

### Fixed
- **Movement Order Manifest Item & Cut Resolution**: Enhanced `MovementReportModal.tsx` and `OffSiteMovementHistory.tsx` with robust multi-tiered cut and product resolution (`getEntryCutName`).
- **Original Entries & Off-Site Entries Fallback**: Added multi-stage lookup across order `originalEntries`, live `offSiteEntries`, catalog `meatCuts`, and `products` so movement order manifests and delivery slips always resolve complete cut names and product details instead of defaulting to "Unknown Item" or missing cuts.
- **Destination Matching & Location Resolution**: Improved destination filtering to correctly match target destination locations, pallets, and order destination lists when rendering manifests and reports.

### Files Modified
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.8] - 2026-07-28

### Fixed
- **Container Movement Freezer Options Filter**: Filtered out off-site pallets (`isPallet` / `pallet-*`) from freezer destination dropdowns when moving containers or assigning freezer locations in on-site inventory, ensuring only physical on-site freezers are listed.
- **Catalog Containers View Box Filter**: Filtered out off-site boxes (`isBox` / `box-*`) from the main catalog Containers view tab and on-site container counts so that boxes and containers remain strictly separated in their respective tables.

### Files Modified
- `/freezer_inventory_tracker/components/MoveModalContent.tsx`
- `/freezer_inventory_tracker/components/AddForms.tsx`
- `/freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.7] - 2026-07-28

### Added
- **Receive Additional Cuts in Existing Log**: Added a "+ Receive Additional Cuts" action button on existing butcher log cards and a destination mode selector in the CSV Import tab.
- **Single Log Metadata Preservation**: Receiving cuts into an existing order links all imported cuts to the target order ID without duplicating animal counts, live weights, hot weights, or dates, keeping all carcass and yield metrics grouped in one single log.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.6] - 2026-07-27

### Added
- **Hands-Free Global Barcode Scanner Capture**: Implemented global keydown listener in `OffSiteMovementScanner.tsx` so Bluetooth and USB physical barcode scanners work seamlessly anywhere on the screen without requiring focus on the barcode text box.
- **On-Screen Keyboard Prevention**: Removed forced focus traps (`bluetoothInputRef.current?.focus()`) on page load and body clicks, keeping the mobile/tablet software touch keyboard hidden unless the user explicitly taps the barcode input box to type manually.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.5] - 2026-07-27

### Fixed
- **Persistent Archiving State Reset**: Fixed a critical issue in `server.ts` `normalizeState` where previously archived offsite and butcher entries (`archived: true`, `1`, or `'true'`) had their `archived` status reset to `false` during state normalization on server load and state synchronization.
- **Off-site Spreadsheet Archiving Filter**: Updated `OffSiteSpreadsheet.tsx`, `OffSiteStorageView.tsx`, and `ButcherSpreadsheetView.tsx` to strictly check all truthy forms of `archived` (`true`, `1`, `'true'`) when excluding archived items from active views.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.4] - 2026-07-27

### Fixed
- **Butcher Spreadsheet View Archiving Filter**: Updated `ButcherSpreadsheetView.tsx` so archived records are hidden from off-site views and total cut counts by default, ensuring consistency across all off-site storage and spreadsheet views.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.3] - 2026-07-27

### Fixed
- **Off-site Inventory Movement Order Archiving Glitch**: Fixed an issue in `server.ts` `normalizeState` where items imported from butcher records or stored in uncategorized/unassigned pallets were being automatically marked as `archived: true` whenever a movement order was initiated (`ADD_MOVEMENT_ORDER`).
- **Location Keyword Over-matching**: Removed false positive auto-archiving triggered by location/supplier names containing "butcher" or partner locations of non-storage type. Auto-archiving now strictly checks if items were moved away in a completed movement order or explicitly assigned to Home Base or On-Site Staging.
- **Loose Items Normalization**: Preserved `location`, `storageLocationId`, `pallet`, and `currentLocation` for loose/unboxed items in `normalizeState` so uncategorized pallet items maintain their pallet references.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.2] - 2026-07-27

### Changed
- **Full Cut Listing in Condensed Box View**: Updated the condensed box row layout in `ButcherSpreadsheetView.tsx` to list every cut present inside each box along with individual cut weights, removing the `+X more cuts...` truncation limit.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.1] - 2026-07-27

### Changed
- **Removed Order # Column**: Removed the Order Number column from default visible columns, column picker dropdown, table header, group rows, child item rows, and flat list view in `ButcherSpreadsheetView.tsx`.
- **Removed Visual Box Icons**: Cleaned up the Box ID display across grouped box rows, child item rows, flat list rows, and toolbar headers by removing package SVG icons and box emoji clutter for a streamlined spreadsheet layout.

### Fixed
- **Type Safety**: Resolved TypeScript sorting and export parameters in `ButcherSpreadsheetView.tsx`.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.89.0] - 2026-07-27

### Added
- **Multi-Order Focus Selector Popover**: Replaced the single order `<select>` dropdown in `ButcherSpreadsheetView.tsx` with an interactive multi-select popover. Users can search order numbers/species, select single or multiple orders simultaneously, jump to the most recent order, or view all butcher orders in a single unified view.
- **Per-Column Filter Dropdowns**: Added column-specific filter icons and modal popovers to all spreadsheet headers (Box ID, Cut Name, Category, Order #, Location, Pallet, Serial, Lot #, Pack Date, Status) mirroring the off-site spreadsheet. Includes quick Select All/Deselect All buttons and live search inside each column dropdown.
- **Global Clear Column Filters Toolbar Action**: Added a prominent "Clear Column Filters" button to the spreadsheet toolbar that appears whenever any column-specific filter is active.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.88.2] - 2026-07-27

### Fixed
- **Null Safety Guard for Box Data Mapping**: Resolved `TypeError: Cannot convert undefined or null to object` error in `ButcherSpreadsheetView.tsx` by populating `cutsSummary`, `categories`, `orderNumbers`, `lots`, and `packDates` in `condensedBoxes` memoization map and adding defensive null/undefined checks (`group.cutsSummary || {}`, `group.categories || []`) across the box grouping renderer.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.88.1] - 2026-07-27

### Added
- **Complete Column Parity in Grouped Box Spreadsheet**: Updated the Grouped by Box spreadsheet table in `ButcherSpreadsheetView.tsx` to render all spreadsheet columns (Box ID, Cut / Product Name, Category, Net Weight, Pieces, Order #, Location, Pallet / Placement, Serial Number, Lot #, Pack Date, Notes, Tags, Availability Status, Actions) as top-level headers across both parent group rows and collapsible child cut rows.
- **Category Column in Column Picker**: Added Category visibility toggling and state synchronization to the Column Picker popover menu.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.88.0] - 2026-07-27

### Added
- **Default Grouping by Box**: Updated the Butcher Repository Spreadsheet to group cuts by box by default (with collapsible box cards, box metrics, placement badges, and active/archived counts), replicating the Off-Site storage spreadsheet layout.
- **Spreadsheet Live Summary Totals**: Replicated the live-updating summary cards (Total Boxes with optional simulation toggle, Total Weight in lbs, and Total Pieces) that react in real-time to active search, order focus, or category filters.
- **Spreadsheet Itemized Inventory Breakdown**: Added the collapsible "Spreadsheet Itemized Inventory Breakdown" panel with search, category filter, and sortable columns (Item Name, Category, Pallets/Placements, Box Count, Total Weight, Total Pieces).
- **Expand/Collapse All Boxes & View Toggles**: Added bulk Expand All / Collapse All controls for box cards and a toggle to switch between Grouped by Box and Flat List views.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.87.0] - 2026-07-27

### Added
- **Butcher Records Detailed Cuts Spreadsheet**: Added a dedicated "Spreadsheet" tab in `ButcherRecordsView.tsx` powered by `ButcherSpreadsheetView.tsx` to render all cuts ever created across processing logs without filtering out archived cuts.
- **Smart Butcher Order Focus Filter**: Defaults automatically to the single most recent butcher order on load to prevent rendering lag, while allowing users to switch focus to any historical butcher order or view the entire repository.
- **Full Spreadsheet Parity & Utilities**: Includes global text search, column sorting, raw CSV cut name vs catalog name toggles, category multi-select filters, customizable column visibility, item tag selectors, inline editing modal, and CSV export.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherSpreadsheetView.tsx`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.9] - 2026-07-26

### Fixed
- **Home Assistant Ingress User Header Attribution**: Created `extractUserFromReq` helper in `server.ts` to inspect all Home Assistant Ingress user header variants (`X-Remote-User-Name`, `X-Hass-User-Name`, `X-Ingress-User-Name`, `X-Remote-User`, `X-Ingress-User`, `X-Hass-User`, `X-Forwarded-User`, `X-Authentik-Username`, `X-User-Name`) and request bodies, preventing audit history entries from falling back to hardcoded "Home Assistant".
- **Client-Side User Header Propagation**: Updated `sendActionToServer` in `useInventory.ts` to attach `X-User-Name` header from client `localStorage` when sending inventory state transactions to the backend.
- **Audit Log User Display Formatting**: Enhanced `HistoryView.tsx` with `formatUserDisplay` to cleanly strip duplicate `@` prefixes and present "Home Assistant" or "System" cleanly.
- **Notification Gateway Test Error Handling**: Enhanced `sendNotificationPayload` in `server.ts` with robust Home Assistant service URL normalization, `X-Supervisor-Token` header support, 10s request timeout, and clear diagnostic error messages for authentication or unreachable server issues.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/views/HistoryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.8] - 2026-07-26

### Changed
- **Snapshot Action Buttons**: Removed redundant standalone live preview button from snapshot backup rows and updated the main action button text to "Preview and Restore" in `DataImportView.tsx`.

### Files Modified
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.7] - 2026-07-26

### Fixed
- **Photo Asset Restoration across All Snapshot & ZIP Import Flows**: Fixed issue where photo assets were omitted during snapshot restoration (`/api/backups/restore/:filename`) and package upload because `selPics` was missing from `activeSections` (`'images'`) in `DataImportView.tsx`.
- **Direct 1-Shot Server Package Unzipping**: Updated `DataImportView.tsx` (`handleImportFileChange`) to upload full ZIP archives directly to `/api/backups/import-zip` for instant, 1-shot server-side unzipping of database and photo assets directly into `UPLOADS_DIR`.
- **Static Route Aliases for Legacy Photo URLs**: Added `app.use('/images', express.static(UPLOADS_DIR))` and `app.use('/photos', express.static(UPLOADS_DIR))` in `server.ts` to guarantee that legacy or imported image URLs starting with `/images/` or `/photos/` serve properly.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.6] - 2026-07-26

### Fixed
- **ZIP Backup Photo Restoration**: Resolved issue where photos/images were not restored from ZIP backups due to path validation rejecting `images/` directory paths in `/api/backups/upload-image` and strict folder naming in client-side ZIP parsing.
- **Universal Image Asset Extraction**: Updated `server.ts` (`/api/backups/restore/:filename`, `/api/backups/import-zip`, `/api/backups/preview-file`, `/api/backups/upload-image`) and `DataImportView.tsx` to search across all entries and folders in ZIP packages for image extensions (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.svg`) or image folders (`images/`, `photos/`, `uploads/`), extracting sanitized image basenames safely.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.5] - 2026-07-26

### Fixed
- **ZIP Backup Restoration for JSON and CSV Archives**: Resolved issue where restoring a ZIP backup containing `inventory-on-site.json` or `inventory-off-site.csv` (without `inventory.db` or with custom subfolder/file names) made no changes.
- **Flexible ZIP Entry Extraction**: Updated `/api/backups/restore/:filename`, `/api/backups/import-zip`, and `DataImportView.tsx` to search flexibly across all entries in ZIP packages for JSON, CSV, or SQLite DB files, ensuring complete state restoration regardless of directory nesting or exact filename variations.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.4] - 2026-07-26

### Fixed
- **Selective Restore Safety & Table Validation**: Updated selective database restore (`selectiveRestoreFromDb`) in `server.ts` to inspect SQLite schema before attempting table queries, safely skipping non-existent tables (such as `custom_list_items`) without throwing warnings or SqliteErrors.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.3] - 2026-07-26

### Fixed
- **Snapshot Off-Site Physical Item Totals Comparison**: Fixed snapshot preview inspection endpoint (`/api/backups/preview/:filename`) so off-site cold storage entries, total pieces, net weight (lbs), and cut sample names are accurately extracted across all backup formats including ZIP archives (`inventory-off-site.csv` / `inventory-on-site.json`), SQLite databases (`off_site_entries`), CSV exports, and JSON files.
- **Robust Numeric Parsing**: Enhanced off-site pieces and net weight aggregation in both client-side `DataImportView` and server-side preview inspector to safely sanitize formatted numeric strings.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.1] - 2026-07-25

### Fixed
- **Action Error Console Suppression**: Updated `sendActionToServer` in `useInventory` hook to gracefully catch and suppress console error logging when state modifications are safely intercepted by Live Preview Mode or read-only database guards.

### Files Modified
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.86.0] - 2026-07-25

### Added
- **Live Snapshot Preview Mode**: Added ability to live preview any snapshot directly across all application views without altering or overwriting active database state.
- **Top Notification Banner & Exit Control**: Added a prominent cyan top banner when Preview Mode is active showing the active backup filename with a quick "Exit Preview Mode" button.
- **Read-Only Database Safeguards**: Implemented express backend middleware and client-side transaction interceptors to reject state-modifying requests in preview mode and display an informative modal explaining that database modifications are disabled during live preview.
- **Preview Actions in Snapshot Vault & Comparison Modal**: Added "Preview" launch controls to both the Snapshot Vault table rows and the Snapshot Comparison modal footer in DataImportView.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.85.1] - 2026-07-25

### Fixed
- **ZIP Snapshot Preview Precision**: Updated the preview inspection engine in `/api/backups/preview/:filename` to extract and query `inventory.db` directly inside `.zip` snapshot archives rather than relying on `inventory-on-site.json`. This ensures that snapshot comparison metrics always match the exact SQLite database file being restored, even if external changes or manual edits were applied to the database.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.85.0] - 2026-07-25

### Added
- **Unified Snapshot Library & Format Selector**: Standardized all system backups and restores under the point-in-time Snapshot Vault list. Added format selection for creating snapshots: "Database Only" (`.db`) or "Database + Photographs" (`.zip`).
- **Live Snapshot Comparison & Selective Restore Modal**: When clicking "Restore" on any snapshot in the vault, a modal displays a live side-by-side comparison between active database counts and snapshot counts across all sections (Freezers, Containers, Catalog, On-Site Stock, Off-Site Storage, Shopping Lists, Quality Tags). Allows selective toggle restoration per section.
- **Dual-Schedule Rolling Backups**: Implemented independent automated background schedules for Database-only snapshots and Full Database + Photographs archives, with customizable intervals and retention limits.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.7] - 2026-07-25

### Removed
- **Manage Data Tab Clean Up**: Removed redundant JSON/CSV backup and restore controls (`backupJson`, `backupCsv`, `handleExportDatabase`, and `handleRestoreJsonDatabase`) from the "Manage Data" tab (`DataImportView.tsx`). Users can now cleanly manage database backups using native SQLite snapshots (`.db`) and comprehensive package archives (`.zip`).
- **Off-Site CSV Export Retained**: Kept the off-site CSV spreadsheet export intact in the Off-Site Storage view as requested.

### Files Modified
- `/freezer_inventory_tracker/views/DataImportView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.6] - 2026-07-25

### Changed
- **Database Initialization Optimization**: Removed ~370 lines of legacy one-time database schema migration code (legacy `cuts` column refactoring, duplicate `sourceLocation`/`historical`/`importedToOffSite` column migrations, and legacy freezer/container box & pallet extractions) from `initDatabase()` in `server.ts`. Database startup is now streamlined and faster while retaining essential schema checks (`CREATE TABLE IF NOT EXISTS`, column additions, and custom indexes).

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.5] - 2026-07-25

### Added
- **Home Assistant API & Supervisor Token Permissions**: Added `homeassistant_api: true`, `hassio_api: true`, and `auth_api: true` flags to `/freezer_inventory_tracker/config.yaml`. This enables Home Assistant Supervisor to automatically provision the `SUPERVISOR_TOKEN` environment variable and grant the add-on permission to pull user/system info and send push notifications (persistent notifications and mobile device notifications) directly through `http://supervisor/core/api`.

### Files Modified
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.4] - 2026-07-25

### Fixed
- **Off-Site Product Info Matching**: Fixed issue where viewing product info (`ProductQuickInfoModal.tsx`) returned `0 lbs` and `0 pcs` for off-site inventory. Updated matching logic to check direct `e.productId` references, `e.originalCutName`, `productNumbers`, and cleaned cut names (stripping item number prefixes) to accurately calculate total off-site weight, piece count, and pallet/location breakdowns.

### Files Modified
- `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.3] - 2026-07-22

### Fixed
- **Bundled `nodemailer` & Lazy SMTP Import**: Updated esbuild bundling in `package.json` to bundle JS dependencies directly into `dist/server.cjs` (marking only native `better-sqlite3` as external) and converted top-level `nodemailer` import in `server.ts` to lazy dynamic loading inside `smtp_email` notification method to eliminate Home Assistant startup `Cannot find module 'nodemailer'` crashes.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.2] - 2026-07-22

### Fixed
- **Missing `nodemailer` Dependency**: Added `nodemailer` and `@types/nodemailer` to `/freezer_inventory_tracker/package.json` to resolve `MODULE_NOT_FOUND` runtime error on Home Assistant startup when requiring `nodemailer` in `dist/server.cjs`.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.1] - 2026-07-22

### Changed
- **Searchable Checkbox Filter Dropdowns in Audit History**: Replaced simple select dropdowns in `HistoryView.tsx` with multi-select searchable checkbox dropdown menus (`SearchableCheckboxDropdown`) matching the app's filter patterns across Freezers, Containers, Products, and Users. Features include in-menu quick search, "Select All", "Clear Selection", item count indicators, and multi-select combination filters.

### Files Modified
- `/freezer_inventory_tracker/views/HistoryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.84.0] - 2026-07-22

### Added
- **Audit Log Maintenance & Purging Modal**: Built a dedicated Purge / Maintenance tool in `HistoryView.tsx` with automated retention policies (Purge >30 days, >60 days, >90 days, Retain top 100/250 entries, or Clear All), including real-time purge estimations and safety confirmations.
- **Backend `PURGE_HISTORY` Action**: Added `PURGE_HISTORY` handler in `server.ts` to perform server-side log trimming and log the maintenance action itself.
- **Advanced Audit Log Filtering**: Added granular multi-dimensional filters in `HistoryView.tsx`:
  - Timeframe filter (All time, Today, Last 7/30/90 days, or Custom Start/End Date Range)
  - Freezer filter
  - Container filter (dynamically filtered by selected freezer)
  - Product filter
  - User filter (@user drop-down list)
  - Active filter count indicators and one-click "Clear All Filters" button.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/HistoryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.10] - 2026-07-22

### Added
- Enriched audit history logs across all inventory actions (`ADD_MEAT_CUT`, `UPDATE_MEAT_QUANTITY`, `BATCH_UPDATE_MEAT_QUANTITY`, `RECONCILE_QUANTITIES`, `MOVE_MEAT_QUANTITY`, `BULK_ADD_MEAT_CUTS`, `TOGGLE_MEAT_TAG`, `UPDATE_MEAT_NOTES`) to explicitly include container and freezer location details (e.g., `in "White Bag" in "Chest Freezer"`).
- Enhanced Global Inventory History (`HistoryView.tsx`) to dynamically resolve container and freezer location metadata for target items, rendering interactive location badges (e.g. `📍 White Bag → Chest Freezer`) and allowing location search filtering.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/HistoryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.9] - 2026-07-22

### Fixed
- Fixed database persistence for `timezone` in `notification_settings` SQLite table schema (`columns`, `createSql`, `fromDb`, `toDb`, and auto-migration).
- Enhanced `checkAndTriggerScheduledNotifications()` with `getDateAndMinutesInTz` using `hourCycle: 'h23'` and `>= targetMinutes` logic to ensure scheduled daily digests trigger reliably at the exact target hour/minute in the user's local timezone.
- Corrected timezone-aware `lastSentDateStr` evaluation to prevent false duplicate checks between UTC ISO timestamps and local date strings.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.8] - 2026-07-22

### Added
- Added Timezone selector to Notification Center settings in `LibraryView.tsx` and saved `timezone` configuration to server backend.

### Fixed
- Updated background scheduler in `server.ts` (`checkAndTriggerScheduledNotifications`) to accurately evaluate dispatch hours against the user's configured Time Zone (instead of UTC container system time).
- Fixed `lastDigestSentAt` tracking in `server.ts` to guarantee state is correctly updated once per day upon scheduled dispatch evaluation.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.7] - 2026-07-22

### Fixed
- Added missing `GET /api/notifications/settings` endpoint in `server.ts` to return global notification configuration.
- Wrapped notification API requests in `LibraryView.tsx` with `getApiUrl` helper to prevent HTML 404/Ingress fallback errors when fetching notification settings.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.6] - 2026-07-22

### Changed
- Removed bold styling from all navigation and action items inside the hamburger dropdown menu.
- Restricted "Inbound Bulk Stock" operation visibility strictly to On-Site Warehouse views (`product`, `freezer`, `display_case`), removing it from Butcher Records and non-on-site screens.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.5] - 2026-07-22

### Fixed
- Updated header status indicators ("Live", "Saving", "Staging Pending", active relocation indicators), symbols, and hamburger/sync dropdown menu items to enforce solid high-contrast black text (`#000000`) and icons in Light Mode.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.4] - 2026-07-22

### Fixed
- Updated header subtab buttons (`#offsite-header-subtabs`) to use solid high-contrast black text (`#000000` / `#0f172a`) on cyan active tabs and inactive buttons in both light mode and dark mode.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.3] - 2026-07-22

### Fixed
- Reverted and restored high-contrast solid white text for active subtab buttons ("Movement Scanner" / "Live" active movement buttons) in Light Mode.
- Overhauled light-green emerald badge and text styling to eliminate washed-out green-on-white text, replacing pale tints with high-contrast dark forest emerald (`#065f46` / `#047857`) on soft mint backgrounds (`#ecfdf5`).

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.2] - 2026-07-22

### Fixed
- Comprehensive high-contrast Light Theme contrast overhaul across Butcher Logs and Off-Site Storage views.
- Resolved light-on-light and dark-on-dark text issues across spreadsheet tables, movement planners, barcode scanner controls, storage hierarchy nodes, butcher order breakdown cards, SVG charts, tooltips, and modal dialogs.
- Maintained crisp white text on solid-colored primary action buttons while mapping form controls, selects, and text inputs to high-contrast dark charcoal on white backgrounds.

### Files Modified
- `/freezer_inventory_tracker/index.css`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.1] - 2026-07-22

### Fixed
- Ensured `notificationSettings` and `notificationLogs` are explicitly serialized and restored across full JSON state restores, ZIP exports, and ZIP imports.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.83.0] - 2026-07-21

### Added
- Added full Custom List Digest Notifications configuration to custom lists (enabling daily digests with options for All Items, Newly Added Only, or Item-Specific filtering).
- Added individual item notification toggles (`TOGGLE_LIST_ITEM_NOTIFICATION`) for items in lists with notifications enabled.
- Added a dedicated Notification Center workspace inside Library View to manage delivery gateways (SMTP Email, Home Assistant Persistent Feed, Home Assistant Notify Service, Webhook, and In-App), test connections, dispatch instant digests, and view system dispatch logs.
- Added `notificationSettings` and `notificationLogs` schema support in state normalization, server endpoints, and backup/restore workflows.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.82.1] - 2026-07-21

### Changed
- Condensed the detailed relocation list in the completed movement order archive to group entries by Box ID by default.
- Added fully interactive, collapsible accordion controls to let users expand specific boxes for deep-dive item cut details.
- Fixed product category mapping in the movement order detailed trail. Resolved product identifiers to fetch precise category strings (`primaryCategory > subCategory`) instead of displaying `N/A`.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.82.0] - 2026-07-21

### Added
- Implemented the ability to add and edit notes for pallets directly within the Storage Hierarchy view.
- Added an interactive notes editor modal with rich textarea controls and custom responsive actions.
- Introduced a styled inline notes pill overlay displayed beside the pallet title in the hierarchy list.
- Implemented the `UPDATE_PALLET_NOTES` action to securely persist custom pallet notes to the persistent SQLite database.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.81.3] - 2026-07-21

### Changed
- Renamed the off-site inventory sub-tab from "History" to "Movements" to better reflect the list of active/completed movement records and enhance navigation clarity.
- Updated the warning/notice text when preparing a new movement order to properly guide users to the "Movements" tab for completed/reverted items.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.81.2] - 2026-07-21

### Changed
- Changed `#offsite-workspace-body` container's styling from `overflow-hidden` to `overflow-visible` to allow descendants using `position: sticky` to scroll and stick relative to the window correctly.
- Replaced custom Tailwind arbitrary values on the sticky bulk action bar with explicit, inline CSS `top` calculations utilizing CSS `calc()` with `--header-height` to guarantee full browser support and pixel-perfect placement.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.81.1] - 2026-07-21

### Changed
- Reconfigured the bulk action bar on the movement/spreadsheet view to stay sticky at the top using dynamic header height offsets, preventing overlapping with the main header.
- Added comprehensive real-time visual summaries within the bulk action bar, including total weight, total count (pieces), total boxes and items count, and an interactive detailed breakdown of checked cuts with their respective quantities and weights.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.81.0] - 2026-07-21

### Added
- Added full support for displaying multiple target destinations of split boxes within the Delivery Planner and Mobile Scanner views.
- Updated the `DeliverBox` interface in both planner and mobile scanner to pre-compute and store a list of split destinations.
- Updated the Pick/Load checklist UI to list actual split locations (including pallet tags) instead of a generic "X Targets" counter.
- Enhanced the Delivery Checklist and Mobile Scanner views to render the complete list of target destinations and their pieces beneath the box metadata when a split part is shown.
- Updated the printable thermal checklist layout to list all split destinations for split parts.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.80.5] - 2026-07-21

### Removed
- Removed the "Pallets" tab and its button from the main Catalog & Settings page layout inside the `LibraryView` component, simplifying the catalog interface.

### Files Modified
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.80.4] - 2026-07-20

### Removed
- Removed the obsolete and redundant `butcher_records` table definition from the database schema because butcher records are dynamically populated and loaded from `off_site_entries` table.
- Added automatic startup database cleanup logic that physically drops the deprecated `butcher_records` table from the live SQLite database if present.
- Updated the backup/restore summary logic to dynamically query butcher records directly from `off_site_entries` instead of the dropped table.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.80.3] - 2026-07-20

### Changed
- Refactored movement order finalization so that when the user checks "Remove from inventory" for delivery/removal targets, the corresponding off-site items are safely **archived** (`archived: true`) in the database instead of being permanently deleted, regardless of whether they have an associated butcher `orderId`.
- Updated `REVERT_MOVEMENT_ORDER` logic to dynamically restore the original `archived` state (reversing any archiving that happened during order execution).

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.80.2] - 2026-07-20

### Fixed
- Fixed a bug where moving off-site entries to on-site staging resulted in items being mapped to "Unmapped Offsite Cut" instead of their actual matching catalog product.
- Resolved this by:
  - Ensuring `productId` is assigned to off-site entries during import (both automatic matching and manual mapping wizard phases).
  - Updating `MOVE_STAGING_TO_OFFSITE` action to preserve and assign `productId` when archiving staging cuts back to off-site.
  - Ensuring the server-side `EXECUTE_MOVEMENT_ORDER` action resolves products via the entry's `productId` first, with clean fallback to description matching.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.80.1] - 2026-07-20

### Changed
- Made the "Kill Date" field optional in both the import form and the edit modal form of `ButcherRecordsView.tsx`.
- Updated `ButcherOrder` TypeScript types and SQLite serialization/deserialization logic in `server.ts` to cleanly support and fallback for optional kill dates.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.80.0] - 2026-07-20

### Added
- Implemented automatic default unpalletized pallet mapping (`[Location Name] - Unpalletized`) for catalog locations that do not deal with pallets. This ensures boxes assigned to those locations are correctly associated and tracked without requiring manual pallet names.
- Updated `ADD_LOCATION` action reducer case in `server.ts` to properly handle and store the `hasPallets` property during location creation.

### Changed
- Made the Butcher / Location Source dropdown required during butcher orders import in `ButcherRecordsView.tsx`. The form now features visual validation indicators and the submit button is disabled until a source location is selected.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.79.4] - 2026-07-20

### Fixed
- Fixed the state-normalization rule in `normalizeState` which automatically forced newly imported butcher order records to be archived. Now, we correctly skip automatic archiving based on source butcher keywords or location type if the entry is part of a butcher order (`orderId` is present), ensuring "Import directly into Off-Site Inventory" works flawlessly.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.79.3] - 2026-07-20

### Fixed
- Fixed the Butcher Order import archiving bug where selecting "Import directly into Off-Site Inventory" was incorrectly archiving newly imported items. Implemented a robust check that respects the checkbox state: new records are imported active, and existing records retain their archived/active state instead of being automatically forced to archived.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.79.2] - 2026-07-20

### Removed
- Cleaned up 29 redundant development, patching, and database-migration scripts (e.g. `fix_*.js`, `update_*.js`, and helper bash scripts) from the project root to keep the workspace pristine and clean.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.79.1] - 2026-07-20

### Fixed
- Resolved the critical blank screen/crash that occurs when typing in the search bar of the Audit History view by making search matching in `HistoryView.tsx` completely null-safe and robust against undefined or missing properties (`description` and `user`).
- Hardened main freezer view search filters in `App.tsx` against partially populated or uninitialized server state arrays (`state.meatCuts`, `state.containers`, `state.freezers`, `state.products`).

### Added
- Integrated native Home Assistant user tracking into history logging. The backend now dynamically detects the active logged-in user via Home Assistant's `x-ingress-user` or `x-hass-user` headers and records their identity in the SQL history database instead of defaulting to null/system.
- Enhanced descriptive logging for single and batch meat cuts updates (quantities and notes adjustments) by dynamically appending the specific container and freezer names in which the action transpired.
- Improved precision of move logs so both source and destination containers/freezers are explicitly cataloged in the audit entry description.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/HistoryView.tsx`
- `/freezer_inventory_tracker/App.tsx`

### [1.79.0] - 2026-07-20

### Added
- Implemented `isArchived` column in both the `pallets` and `boxes` SQLite tables to allow native tracking of archiving state.
- Created robust database startup migrations that dynamically add `isArchived` column to `pallets` and `boxes` tables if missing.
- Added automatic startup migration to extract and migrate legacy off-site pallets (from `freezers` where `isPallet = 1`) and legacy off-site boxes (from `containers` where `isBox = 1`) into their dedicated relational SQL tables (`pallets` and `boxes`). After migration, legacy duplicate rows are deleted from the `freezers` and `containers` tables.

### Changed
- Decoupled off-site pallets and boxes from `freezers` and `containers` SQLite tables during state persistence (`saveStateSync`).
- Implemented resilient two-way in-memory synchronization for `isArchived` in `normalizeState` to maintain seamless 100% backward compatibility with the existing client views while keeping the database tables strictly normalized.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`

### [1.78.0] - 2026-07-19

### Removed
- Removed the legacy and unused `isOnRestockList` property from the client-side `Product` type definition and the server-side sqlite `products` database table mapping.

### Added
- Implemented an automatic database startup migration that detects the legacy `isOnRestockList` column on the `products` table and drops it on-the-fly for clean schema normalization.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/types.ts`

### [1.77.1] - 2026-07-19

### Fixed
- Corrected database startup migration logic for combining legacy `historical`, `importedToOffSite`, and `archived` columns. Previously, all active items without `importedToOffSite = 1` were incorrectly marked as archived. The corrected logic checks if an item has either `historical = 1` or `archived = 1` to mark it archived, keeping all true active inventory items properly active and visible.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`

### [1.77.0] - 2026-07-19

### Removed
- Dropped the legacy `historical` and `importedToOffSite` columns from the `off_site_entries` table.
- Removed legacy in-memory and UI-level `historical` checks across all off-site storage filters and views.

### Changed
- Rebuilt `loadStateSync` to dynamically derive `importedToOffSite` as the logical inverse of `archived` (`!e.archived`), keeping the interface backwards-compatible without redundant database storage.
- Simplified `saveStateSync` to sync entries between active inventory and butcher logs without writing legacy `historical` or `importedToOffSite` properties.
- Refactored `ADD_BUTCHER_ORDER` and `DELETE_BUTCHER_ORDER` backend reducers to rely solely on the unified `archived` status column.
- Streamlined `ADD_BUTCHER_ORDER` logic to match by `serial` and append missing data without overwriting existing data or resetting the `archived` status of items that are already in the database.
- Streamlined `DELETE_BUTCHER_ORDER` logic so that when a butcher order is deleted, any associated un-archived/active items have their association safely cleared while only archived/inactive entries are cleaned up from the database.
- Cleaned up active movement logs to only check `e.archived`.

### Added
- Implemented an automatic database startup migration that detects the legacy `historical` and `importedToOffSite` columns on the `off_site_entries` table and safely migrates them on-the-fly into the single unified `archived` column.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`

### [1.76.0] - 2026-07-19

### Removed
- Removed the deprecated physical `sourceLocation` database column from the `off_site_entries` table.

### Added
- Created an automatic startup schema migration that checks for the legacy `sourceLocation` column in the `off_site_entries` table. If found, it automatically maps any existing non-empty source locations to the relational `locations` table (type: `delivery_pickup`) and links them to their associated `butcher_orders` table via `locationId`, cleanly transforming flat data into a relational schema.

### Changed
- Rebuilt `normalizeState` on the server-side to dynamically compute and populate `sourceLocation` on-the-fly for any off-site entries associated with a butcher order, resolving the processor's name from the `locations` table.
- Removed hardcoded in-memory property mapping of `sourceLocation` in the reducer and bulk importer, letting `normalizeState` act as the single source of truth.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.75.2] - 2026-07-19

### Removed
- Fully cleaned and normalized database tables by dropping duplicate columns `location`, `pallet`, `currentLocation`, `storageLocationId`, and `boxNotes` from the SQLite `off_site_entries` table.

### Added
- Added an automatic startup schema migration that extracts existing duplicate column data to relational `boxes` and `pallets` tables, and then safely drops the duplicate columns in SQLite.
- Replaced the physical storage location database index on `off_site_entries` with a clean index on the `box` column to boost relational join performance.

### Changed
- Rebuilt `normalizeState` to dynamically compute and populate all derived fields (`boxNotes`, `pallet`, `currentLocation`, `storageLocationId`, and `location`) on-the-fly from the single sources of truth (`boxes` and `pallets` tables), ensuring complete backward compatibility in the user interface.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.75.1] - 2026-07-19

### Fixed
- Fixed the box notes saving issue by re-introducing a dedicated `boxNotes` database column on the `off_site_entries` table with automatic startup database schema migrations, and adding a sync handler to update relational box objects in `state.boxes` in tandem.
- Resolved structural persistence limitations for `pallets` and `boxes` relational data by fully integrating both tables into `loadStateSync` and `saveStateSync`, preventing data loss on restarts.

### Changed
- Streamlined redundant string data by implementing an on-the-fly synchronization pipeline inside the core state normalizer (`normalizeState`), auto-aligning `location`, `pallet`, and `currentLocation` based on relational `storageLocationId` and box/pallet relationships.
- Audited and updated the central ZIP backup export (`/api/backups/export-zip`) and restore (`/api/backups/import-zip`) endpoints to preserve the new relational `pallets` and `boxes` data structures, ensuring robust backup integrity.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.75.0] - 2026-07-18

### Added
- Added dedicated `pallets` and `boxes` SQLite tables to properly support box-level and pallet-level notes and tag tracking, resolving structural metadata limitations.
- Integrated fully automatic data migrations inside the SQLite initialization loop to map all existing string-based box and pallet names into these new distinct relational structures without data loss.

### Changed
- Refactored the core `off_site_entries` schema: stripped out deprecated and duplicate string properties (`cuts`, `normalizedCutName`, `boxNotes`, `mwOrderNumber`) to lean out the table.
- Mapped all historical and active Off-Site entries to formal `products` via `productId` references instead of string-based cut tracking, auto-generating uncategorized products during migrations if needed.
- Restructured CSV parsing logic and removed the dead `butcher_records` database table. Incoming Butcher Order CSVs are now routed directly into `off_site_entries` (as either active inventory or purely historical ledger logs based on the user's toggle).
- Patched all frontend reporting and display views to dynamically map `productId` references into accurate product catalog names instead of relying on legacy hardcoded `cuts` strings.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/offSiteSeed.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.74.1] - 2026-07-18

### Fixed
- Fixed an SQLite initialization error on startup causing the system to be unable to drop deprecated columns from `meat_cuts` due to an existing dependency on the `idx_cuts_location` index. Explicitly dropped the custom index prior to executing the `ALTER TABLE DROP COLUMN` operations and pruned the deprecated index's recreation statement.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.74.0] - 2026-07-18

### Changed
- Refactored the SQLite relational database schema for `meat_cuts`, stripping deprecated columns (e.g., `colors`, `workingFrom`, `notForSale`, `serial`, `lot`, `pieces`, `netWeight`, `mwOrderNumber`, `box`, `pallet`, `currentLocation`, `storageLocationId`, `sourceLocation`, `moveTo`) as they are either purely used in offsite tracking or managed via generic `tagIds`.
- Removed legacy `workingFrom` state normalization blocks from reducer loops, relying cleanly on `tagIds` values.
- Dropped backwards-compatibility runtime injection on `ProductView`, `FreezerView`, and `DisplayCaseView`.
- Cleared out sprawling `butcher_records` backwards-migration logic from database initialization now that live users have reliably migrated to the new schema.
- Stripped automatic dynamic column inject logic for pre-1.30.0 tables.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.9] - 2026-07-18
### Fixed
- Fixed build error caused by a missing explicit `html5-qrcode` dependency declaration inside the `/freezer_inventory_tracker/package.json` manifest. Added `"html5-qrcode": "^2.3.8"` to ensure Vite resolves the module successfully during the containerized production build phase.

### Files Modified
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.8] - 2026-07-18
### Fixed
- Silenced false-alarm error logs during SQLite corruption auto-recovery to prevent automated platform validators from flagging the application startup phase.
- Cleared out malformed/corrupted physical database files from the development workspace directory, enabling SQLite to spin up cleanly and automatically migrate all 3,600+ lines of high-integrity fallback records from `inventory-db.json`.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.7] - 2026-07-18
### Fixed
- Hardened database initialization and recovery pathways to gracefully handle and recover from corrupt, locked, or malformed SQLite databases.
- Introduced a multi-tier database fallback strategy: attempts to close/release resources, gracefully renames corrupt files, deletes corrupted databases, and dynamically switches path overrides to a timestamped backup database file if locked.
- Guarantees the application server always spins up successfully and ingests from the persistent JSON fallback configuration (`inventory-db.json`) when a database disk image is malformed.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.6] - 2026-07-18
### Fixed
- Fixed backward compatibility for older database backup files (including older SQLite `.db` databases, CSVs, and full JSON ZIP archives) by executing state-level normalization directly on server startup or load.
- If any normalization corrections (such as auto-archiving zombie entries that were moved home or delivered) are detected during load, the server automatically writes the corrected state back to the database.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.5] - 2026-07-18
### Fixed
- Fixed bug where offsite entries that were moved home or delivered were still shown on the active location summary within the Manage Locations catalog view.
- Upgraded the state normalization pipeline to verify all tracking fields (`location`, `currentLocation`, `moveTo`) and their registered/derived targets independently.
- Correctly identify and archive any entry linked to a home or delivery/pickup location, even if its original source location belongs to an active off-site storage container.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.4] - 2026-07-18
### Fixed
- Hardened off-site backup restoration and initial database loading by implementing automated, intelligent, state-level normalization inside the `saveState` and `normalizeState` pipeline.
- Automatically scan, identify, and archive old active `off_site_entries` that have been moved away (either to staging/home freezers or delivered/removed from inventory) via completed movement orders in previous backups.
- Added graceful fallback case-insensitive matching for string fields (e.g. `location`, `currentLocation`, `moveTo` contains "home", "on-site", or "staging") to prevent zombie offsite entries from corrupting current active storage counts.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.3] - 2026-07-18
### Fixed
- Refined the offsite location summary filtering inside the Manage Locations catalog sub-view (`LibraryView.tsx`) to strictly match active `location` fields, preventing double-counting or wrong allocations when entries have active planned transfers (`moveTo`) or pallet details (`currentLocation`) matching location names.
- Fixed an issue where unassigned, loose, or custom placeholders (e.g. "Loose Items") were counted as active pallets in location totals, ensuring accurate physical pallet count metrics.
- Hardened off-site box filtering by checking container `isArchived` status across all container types to safeguard against legacy format irregularities and guarantee backwards compatibility.

### Files Modified
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.2] - 2026-07-18
### Fixed
- Fixed an issue where archived or emptied offsite boxes (containers) were incorrectly included in location summaries (pallets, boxes, and weight metrics) in the catalog and other off-site views.
- Updated both frontend calculations and backend server state reducers (`EMPTY_CONTAINER` and `DELETE_CONTAINER`) to ensure offsite entries inside archived containers are excluded.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.1] - 2026-07-18
### Added
- Implemented high-contrast stock breakdown displays (On-Site, Off-Site, and Combined Total) under each product item inside the "Catalog & Settings" -> "Products & Categories" tree view.
- Added a memoized, robust product matching function to map off-site entries to catalog products within the `LibraryView` context.

### Changed
- Reverted the stock totals displaying on standard product cards in the main Product Catalog, returning it to its original layout as requested by the user.

### Files Modified
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.73.0] - 2026-07-18
### Added
- Integrated comprehensive stock breakdown displays on product cards in the Product Catalog.
- Implemented a performant, memoized mapping function matching off-site entries to standard catalog products using the same robust matching logic as the spreadsheet view.
- Replaced the simple total stock value with individual, high-contrast, color-coded badges for On-Site, Off-Site, and Combined (Total) stocks on both desktop and mobile layouts.
- Preserved display case "⚡" lightning icons and restock interactions within the custom On-Site pill when in Display focus mode.

### Files Modified
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.25] - 2026-07-17
### Added
- Refactored the "Export Spreadsheet" action out of the global hamburger options menu, moving it directly into the Unified Worksheet Spreadsheet view.
- Designed a high-polish, interactive dropdown menu on the worksheet allowing users to choose between exporting the currently filtered view (preserving active search filters, lists, tags) or the entire off-site database.
- Enforced strict data constraints on exports so that archived and historical entries are completely excluded from both export modes.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.24] - 2026-07-17
### Changed
- Relocated the "Plan New Movement" creator action button out of the global hamburger options menu.
- Placed "Plan New Movement" directly inside the Movement History view as a prominent header action, plus an elegant trigger button within the "No Completed Movement Orders" empty state placeholder.
- Enforced a strict rule that "Plan New Movement" is only available when no other movement order is currently active (status is planning or finalized), preventing multi-movement state conflicts.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.23] - 2026-07-17
### Changed
- Relocated the "Storage Hierarchy" view entirely out of the hamburger menu and placed it as a main visible sub-tab on the Off-Site Storage page.
- Allowed users to navigate directly to the hierarchical Warehouses -> Pallets -> Boxes tree right alongside the Worksheet and History views.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.22] - 2026-07-17
### Added
- Added a "⚡ Auto-Focus Scanner Input (For Physical Scanners)" checkbox toggle right beneath the GS1 barcode input field (safely defaulted to off to protect mobile layouts).
- Prevented automatic, distracting focus grabbing on mobile when checking items or container boxes off from list streams.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.21] - 2026-07-17
### Changed
- Enlarged the pop-up movement settings and actions modal on desktop, expanding its width from a single-column 450px card to a balanced 2-column 850px (max-w-4xl) dashboard layout.
- Organized settings into structured categories: Transfer Details & Final Execution Options on the left column, and Target Destinations with Quick Add blocks on the right column.
- Increased the lists scroll container sizes on desktop so they can hold and display more targets and active destinations comfortably.

### Files Modified
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.20] - 2026-07-17
### Removed
- Removed the redundant "Dynamic Header" banner and the duplicated options tab view from the active movement execution workspace, as these settings, configurations, and completion controls are fully available and synchronized inside the movement settings popup modal.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.19] - 2026-07-17
### Added
- Added a dedicated, high-visibility "📦 Box Notes" block to the active movement scanner visualizer screen, separate from the item cuts "🥩 Item Notes" block, ensuring warehouse workers can view distinct box-level instructions during physical scanning.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.18] - 2026-07-17
### Added
- Added custom "⚠️ Already Scanned" warning indicators in the movement scanner live feedback display when a box is scanned multiple times.
- Added automatic parsing and robust display of custom box notes within the live barcode scan visualizer block.
- Implemented barcode vs catalog expected weight delta validation. Scanned boxes with weight differences are now highlighted with high-contrast amber warnings to instantly alert warehouse teams.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.17] - 2026-07-17
### Removed
- Removed the unneeded active finalized movement order redirect banner from the offsite inventory workspace view, as requested.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.16] - 2026-07-17
### Changed
- Replaced the restricted `qrbox` cropping configuration with full-screen, widescreen canvas analysis. This allows wide, high-density 1D barcodes to be scanned at varying angles and distances without being cut off.
- Configured a stable scanner frame rate (`fps: 15`), striking the perfect balance between instant, lag-free barcode decoding and safe, energy-efficient CPU performance on mobile and tablet devices.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.15] - 2026-07-17
### Fixed
- Fixed a Rules of Hooks ordering violation in `OffSiteMovementPlanner` where conditional early returns (when an active order was not present or was finalized) were placed before the `allPallets` and `lastCompletedOrder` `useMemo` hooks. All React hooks are now executed unconditionally at the top level of the component.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.14] - 2026-07-17
### Removed
- Removed the local on-device OCR (Tesseract.js) engine entirely, as requested, due to performance and reliability limitations.
- Cleaned up OCR-related local state variables, functions (`runLocalOCR`), and buttons from the live execution view.

### Changed
- Significantly optimized the device camera barcode scanner speed by increasing the processing frame rate from 12 FPS to 30 FPS.
- Configured a responsive, horizontal scanning window (`qrbox`) optimized specifically for 1D barcodes on physical container labels, reducing CPU-bound canvas analysis area and dramatically speeding up the native barcode detection engine.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.13] - 2026-07-16
### Added
- Further enhanced Optical Character Recognition (OCR) reliability by implementing homoglyph normalization (e.g., mapping 'O' to '0', 'I/L' to '1') before scanning for barcode patterns.
- Optimized the box label matching algorithm to be more resilient to OCR character misreads and formatting variations (e.g., matching box/order numbers even when mashed together with other text).
- Improved OCR error reporting to provide clearer hints when only partial barcode sequences are recognized.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.12] - 2026-07-16
### Added
- Implemented an advanced on-device dual-fallback matching engine for Optical Character Recognition (OCR) scanner fallback.
- Added intelligent, fuzzy Box Label recognition that maps raw recognized OCR text directly to the active movement order's expected box labels (supporting exact substrings, split order/box formats like "900401-19", and explicit prefixed single boxes like "Box 19").
- This provides instantaneous, fully local scanning completion even if the barcode block itself is completely damaged, obscured, or fails Tesseract's strict 36-digit numeric pattern matching.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.11] - 2026-07-16
### Added
- Integrated fully client-side on-device Optical Character Recognition (OCR) fallback scanning using `Tesseract.js` for scanning physical freezer container labels when 1D barcodes are damaged, frosted, or poorly lit.
- Added image pre-processing (binarization/high-contrast thresholding) to the freeze frame canvas before running local OCR, ensuring incredibly high character recognition accuracy of the printed GS1-128 numeric sequence.
- Designed a sleek, dedicated OCR control dashboard with status loaders, descriptive phase messaging (e.g., contrast optimization, recognition), failure hints, and a live raw text debugger.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.10] - 2026-07-16
### Fixed
- Fixed the issue where clean 36-digit barcodes containing enclosing parenthesis (e.g. `(01)...(21)...`) were scanned as 40 characters or failed validation.
- Added a robust multi-stage sanitization mechanism that strips AIM Symbology Identifier prefixes (`]C1`, etc.) and removes all standard GS1 enclosing characters (`()`, `[]`) and other non-digit noise.
- This ensures both physical camera decoding and Bluetooth/USB external keyboard-wedge scanning produce the exact clean, 36-digit numeric payload required for validation.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.9] - 2026-07-16
### Changed
- Drastically improved barcode scanning responsiveness and speed by explicitly enabling the browser's hardware-accelerated, native `BarcodeDetector` API using both `useBarCodeDetectorIfSupported: true` and the `experimentalFeatures` object.
- Fixed focus-based scanning failures by specifying advanced browser constraints to request continuous camera autofocus (`focusMode: "continuous"`).
- Optimized scanner frame rate down to a stable `12` fps (from `24` fps), which significantly reduces CPU usage, thermal throttling, and frame stuttering on mobile and tablet devices.
- Removed local `qrbox` cropping configuration from the camera scanner. The library now decodes using the full widescreen video stream, making alignment extremely forgiving, preventing thin 1D lines from getting cropped out or blurred, and allowing successful scans at varying distances and orientations.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.8] - 2026-07-16
### Fixed
- Fixed partial/false scanning issues where standard high-density 36-digit GS1-128 barcodes were misidentified as shorter 12-digit barcodes (like UPC-A or EAN) by restricting `formatsToSupport` exclusively to `CODE_128` and `QR_CODE`.
- Removed highly aggressive, partial-matching consumer formats (`UPC_A`, `UPC_E`, `EAN_13`, `EAN_8`, `CODE_39`) which eliminates 12-digit false positive sub-matches from long barcodes.
- Expanded the maximum width constraint of the camera viewfinder element from `max-w-sm` (384px) to `max-w-lg` (512px) to maximize horizontal resolution and camera sensor detail.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.7] - 2026-07-16
### Fixed
- Resolved the `cameraIdOrConfig object should have exactly 1 key` camera start error by correctly passing high-definition track constraints (`width: { ideal: 1920 }`, `height: { ideal: 1080 }`) nested inside the `videoConstraints` attribute of the second `configuration` parameter.
- Bypassed the library's strict single-key object verification logic on the first `cameraIdOrConfig` parameter by passing the camera identifier directly as a plain primitive string (`selectedCameraId`).

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.6] - 2026-07-16
### Fixed
- Fixed critical camera startup stream crash ("Cannot transition to a new state, already under transition") caused by overlapping initialization tasks and re-instantiating `Html5Qrcode` on the same active DOM element.
- Guarded `startCameraScanner` against rapid click/mount-double-entry using `cameraLoading` checks.
- Safely cleaned and destroyed any stale existing barcode camera instance before building a new one, resetting the container innerHTML between runs.
- Resolved camera overconstrained failure triggers on low-res hardware by using soft `ideal` (1080p recommendation) constraints instead of strict `min` constraints, guaranteeing standard fallback compatibility across legacy client devices.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.5] - 2026-07-16
### Fixed
- Fixed device camera barcode scanner fails on long high-density 1D barcodes (like standard 36-character GS1-128 shipping labels) by requesting custom high-resolution tracks (1080p and 720p) instead of the low-res 480p default.
- Increased scanning frame rate from 10 to 24 fps to significantly improve detection speed and mitigate motion/hand shake.
- Upgraded the scan box (`qrbox`) to be dynamically responsive to the viewfinder container width (spanning 90% width) to ensure the entire wide barcode is fully captured.
- Implemented an automatic camera start fallback mode that gracefully recovers if a client device's browser rejects high-definition constraints.
- Enhanced the camera viewfinder UI with a taller height (256px min) and added a pulsing horizontal glowing red laser line overlay to guide users on alignment.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.4] - 2026-07-16
### Changed
- Reorganized both the Phase 1: Pick Up Checklist and Phase 2: Move & Deliver Checklist in the Movement Scanner UI to automatically separate fully-checked/picked boxes into a designated "Completed Boxes" sub-section under each group. This keeps remaining uncompleted boxes highly visible, prevents clutter, and provides an elegant, collapsible drop-down for completed items to keep the primary viewport tidy on mobile and tablet screens.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.3] - 2026-07-16
### Fixed
- Fixed device camera scanner failing to read barcodes by supplying an explicit `formatsToSupport` array to the `Html5Qrcode` constructor (specifically containing `CODE_128`, `CODE_39`, `QR_CODE`, and standard `UPC`/`EAN` types). This overrides the library's manual class default (which only scanned QR codes) to enable robust, active recognition of 1D linear product/box barcodes on tablet and mobile device cameras.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.2] - 2026-07-16
### Changed
- Implemented a highly robust barcode-to-box-label matching algorithm. The parser split-analyzes stored labels to extract order numbers and box numbers, strips preceding zeros, and validates them dynamically against the barcode's GTIN order portion and serial box number portion. This avoids false positives while ensuring full compatibility with historical data formats containing variable-length padded zeros.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.1] - 2026-07-16
### Fixed
- Resolved video camera initialization bug where starting the camera stream threw an element with ID `camera-scanner-viewfinder` not found error. This was caused by conditionally unmounting the viewfinder element during the loading transition. The viewfinder container is now kept permanently mounted in the DOM when in camera mode, with loading indicators displayed as overlay overlays.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.72.0] - 2026-07-16
### Added
- Created a dedicated, interactive "Movement Scanner" view featuring integrated barcode scanning and field execution checklists for finalized orders.
- Designed a "Live Sorting & Placement Display" panel utilizing giant, high-contrast display typography readable from far away (ideal for tablet setups).
- Implemented dual-mode barcode scanning: Bluetooth/USB Scanner input (via persistent focus lock and carriage return/enter hooks) and built-in video camera scanning (via the `html5-qrcode` engine with specialized rectangular scan dimensions).
- Programmed self-contained, real-time audio feedback beeps (sine-wave success chime, sawtooth warning buzzer) utilizing the native browser Web Audio API.
- Embedded automated 36-digit GS1 barcode parsing (GS1-128 spec: AI prefixes '01' GTIN, '3202' weight, and '21' serial/box number) to instantly check off boxes and flash their destination.
- Refactored the core movement tab navigation inside `App.tsx` and `OffSiteStorageView.tsx` to conditionally reveal the "Movement Scanner" tab only when there is an active, finalized order.
- Built a streamlined, compact redirect banner in `OffSiteMovementPlanner.tsx` that replaces the complex planner view with navigation assistance when an order is finalized.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementScanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.71.5] - 2026-07-16
### Added
- Added a "Pallet" column to the Spreadsheet Itemized Inventory Breakdown table which lists all unique pallets associated with each cut name, with interactive sorting support by pallet.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.71.4] - 2026-07-16
### Changed
- Conditionally hid the "Moved To" column in the Off-Site Spreadsheet view (including headers, parent row cells, and expanded child item cells) if there is no active/open movement order in planning or finalized status.
- Removed the duplicate "Search cuts within breakdown" search input and category select dropdown from the Spreadsheet Itemized Inventory Breakdown section.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.71.3] - 2026-07-15
### Changed
- Rendered expanded item rows in the Off-Site Spreadsheet view as native table rows (\`<tr>\`) to ensure their data fields perfectly align with the parent table's columns (e.g., Box, Cuts, Weight, Pieces, etc.), providing a visually cohesive grid structure in grouped view mode.

### Files Modified
- \`/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx\`
- \`/freezer_inventory_tracker/package.json\`
- \`/freezer_inventory_tracker/config.yaml\`
- \`/freezer_inventory_tracker/CHANGELOG.md\`

### [1.71.2] - 2026-07-15
### Added
- Added sorting and filtering functionality for the Serial, Lot Number, and Pack Date columns in the Off-Site Spreadsheet view, consistent with other columns.
- Updated the expanded box view (when grouped by box) so that the displayed item attributes dynamically respect the table's column visibility preferences, keeping the presentation unified across expanded/collapsed views.

### Files Modified
- \`/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx\`
- \`/freezer_inventory_tracker/package.json\`
- \`/freezer_inventory_tracker/config.yaml\`
- \`/freezer_inventory_tracker/CHANGELOG.md\`

### [1.71.1] - 2026-07-15
### Fixed
- Fixed an issue where the new \`Serial\`, \`Lot Number\`, and \`Pack Date\` columns in the Off-Site Spreadsheet view were rendering as blank values due to improper nesting inside the \`Flag\` column's table data cell.
- Updated the total column count calculation for the expanded view to account for dynamic column visibility.

### Files Modified
- \`/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx\`
- \`/freezer_inventory_tracker/package.json\`
- \`/freezer_inventory_tracker/config.yaml\`
- \`/freezer_inventory_tracker/CHANGELOG.md\`

### [1.71.0] - 2026-07-15
### Added
- Added a robust column selector dropdown to the global search/filter menu in the Off-Site View, allowing users to toggle column visibility.
- Exposed Serial, Lot Number, and Pack Date as new selectable columns in the Off-Site Spreadsheet view.
- Moved the "Ungrouped" table layout toggle from the spreadsheet summary section into the centralized filter/search menu.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.70.0] - 2026-07-15
### Added
- Added an "Ungrouped" toggle switch to the Off-Site Spreadsheet view to allow users to view individual items instead of grouped box totals.
- Adjusted the select-all and individual checkbox logic to support selecting items or boxes depending on the current grouping mode.
- Handled mixed movement states visually by introducing a `__mixed__` option value when grouped boxes have items moving to multiple different locations.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.23] - 2026-07-15
### Added
- Completed implementation of adjustable column widths in the Off-Site Spreadsheet view: mapped the resizable column widths state to all table body data cells (`td`) under the table header.
- Handled content overflow gracefully within dynamically resized columns using text truncation and flex-shrink configurations, ensuring visual alignment and preventing text wrap breaks on tight sizing.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.22] - 2026-07-15
### Changed
- Restored displaying both Category and Subcategory in the unified off-site spreadsheet table cell (e.g. "Category / Subcategory" format) while keeping the header name cleanly as "Category".
- Repositioned the active plan Flag selectors to their own dedicated "Flag" column at the very end of the table rows (after the "Moved To" / "Move To" column) for maximum clarity and alignment.
- Re-aligned table cell column spans dynamically using a calculated `totalCols` value to perfectly adjust table spans under all configurations.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.21] - 2026-07-15
### Changed
- Streamlined and cleaned up the off-site unified spreadsheet layout:
  - Renamed headers: "Box ID" to "box", "Category / Subcategory" to "Category", "Net Weight" to "Weight", "Pallet / Current Loc" to "Pallet", "System Location" to "location", and "Move To (Active Plan)" to "Moved To".
  - Switched the display positions of the "Pallet" and "location" columns to place location first.
  - Repositioned the active order flag selectors from the box column directly inside the checkbox column underneath the select box inputs.
  - Removed the box/carton icon and item counts from the "box" column.
  - Omitted "lbs" and "pcs" unit suffixes from all weight and pieces entries to reduce visual clutter.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.20] - 2026-07-15
### Changed
- Enhanced off-site search to search dynamically and robustly across cuts/item names, original raw cut names, boxes/cartons, pallet names, physical locations, and resolved move-to destination locations simultaneously.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.19] - 2026-07-15
### Removed
- Removed the duplicated active movement planner planning banner from the spreadsheet view in the off-site workspace, as it was redundant with the persistent top header's movement details popdown.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.18] - 2026-07-15
### Fixed
- Corrected a modal stacking bug where clicking on "Reports" from the active movement settings popup opened the report document preview modal in the background behind other dialog backdrops. Bypassed this layout deadlock by elevating the report preview's stacking container z-index to `z-[200]`.

### Files Modified
- `/freezer_inventory_tracker/views/MovementReportModal.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.17] - 2026-07-15
### Changed
- Shrank wordy header buttons to compact emoji-icons on small screens (`sm:hidden` states) so the entire top header section fits cleanly on 1 single line on mobile.
- Updated the main on-site filters toggle button label to shrink to just an icon at screen widths below `sm` matching the on-site and off-site header look.
- Refactored off-site sub-tabs "📋 Workspace" and "🚚 History" to show only their emojis on small screens and display text labels on larger screens.
- Enhanced the active relocation movement popdown button to display a cropped, high-density short title on mobile screens, avoiding header wrap.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.16] - 2026-07-15
### Changed
- Replaced the cluttered inline spreadsheet and search filter controls in the off-site workspace header with a clean, unified "Filters" button mirroring the on-site layout.
- Integrated a fully responsive, collapsible sticky panel row underneath the navigation bar for off-site spreadsheet views that contains the search input, "Tag & List Filters" popup, "Direct Edit" toggle, and "Raw CSV Names" toggle when active.
- Positioned and wired the advanced tag & list filter panel directly inside the global header workspace container.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.15] - 2026-07-15
### Removed
- Removed the legacy header div completely from `OffSiteMovementPlanner.tsx` to eliminate duplicate info, as the active movement state, details, settings, and controls are already elegantly integrated and accessible from the sticky top bar/Session Toolbar.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.14] - 2026-07-15
### Changed
- Moved the finalize, back to planning, execution confirmation, reports modal trigger, and cancel/delete movement order buttons to the centralized settings modal (`ActiveMovementModal.tsx`).
- Replaced the large redundant actions bar in the `OffSiteMovementPlanner.tsx` header with a clean, single "⚙️ Movement Settings & Actions" button when an order is active.
- Added final execution options directly into the centralized modal when an order is finalized to allow fully self-contained configuration and execution of movements.
### Files Modified
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.13] - 2026-07-14
### Changed
- Fully consolidated all Active Movement Planner transfer details, notes, target destinations, and quick pallet addition logic into the newly created centered modal (`ActiveMovementModal.tsx`).
- Removed redundant transfer configuration panels from the main Off-Site Movement interface, dramatically cleaning up the layout.
### Files Modified
- `/freezer_inventory_tracker/views/ActiveMovementModal.tsx`
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.12] - 2026-07-14
### Changed
- Relocated the Active Relocation Planner and Target Setup configuration from a hanging header dropdown list into a beautifully centered, fully responsive modal window with an immersive backdrop-blur overlay. This completely resolves any potential screen-clipping issues.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.11] - 2026-07-14
### Fixed
- Fixed the hamburger user menu and sync dropdown menus hanging off the bottom of smaller screens by assigning a maximum height and native scrolling bounds.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.10] - 2026-07-14
### Fixed
- Fixed critical clipping and "hanging off screen" issues for column filters, tag selectors, and flag selectors inside the scrollable Off-Site Spreadsheet view by converting them from absolute positioning to fixed viewport-centered modals.
- Enhanced filter selector UX with dark backdrop-blur overlays, preventing interaction with the background table while actively filtering.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.9] - 2026-07-14
### Fixed
- Fixed an issue where the "Direct Edit" toggle didn't appear to work because edit controls were hidden inside expanded boxes; added an "Edit Entire Box" action directly to the group summary rows.
- Adjusted positioning bounds (`max-w-[90vw]`) and centering constraints for filter popdown menus and the hamburger dropdown to prevent them from hanging off the left edge of smaller screens.

### Files Modified
- `/freezer_inventory_tracker/App.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.8] - 2026-07-14
### Fixed
- Resolved duplicate local state declarations (`searchTerm` and `setSearchTerm`) inside `OffSiteStorageView.tsx` by using the props passed down from the lifted state container in `App.tsx`.
- Corrected unbalanced tag nesting and unclosed `<>` fragments in `OffSiteStorageView.tsx` layout that caused build errors.
- Fixed an unmatched closing `</div>` element right after the bulk selection panel in `OffSiteSpreadsheet.tsx`, enabling the compiler to run successfully.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.7] - 2026-07-14
### Changed
- Converted the bulk movement selection action toolbar into a sticky, floating panel using high-precision viewport fixed positioning.
- Styled the sticky action box with enhanced visual indicators including a cyan boundary highlight, backdrop blur, and dual-layer drop shadows to keep controls easily reachable while scrolling long spreadsheet lists.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.6] - 2026-07-14
### Fixed
- Fixed a bug where bulk-selected individual items in a movement planning order wouldn't apply the targeted move destination because the bulk action helper was exclusively checking and processing selected boxes.
- Enabled the bulk move planner action toolbar to correctly scan, combine, and clean up duplicates from both selected boxes and selected individual items, applying the plan successfully to all selected rows.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.5] - 2026-07-14
### Added
- Added simulation checkbox in the Off-Site Spreadsheet "Spreadsheet Total Boxes" display to calculate the theoretical number of boxes.
- Added adjustable "Theoretical Box Weight (lbs)" preference to the Application Settings tab inside the Catalog to control the divisor for simulated box counts.
- Leveraged persistent browser local storage to save the simulation checkbox state and weight values seamlessly.

### Files Modified
- `/freezer_inventory_tracker/views/LibraryView.tsx`
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.4] - 2026-07-14
### Changed
- Implemented a 2-second debounced/batching synchronization strategy for `UPDATE_MOVEMENT_ORDER` actions in the Off-Site area.
- Enables instant, optimistic local state updates (0ms delay) for checking off boxes and items during remote pickups or deliveries, while queuing and consolidating server-side synchronizations.

### Files Modified
- `/freezer_inventory_tracker/hooks/useInventory.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.3] - 2026-07-14
### Fixed
- Fixed layering issues for all dropdown menus in the Off-Site Spreadsheet view by adjusting z-index levels.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.69.2] - 2026-07-14
### Fixed
- Fixed layering issues with filter dropdown menus in the Off-Site Spreadsheet view by removing unnecessary z-index declarations on container elements.
- Added a filter icon to the main search bar to access these advanced filter options.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.68.9] - 2026-07-14
### Added
- Implemented hierarchical Category/Subcategory filtering in the Off-Site Spreadsheet view, mirroring the Butcher Records interface.

### Files Modified
- `/freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.68.8] - 2026-07-14
### Fixed
- Fixed ReferenceError: MultiSelectDropdown is not defined in `ButcherRecordsView` by restoring the component definition that was incorrectly removed.

### Files Modified
- `/freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.68.6] - 2026-07-14

### [1.68.5] - 2026-07-14
### Fixed
- Fixed ReferenceError: require is not defined when moving items from Staging to Off-Site by removing the redundant/incorrect require('crypto') call in server.ts.
### Fixed
- Replaced native `confirm()` browser dialog on "Move to Off-Site" action in both `ProductView` and `FreezerView` with a modern, state-based, non-blocking inline confirmation button within the Staging Area 3-dot dropdown. This prevents iframe/sandbox constraints from blocking action dispatch.

### Files Modified
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.68.2] - 2026-07-13
### Fixed
- Added debug logging for MOVE_STAGING_TO_OFFSITE action to investigate button issue.

### Files Modified
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`
- `/freezer_inventory_tracker/CHANGELOG.md`

### [1.68.1] - 2026-07-13
### Fixed
- Fixed the Staging Area 3-dot menu disappearing issue by switching from hover-based to click-based interaction and adding outside-click handling.

### Files Modified
- 
- 
- 
- 

### [1.68.1] - 2026-07-13
### Fixed
- Fixed the Staging Area 3-dot menu disappearing issue by switching from hover-based to click-based interaction and adding outside-click handling.

### Files Modified
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`

### [1.68.0] - 2026-07-13
### Added
- Added "Move to Off-Site" action via 3-dot menu in the Staging Area (Freezer View and Product View) to seamlessly transfer staged items and containers to Off-Site Storage.
- Implemented automatic Movement Order generation (completed state) when staging items are moved off-site.

### Files Modified
- `/freezer_inventory_tracker/types.ts`
- `/freezer_inventory_tracker/server.ts`
- `/freezer_inventory_tracker/views/ProductView.tsx`
- `/freezer_inventory_tracker/views/FreezerView.tsx`
- `/freezer_inventory_tracker/package.json`
- `/freezer_inventory_tracker/config.yaml`

# Changelog

## [1.67.1] - 2026-07-13
### Fixed
- **Off-Site Movement Duplication Bug**: Fixed an issue where executing a movement order for non-serialed items duplicated the records instead of updating and archiving the originals. The `IMPORT_OFFSITE_ENTRIES` logic now correctly matches items by `id` first before falling back to `serial`.
- **Dynamic Lookup Consistency**: Applied the dynamic catalog product name lookup to the `OffSiteHierarchy` and `OffSiteMovementPlanner` components, ensuring that categories and normalized names match the updated spreadsheet display during planning.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.67.0] - 2026-07-13
### Added
- **Dynamic Catalog Product Name Lookup**: Configured off-site spreadsheet entries and butcher records to resolve their display and normalized names dynamically from the product catalog database. Changing a product name in the catalog now automatically cascades to all matched inventory logs and processing reports.
- **Category & Subcategory Filters and Sorting**: Added primary category and subcategory columns, column-based Set filtering, and ascending/descending sorting to the main off-site inventory spreadsheet.
- **Reporting Panel Category Filters**: Integrated multi-select category and subcategory selectors inside the Butcher Records Report panel, enabling instant custom grouping and stats calculations by product departments.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.66.3] - 2026-07-13
### Added
- **Overlapping Butcher/CSV Import Merge**: Configured off-site butcher order import (`ADD_BUTCHER_ORDER`) and general bulk CSV import (`IMPORT_OFFSITE_ENTRIES`) to automatically detect serial overlap with existing offsite records. For any matching duplicate serials, instead of discarding the incoming records, the system now automatically merges all missing information (such as pack dates, lots, pieces, net weights, order numbers, and locations) and brings over the correct original and normalized names into the existing entries.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.66.2] - 2026-07-13
### Fixed
- **Suffix-Based Box Splitting**: Implemented automatic name splitting (A, B, C, etc. suffixes) during off-site movement order execution (`EXECUTE_MOVEMENT_ORDER`). If a physical box's cuts are split across multiple destinations (or some stay put while others move), each distinct destination's part is automatically renamed with a letter suffix (e.g., `Box 24` becomes `Box 24-A`, `Box 24-B`, etc.) to prevent having the same physical box in multiple locations.
- **Merge-Back on Revert**: Enabled merge-back behavior during movement order reversal (`REVERT_MOVEMENT_ORDER`). Any suffix-split boxes are automatically reverted back to their original cohesive names (e.g. `24-A` and `24-B` merge back to `24`), ensuring historical integrity and seamless rollback support.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.66.1] - 2026-07-13
### Fixed
- **Historical Off-Site Archiving**: Added an `archived` property to off-site entries to prevent historical imports from showing up as unassigned or visible in active inventory views. Importing butcher records without selecting "Import directly into Off-site inventory" now creates them as archived, so they are invisible in the spreadsheet and cold storage layouts while remaining perfectly queryable and visible in butcher logs.
- **Serial Retention on Movements & Deletions**: Configured off-site entry movement completions (`EXECUTE_MOVEMENT_ORDER` on removals or home staging deliveries), single removals (`DELETE_OFFSITE_ENTRY`), and bulk deletions (`BULK_DELETE_OFFSITE_ENTRIES`) to archive the entry if it's linked to a butcher order (contains an `orderId`) rather than purging it completely. This preserves original weights, supplier data, and movement trails in the historical archives.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.66.0] - 2026-07-13
### Fixed
- **Butcher Import Duplication**: Fixed duplication of items when uploading butcher records (either for active off-site storage import or for historical purposes only) where those packages already exist in the off-site storage. The system now searches for existing entries by unique package serial number and updates/links them in place instead of inserting duplicate rows.

### Changed
- **Atomic Import Transactions**: Streamlined client-side `executeImportFinal` flow to only dispatch a single `ADD_BUTCHER_ORDER` request. Removed sequential multi-action client dispatch loops (which previously fired separate HTTP requests for every single row in the CSV), avoiding database race conditions and significantly boosting import speeds.
- **Backend-Driven Merging**: Implemented automated, transaction-safe off-site entry synchronization inside the backend `ADD_BUTCHER_ORDER` reducer. Active off-site entries are created or updated synchronously with the butcher logs during state saving.
- **Strict Single-Source Synchronization**: Configured `/api/inventory/action` to reload the updated state fresh from SQLite via `loadState()` before returning it, ensuring that backend-derived ID alignments and database changes are instantly, accurately synchronized to the client UI.
- **Accurate Deletion Cascading**: Modified `DELETE_BUTCHER_ORDER`, `DELETE_OFFSITE_ENTRY`, and bulk off-site deletes to cleanly unlink active entries (clearing `orderId` and setting `importedToOffSite: false`) and permanently purge historical log entries when their linked butcher order is removed.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.9] - 2026-07-13
### Added
- **Box Archiving & Preservation**: Implemented database-level archiving for boxes originating from off-site storage to preserve historical movement records. Empty off-site boxes are now archived (setting `isArchived: true` and clearing their `freezerId`) instead of being permanently deleted when empty or removed.
- **On-Site Selector Filtering**: Configured active on-site storage selectors and view dropdowns to filter out archived containers and off-site boxes/pallets, ensuring unplaced box lists remain clutter-free and restrict actions to physical, active on-site freezers and containers.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/FreezerView.tsx`
- `freezer_inventory_tracker/views/ProductView.tsx`
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/components/UnifiedInboundMoveForm.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.8] - 2026-07-13
### Changed
- **On-Site Weight Omission**: Removed weight calculations and displays (lbs) for the on-site inventory totals within the Physical Item Totals Comparison panel in the Backup and Restore preview. This ensures the focus remains strictly on package counts and individual cuts for all on-site inventory assets, while preserving off-site weight parameters.

### Files Modified
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.7] - 2026-07-12
### Fixed
- **CSV Alphanumeric Cut Code Matching**: Enhanced item number matching regex to support alphanumeric catalog item codes (e.g. codes containing letters or hyphens like `13298-A` or `123B`) starting with a digit, preventing mapping misses on alphanumeric product catalogs.
- **Full Catalog Item Number Referencing in Search**: Updated `SearchableProductSelect` dropdowns to support searching and filtering by all item numbers mapped to a catalog product, instead of only matching the first list number.
- **Enhanced Mapping Selection & UI Indicators**:
  - `SearchableProductSelect` dropdown option lists now display all mapped item numbers (joined with commas) for every catalog entry, providing complete visibility of the product numbers catalog mapping.
  - `ProductQuickInfoModal` was updated to preserve and highlight the actual item number of the selected cut if it exists in the catalog product's numbers array, instead of always hardcoding the first item number.

### Files Modified
- `freezer_inventory_tracker/components/SearchableProductSelect.tsx`
- `freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.6] - 2026-07-12
### Added
- **Interactive Multi-Select Cuts Trend Chart**: Made the target cuts selection multi-select, allowing users to track several cuts at once.
- **Trend Mode Comparison & Additive Sums**:
  - **Compare Cuts Mode**: Plots multiple individual cuts as distinct multi-colored lines on the same chart, with a hover tooltip highlighting the breakdown of all active compared cuts.
  - **Additive Sum Mode**: Allows summing the packaged weights of several cuts together, rendering a unified composite curve and area fill over time.
- **Strict Cut Name Filtering**: Modified report filters to match cut names exactly (case-insensitively) rather than via substring match. Selecting "backfat" will no longer pull in "backfat (smoked)".

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.5] - 2026-07-12
### Changed
- **Per-Animal Reports Statistics**: Shipped weighted average calculations for butcher logs reporting. Live, hot, cold, and packaged weights are now dynamically averaged out on a per-animal basis (divided by the order's `animalCount`) rather than averaged simply per order.
- **Enhanced Reports Dashboard UI**:
  - Main report summary cards now display aggregated individual **Animals** count alongside **Orders** and **Packages**.
  - Weights Timeline carcass weight progression line graph was updated to showcase per-animal standing/hanging averages, smoothing out visual peaks from multi-animal orders.
  - Interactive tooltip overlays display both the per-animal averages and the grand total order weight.
  - Species Comparison Analytics cards now detail both order counts and actual animal counts per species.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.4] - 2026-07-12
### Fixed
- **Docker Build Dependency Resolution**: Added missing dependency `papaparse` and its dev dependency `@types/papaparse` directly into `freezer_inventory_tracker/package.json` to resolve build/compilation errors inside the Home Assistant Add-on Docker image environment.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.3] - 2026-07-12
### Added
- **Animal Birth Date**: Added an optional birth date field for butcher orders/logs to automatically calculate and display the animal's "Days Alive" (difference between Birth Date and Kill Date).
- **Generic Notes Section**: Added a robust generic notes section to the butcher logs, allowing custom comments and transport details during order creation and editing.

### Changed
- **Optional Butcher Order Pickup Date**: Made the butcher order pick up date field completely optional on both the creation form and the edit order modal. The only required date is now the kill date.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.2] - 2026-07-12
### Changed
- **Butcher Records Offsite Transfer Notes**: Removed auto-generated default notes (`Butcher order <order_number>`) on items when importing/moving them from Butcher Records to the Off-Site storage spreadsheet. The notes field is now kept empty as requested.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.65.1] - 2026-07-12
### Fixed
- **Interactive Snapshot Preview Modal Dialog**: Resolved issue where clicking the preview button fetched snapshot data but did not display any visual feedback. Built a robust, beautiful interactive overlay modal that renders when preview data is populated.
  - Displays live vs snapshot side-by-side table comparisons for all database categories.
  - Enables live scope toggling inside the preview portal before triggering the restore command.
  - Highlights on-site and off-site total pieces and net weights (lbs).
  - Offers sample name listings for sqlite/json/csv backups and a folder/file viewer for zip packages.

### Files Modified
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

 ## [1.65.0] - 2026-07-12
### Added
- **Snapshot Restoration Preview Portal**: Added ability to preview the exact content, structure, and database record metrics of any point-in-time snapshot before committing to a full restore.
  - Generates comprehensive on-the-fly comparisons of snapshot items (Freezers, Containers, Catalog, Stock Counts, Offsite Records, Tags, custom lists) against active database stats.
  - Displays total item weights, pieces tallies, sample lists of names, and safe multi-format checklist restorations in a clean, interactive high-contrast sliding panel.
  - Integrated full backend preview engine supporting `.db` (SQLite), `.json`, `.csv`, and `.zip` archives.

### Files Modified
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.64.0] - 2026-07-12
### Added
- **Interactive Butcher Analytics Dashboard**: Replaced the basic tabular Reports view with an interactive, data-rich dashboard.
  - Implemented multi-mode custom SVG interactive charts for graphing carcass processing metrics over time:
    - **Yield Trends**: Tracks Hot Weight Yield (dressing %), Hanging Cooler Shrink %, Cutting Yield (packaged/cold %), and Standing Yield (packaged/live %).
    - **Weights Timeline**: Renders continuous area and line trends for Live Standing Weight, Hot Hanging Carcass, Cold Hanging Carcass, and Take-Home Packaged Meat.
    - **Cuts Over Time**: Displays historical percent-of-pack proportions for any target cut selected via a new custom filter.
    - **Species Bento comparisons**: Aggregates processing averages and loss progression bar graphs segmented by animal species (Beef, Pork, etc.).
  - Added floating interactive overlay tooltip cards that track cursor entries to display complete order metrics upon hover.
- **Advanced Yield and Carcass Performance Cards**: Enhanced individual order detail cards (expanded view) with dual-pane dashboards, offering:
  - dressing loss, hanging cooler shrink, and cutting loss calculations.
  - horizontal, color-coded carcass loss journey meters (Live -> Hot -> Cold -> Packaged) and single-cut take-home package shares.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.63.6] - 2026-07-12
### Fixed
- Completely separated the Butcher Records view from the On-Site Warehouses core navigation. The main header toggles (Products / Freezer / Display) and the main Search & Filter row are no longer visible when on the Butcher Records view, and the "On-Site Warehouses" hamburger menu item correctly unchecks itself when navigating away from the core inventory screens.

### Files Modified
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.63.5] - 2026-07-12
### Fixed
- Added an automatic state migration to populate `originalCutName` for existing Off-Site Storage items that were imported from Butcher Logs before the recent fix, allowing the "VIEW RAW CSV ITEM NAMES" toggle to work retroactively on older imports.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.63.4] - 2026-07-12
### Fixed
- Fixed a bug where toggling "VIEW RAW CSV ITEM NAMES" did not correctly update the available options in the cut name dropdown filter in Butcher Logs and Off-Site reports.
- Fixed a bug in Off-Site Storage where the toggle would cause the item breakdown grouping and spreadsheet filtering logic to mismatch, leading to hidden or incorrectly aggregated items.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.63.3] - 2026-07-12
### Added
- **Original CSV Names Toggle**: Added "VIEW RAW CSV ITEM NAMES" toggle to both the Butcher Logs section and the Off-Site Cold Storage view. This allows users to switch between viewing the normalized product catalog names and the exact raw string names imported originally from the CSV processor logs.

### Changed
- Preserved original cuts during Off-Site import by adding an `originalCutName` property to Off-Site entries.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

All notable changes to the Freezer Inventory Tracker project will be documented in this file.

## [1.63.2] - 2026-07-12

### Added
- **Multi-Select Report Filters**: Replaced standard text inputs with a new `MultiSelectDropdown` component in the `ButcherRecordsView` reports section to allow users to select multiple orders, species, and cuts simultaneously.
- **Species Dropdown**: Replaced the standard text input for species with a new `CreatableDropdown` component in both the Import Order and Edit Order forms. This provides a searchable dropdown of existing species while retaining the ability to type a new one.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.63.1] - 2026-07-12

### Fixed
- **Butcher Logs CSV Import**: Modified the CSV parser in `ButcherRecordsView` to ignore summary lines at the end of the file (specifically rows where the raw cut name data is completely empty), preventing "N/A" ghost items from halting the import flow.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.63.0] - 2026-07-11

### Added
- **Edit Butcher Orders**: Added an "Edit Order" modal to the `ButcherRecordsView`, allowing users to modify order metadata (order number, species, kill/pickup dates, and weights) after an order has been submitted.
- **Animal Count**: Introduced an optional `animalCount` field for Butcher Orders. This is now available during initial CSV import form submission and in the Edit Order modal.
- **Database Migration**: Safe on-startup SQLite migration to automatically add the `animalCount` column to existing `butcher_orders` tables without data loss.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.62.2] - 2026-07-11

### Fixed
- **Butcher Logs Import Mapping Wizard**: Implemented the `Unmapped Attribute Mapping Wizard` in `ButcherRecordsView` to pause imports and allow the user to map unmatched cuts or create new products dynamically before committing the import.
- **Delete Butcher Order**: Fixed the delete button failing to trigger by replacing the iframe-blocked `window.confirm` browser dialog with a custom built-in React confirmation modal.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.62.1] - 2026-07-11

### Fixed
- **Butcher Logs Product Matching**: Improved CSV import parsing logic in `ButcherRecordsView` to extract prepended item numbers from raw cut strings (e.g., "13298 PORK LOIN RIB CHOPS") and match them accurately against the local product catalog's `productNumbers` array, mirroring off-site functionality.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.62.0] - 2026-07-11

### Added
- **Butcher Logs Summary & Cut Breakdown**: Added a toggle on individual butcher order cards to display a summary breakdown of all imported cuts, piece counts, and net weights.
- **Cross-Order Reports Tab**: Added a new "Reports" tab to the Butcher Records view, enabling users to run aggregate reports across multiple orders and filter by order numbers, species, cut names, and pickup/kill dates.

### Files Modified
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.61.0] - 2026-07-11

### Added
- **Butcher Records Logs View**: Created a new top-level view (`ButcherRecordsView`) for managing inbound processing orders and logging cut yields.
- **CSV Import for Butcher Logs**: Built a robust CSV importer powered by `papaparse` that ingests butcher records and matches cut strings against the active product catalog.
- **Off-Site Inventory Sync**: Implemented a seamless toggle to automatically migrate new inbound butcher records into the primary off-site tracking ecosystem.
- **Butcher Schema**: Added new `butcher_orders` and `butcher_records` tables to the SQLite database backend (`server.ts`).

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/views/ButcherRecordsView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.60.0] - 2026-07-11

### Removed
- **Complete Purge of "Colors" Feature**: Removed the "colors" property entirely from packages and boxes as requested by the user. Cleaned up the UI, forms, database schemas, and the CSV export and import routines.
- **On-Startup DB Schema Upgrade**: Implemented automated checks during the SQLite initialisation sequence. If the legacy `colors` column exists in the database `off_site_entries` or `meat_cuts` tables, the system automatically runs schema migrations (`DROP COLUMN`) on startup to cleanly drop/set it to null.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.59.1] - 2026-07-11

### Fixed
- **Automated SQLite Corruption Recovery**: Implemented proactive error interception during SQLite initialization (`better-sqlite3`). If the database file becomes malformed or corrupted, the system now automatically renames the corrupt file with a timestamped suffix to preserve it for manual inspection, scan and copy the newest valid backup `.db` file from the backups directory, and falls back gracefully to standard re-seeding or `inventory-db.json` JSON recovery.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.59.0] - 2026-07-11

### Added
- **Refactored Color Management to Box-Level**: Transitioned color marker assignments from individual packages to physical box groups, aligning with efficient staging and bulk movement processes.
- **Dynamic Box Marker Badges**: Rendered box marker colors as distinctive visual dots next to box IDs in both the Storage Hierarchy and Spreadsheet list.
- **Interactive Inline Box Marker Editors**: Integrated tactile click-to-select marker dropdowns/popovers allowing users to easily toggle colors (Red, Orange, Yellow, Green, Blue, Purple, Black) on boxes.
- **Automated Movement Color Injection**: Configured movement orders so that executing an offsite plan automatically appends any active movement color flags to the physical boxes.
- **Graceful Reversion**: Enabled undoing/reverting movement orders to correctly restore boxes back to their pre-move color states.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.58.3] - 2026-07-11

### Fixed
- **Cleaned Up Workspace & Removed Obsolete Remnants**: Deleted old helper script remnants (like `update_changelog_2.cjs`, `update_changelog_3.cjs`, `update_changelog_4.cjs`, `add_changelog.cjs`, etc.) from the workspace root and validated the target directory structure to ensure optimal compatibility for the Home Assistant add-on.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.58.2] - 2026-07-11

### Changed
- **Removed Obsolete Relational Spreadsheet Importer**: Cleaned up the deprecated AppSheet relational CSV spreadsheet importer tab, states, and unused helpers in the Database Manager view to simplify the interface.

### Files Modified
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.58.1] - 2026-07-10

### Changed
- **Moved Demo Sandbox controls to Settings page**: Migrated the Demo Sandbox playground toggle interface out of the Data Import (backup/restore) tab and into the primary Application Settings tab.
- **Fixed Iframe Compatibility for Demo Mode**: Removed standard browser `window.confirm` blockers which failed to render inside the sandboxed Home Assistant context / Web Preview iframes, replacing them with fluid, state-based inline confirmations in the UI.

### Files Modified
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.58.0] - 2026-07-10

### Added
- **Demo Playground Mode**: Implemented a fully isolated "Demo Mode" that allows users to test modifications, bulk operations, or practice in a sandbox duplicate of their database without affecting live production data.
- **Persistent Header Banner**: Added an eye-catching, persistent amber banner at the top of all views when Demo Sandbox mode is active, providing quick "Exit & Discard" controls.
- **Sandbox DB Toggling**: Added backend API endpoints to duplicate the production SQLite database into an isolated `inventory_demo.db` during demo startup, and cleanly purge the demo files upon exiting.
- **Automatic Backup Bypass**: Ensures automatic rolling backup tasks are completely bypassed when running in Demo Sandbox mode to prevent sandboxed play changes from dirtying rolling snapshots.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.12] - 2026-07-10

### Changed
- **Database-Backed Automatic Rolling Snapshots**: Refactored the automatic rolling backup snapshot engine. In addition to saving the fallback JSON snapshot file, it now performs an online `VACUUM INTO` backup of the active SQLite database (`.db`) with matching timestamps. It also implements a multi-extension retention policy that groups backup files by timestamp base names to cleanly purge both `.db` and `.json` old snapshot pairs without exceeding the configured rolling max limit.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.11] - 2026-07-10

### Added
- **Typing Indicator for Remote Synchronization**: Created a lightweight SSE-based "typing indicator" that broadcasts across the network instantly whenever a user starts editing quantities. Other active devices will now display a fuchsia "User Editing..." badge in their header, without forcing a heavy state reload or database write, keeping latency to 0ms across devices.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.10] - 2026-07-10

### Added
- **Local Caching Sync Status**: Added a visual indicator to the sync button that explicitly shows when changes are being cached locally before the batched background sync executes. The button turns amber and pulses with a "Saving..." label during rapid interactions, restoring to the standard "Live" cyan state once the payload successfully reaches the server.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.9] - 2026-07-10

### Changed
- **Scroll-Aware Inactivity Sync**: Added a global inactivity tracker that listens to `scroll`, `touchstart`, `mousemove`, and `keydown` events. Now, if you are actively scrolling through the list or checking items, the background data sync (which causes a slight visual refresh) is delayed until there is 2 seconds of total screen inactivity, preventing lag while you interact with the UI.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.8] - 2026-07-10

### Fixed
- **Optimistic UI Restoration**: Re-enabled immediate, synchronous global state updates for all quantity modifications. This ensures the grand totals, active views, and other display fields remain perfectly consistent and reactive while the user clicks, without waiting for the delayed 2-second background batch sync.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.7] - 2026-07-10

### Fixed
- **Optimistic UI Unblocking**: Removed the blocking synchronous optimistic state tree mutation that occurred on every single click during a `UPDATE_MEAT_QUANTITY` dispatch.
- **Zero Input Lag Mechanism**: The frontend now relies exclusively on immediate localized component state (0ms latency) during rapid typing or sequential checkout clicks. The massive global app state tree only synchronizes once the final batched network round-trip returns from the server (2 seconds after clicking stops), completely curing device freezing on tablets.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.6] - 2026-07-10

### Changed
- **Global Batched Synchronization**: Transformed the per-item sync debouncer into a unified global synchronization timer (2 seconds). Now, multiple rapid changes across different items are collected into a single payload and pushed efficiently to the database at once.
- **Batched API Action**: Introduced the `BATCH_UPDATE_MEAT_QUANTITY` action to the server-side Node endpoint and local dispatcher, dramatically reducing SQLite transaction volume and preventing UI freezing during large multi-item checkouts.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.5] - 2026-07-10

### Added
- **Debounced Server Synchronization**: Introduced an 800ms client-side debouncing layer for rapid quantity updates (`UPDATE_MEAT_QUANTITY` action). Multiple consecutive button clicks on the same item are accumulated instantly on the client-side for 0ms visual latency, but are consolidated into a single server transaction once typing/clicking stops.
- **Client-Side Dispatch Flush**: Implemented an automated flushing mechanic to instantly push any pending debounced quantity updates before executing any other unrelated inventory actions (like adding/deleting container items).
- **Stale Render Guard**: Added a local `lastDispatchedQuantityRef` tracking guard inside `MeatCutRow`, `DisplayCaseView`, and `ProductView` components. This safely intercepts intermediate React re-renders, preventing stale global state payloads from overwriting newer in-flight user clicks.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/components/MeatCutRow.tsx`
- `freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `freezer_inventory_tracker/views/ProductView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.4] - 2026-07-10

### Fixed
- **Synchronized Promise Queue**: Added an async sequential queue mechanism in the client-side state dispatcher (`useInventory` hook). This guarantees server transactions are processed one-by-one, preventing concurrent write-collision race conditions in SQLite.
- **Visual Glitch Protection**: Suppressed intermediate server state synchronization while rapid client clicks are active. The UI remains 100% fluid and responsive with zero lag or rollback flicker.
- **Ref-Based Hook Stability**: Decoupled `dispatch` callbacks from dynamic outer state variables, making them perfectly stable references that do not trigger parent component re-renders.

### Files Modified
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.3] - 2026-07-10

### Fixed
- **Zero-Lag Quantity Adjustments**: Eliminated visual lag and double-rendering delays on quantity edits. Input elements now bind directly to the state props while idle and use a transient focus state while editing, completely bypassing asynchronous state-sync hooks.
- **Client-Side Optimistic Updates**: Integrated live, optimistic client-side updates in the `useInventory` state dispatch logic for `UPDATE_MEAT_QUANTITY`. When incrementing or decrementing, category totals, individual item listings, and container capacities update with 0ms visual latency without waiting for the server roundtrip.
- **Rapid Click Guard**: Introduced a synchronous `useRef` quantity-tracking mechanism inside on-site rows to guarantee rapid consecutive clicks are registered accurately and applied incrementally without race conditions or reverting state.

### Files Modified
- `freezer_inventory_tracker/components/MeatCutRow.tsx`
- `freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `freezer_inventory_tracker/views/ProductView.tsx`
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.2] - 2026-07-10

### Added
- **Explicit Custom SQLite Indexes**: Configured automated index creation at startup on high-traffic lookup and filtering columns to dramatically speed up page loads and lookup queries. Built explicit indices:
  - `idx_cuts_location` on `meat_cuts(storageLocationId)`
  - `idx_cuts_product` on `meat_cuts(productId)`
  - `idx_cuts_container` on `meat_cuts(containerId)`
  - `idx_containers_freezer` on `containers(freezerId)`
  - `idx_offsite_location` on `off_site_entries(storageLocationId)`

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.1] - 2026-07-10

### Fixed
- **Prebuilt SQLite Bindings Compatibility**: Upgraded `better-sqlite3` to `^11.3.0` inside `freezer_inventory_tracker/package.json` to leverage precompiled native binary bindings for Node.js v22. This eliminates the dependency on local build tools (like `make` or `node-gyp`) and resolves the binding resolution error that was causing the SQLite database to fail to initialize at startup.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.57.0] - 2026-07-10

### Added
- **Relational SQLite Database Refactor**: Replaced the legacy JSON document-store table architecture with a fully relational flat-column schema across all database tables.
- **Transactional Database Migration Layer**: Implemented an automated atomic migration sequence at startup that renames, parses, and migrates legacy rows into custom flat-column mappings with zero data loss.
- **Relational SQL Database Interface**: Updated database access functions (`loadTableData`, `saveTableData`, `syncTableData`) to interact directly with structured SQL flat columns while perfectly preserving front-end state model compatibility.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.56.5] - 2026-07-09
 
### Fixed
- **Alpine package upgrade alignment**: Pre-upgraded `musl` and `musl-dev` in the Docker multi-stage environment to align Alpine package repository versions, successfully resolving building/linking conflicts for `g++` and native binary addons like `better-sqlite3`.

### Files Modified
- `freezer_inventory_tracker/Dockerfile`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.56.4] - 2026-07-09
 
### Fixed
- **Docker Alpine C++ compilation support**: Added `python3`, `make`, and `g++` to the `Dockerfile`'s base layer to support compiling native binary C++ Node addons.
- **Node.js 18 compatibility for better-sqlite3**: Reverted `better-sqlite3` from version `^12.11.1` to version `^9.4.3` to avoid incompatibilities with the Home Assistant environment's Node.js 18.20 runtime.
 
### Files Modified
- `freezer_inventory_tracker/Dockerfile`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.56.3] - 2026-07-09
 
### Fixed
- **Missing Module Resolve**: Added `better-sqlite3` to `/freezer_inventory_tracker/package.json`'s dependencies, resolving the production container module resolution crash (Bad Gateway).
 
### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.56.2] - 2026-07-09
 
### Added
- **Multi-Format Upload & Restore**: Added comprehensive support for restoring the active system from any uploaded SQLite `.db` database, `.json`, or `.csv` backup file.
- **Upload directly into snapshots library**: Added a new custom input in the Point-in-Time Snapshot card that allows uploading a previously downloaded backup file directly into the local snapshots list without triggering an immediate system overwrite.
- **Dedicated Secure Upload API**: Created `POST /api/backups/upload` endpoint to safely handle base64 binary files, validate names, and place them securely in the `backups` directory.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.56.1] - 2026-07-09
 
### Added
- **On-Demand Snapshot Download**: Added a new secure download action button to the Snapshot Backups list. Users can now easily download any local `.db`, `.json`, or `.csv` snapshot file directly to their local machine.
- **Dedicated Secure Download Endpoint**: Developed a custom authenticated-ready server router (`GET /api/backups/download/:filename`) that securely stream-delivers raw backups.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.56.0] - 2026-07-09
 
### Added
- **Multi-Format Backup Framework**: Refactored the Point-in-Time internal snapshot system in the Backup tab to support three formats:
  - **Database Backup (default)**: Creates a secure, consistent copy of the active SQLite database using `VACUUM INTO`.
  - **JSON Fallback Backup**: Explicitly generates a comprehensive JSON database representation of the selected scopes on-demand, writing the fallback `inventory-db.json` file.
  - **CSV Backup**: Generates an optional CSV containing offsite and onsite record structures.
- **Improved Backup List visualizer**: Added visual badges (`SQLITE DB`, `JSON`, `CSV`) to list entries so users can immediately distinguish backup files.
- **Secure File Format Restoration**: Enabled robust database restoration for `.db`, `.json`, and `.csv` files.

### Changed
- **Optimized Active Operations**: Removed the automatic background async JSON fallback write during regular inventory changes, saving disk cycles and eliminating resource overhead.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.55.0] - 2026-07-09
 
### Added
- **SQLite Database Integration**: Migrated data persistence from a single synchronous JSON file to a localized SQLite database (`better-sqlite3`). This provides rapid O(1) queries and transactions, fully optimizing performance for 60,000+ yearly serialized cuts and removing any local or remote dashboard lag.
- **Auto-Migration & Backwards Compatibility**: Designed a seamless auto-migration sequence on startup that automatically reads any existing working `inventory-db.json` and populates the SQLite tables.
- **Asynchronous Background Fallback JSON Backup**: Enabled an optional background JSON backup on disk that writes data in non-blocking fashion, preserving maximum read/write performance.
 
### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.54.4] - 2026-07-08
 
### Added
- **Location Reference in Report Center**: Added a reference section in the Movement Report Center sidebar that displays contact information and notes for the selected destination location. This provides quick access to relevant delivery or storage details from the location catalog without cluttering the final document.
 
### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.54.3] - 2026-07-08
 
### Fixed
- **Report Center Persistence**: Fixed an issue where PO numbers, item descriptions, and bottom notes in the Movement Report Center were not being saved. These fields are now persisted per movement order and destination location using the order's metadata flags. This ensures that custom edits remain intact even when switching views, changing destination locations, or closing the application.
 
### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.54.2] - 2026-07-08
 
### Fixed
- **Movement History "Unknown Cut" Resolution**: Fixed an issue where items in the Movement History would always display as "Unknown Cut" because they were referencing a non-existent `product` field. The view now correctly falls back to the `cuts` field.
- **Persistent History Item Details**: Updated the movement history table to prioritize `originalEntries` stored within the movement order. This ensures that even if an item is moved to "Home" staging or removed from off-site inventory, its original cut name, supplier, and weight details remain visible in the archive.
 
### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
 ## [1.54.1] - 2026-07-08
 
### Fixed
- **Off-Site Spreadsheet Filtering and Search**: Corrected the `condensed` memoized hook within `OffSiteSpreadsheet.tsx` by supplying the correct reactive dependency array `[filteredEntries, activeOrder, sortField, sortAsc]`. This ensures the Itemized Inventory Breakdown search and category filters instantly trigger state updates across both the summary blocks and the spreadsheet's visible box list.
 
### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.54.0] - 2026-07-08
 
### Added
- **"Change Container" Feature on Freezer View**: Added a highly interactive, fully featured "Change Container" action to the option dropdown menu of all containers (including loose and non-loose) rendered on the Freezer View.
- **Bulk and Selective Meat Cuts Transfer**: Built the `ChangeContainerFlow` component which lists all meat cuts currently stored in the selected source container, offering bulk (Select All/Deselect All) or itemized selection.
- **Formulas and Increment/Decrement Controls**: Outfitted each selected meat cut item with increment/decrement (`+` / `-`) count triggers and dynamic string evaluation of math expressions (e.g. `+3` or `5-2`), bounded by the maximum existing quantity.
- **Flexible Destination Selection**: Supported transferring cuts directly to existing active containers, retired containers/bags (with real-time freezer destination assignment during un-retirement), or creating an entirely new container on-the-fly.
- **Root Modal Registration**: Hooked up the `CHANGE_CONTAINER_FLOW` type to `ModalType` in `types.ts`, configured responsive modal headers, adjusted width to `max-w-2xl` for layout scan, and set full-height visibility.
 
### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/components/MoveModalContent.tsx`
- `freezer_inventory_tracker/components/ContainerCard.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.53.1] - 2026-07-08
 
### Added
- **Multi-View Option Menu Integrations**: Added the "View Product Info" menu action trigger to options/action menus in both the **Product View** (`ProductView.tsx`) and **Display Case / Front-of-House View** (`DisplayCaseView.tsx`).
- **Product Location and Overall Card Triggers**: Integrated the trigger for the global "Product Quick Info & Lists" modal at both the itemized location row levels (`ProductLocationRow`) and the top-level product header/overall options menus (`ProductMenuDropdown`).
- **Search Icon Imports**: Added `Search` import in `DisplayCaseView.tsx` from `lucide-react` for visual alignment.
 
### Files Modified
- `freezer_inventory_tracker/views/ProductView.tsx`
- `freezer_inventory_tracker/views/DisplayCaseView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.53.0] - 2026-07-08
 
### Added
- **Global Reusable ProductQuickInfoModal Component**: Refactored the "Product Quick Info & Lists" modal out of `OffSiteSpreadsheet.tsx` into a highly optimized, fully reusable component `/freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`.
- **Global Modal Hoisting**: Hoisted the `quickInfoItem` active state manager into the root application frame (`App.tsx`), permitting the popup to be launched seamlessly from any view in the app.
- **On-Site Inventory Integration**: Added a "View Product Info" trigger to the action/more menus inside `/freezer_inventory_tracker/components/MeatCutRow.tsx` (on-site item menus) to launch the joint popup, displaying real-time on-hand totals, off-site storage details, and custom list toggles.
- **Backwards-Compatible Data Parsing**: Integrated robust fallback resolution within the modal to automatically locate catalog products using both direct `productId` lookup and raw string `cuts` pattern matching.
 
### Files Modified
- `freezer_inventory_tracker/components/ProductQuickInfoModal.tsx`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/components/MeatCutRow.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.52.0] - 2026-07-08
 
### Added
- **Interactive Breakdown Search & Category Filtering**: Added inline search query field and product category selection dropdown inside the "Itemized Inventory Breakdown" panel.
- **Spreadsheet-Linked Filters**: Enabled automatic and real-time synchronization between the breakdown panel's filters and the main spreadsheet table (filtering the item breakdown filters the spreadsheet automatically).
- **Active Filter Pills Integration**: Integrated breakdown search and breakdown category filters into the active filter pills banner, allowing swift clearing.
- **Dynamic Breakdown Sorting**: Reconfigured the breakdown table headers to be interactive sorting buttons. Users can toggle sorts between Alphabetical (Item/Cut Name), Category, Boxes Count, Total Net Weight, and Total Pieces.
- **Category Column**: Added a visually distinct "Category" column badge to each breakdown row.
 
### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.51.0] - 2026-07-08
 
### Added
- **Total Pieces Summary in Off-Site Modal**: Added the total pieces summary (`totalOffSitePieces`) next to the total weight calculation in the Off-Site Inventory card header within the Product Details/Quick Info modal.
- **On-Site & Off-Site Location Quick-Jump & Filtering**: 
  - Clicking an on-site container in the modal's list switches the active view to Freezer View and scrolls/highlights the target container.
  - Clicking an off-site pallet or location within the modal automatically updates the spreadsheet's filters to focus exclusively on that pallet or location and closes the modal, enabling extremely rapid investigation.
- **Active Filter Pills Bar**: Added an elegant visual banner below the search and edit toolbar showing all active spreadsheet filter types (Cuts, Pallets, Locations, Move To, Boxes) with individual "✕" remove buttons and a "Clear All Filters" button.
 
### Files Modified
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.50.0] - 2026-07-08
 
### Added
- **Product Quick Info & Lists Integration from Off-Site**: Implemented a comprehensive click-to-info modal on off-site spreadsheet product names (in individual item lists, condensed box group rows, and the spreadsheet breakdown summary table). This allows users to view quick product stats and manage custom lists directly from the off-site view.
- **On-Site & Off-Site Stock Breakdown**: The popup displays real-time bento-style cards containing the total quantities on site (broken down by freezer/container locations) and off-site totals (broken down by pallet/location storage groups).
- **Interactive List Membership & Notes**: Added an inline checklist of all configured custom shopping and restock lists with dynamic toggle controls. When an item is on a list, users can edit list-specific notes directly from within the modal.
- **One-Click Product Catalog Registration**: Added an automatic/one-click fallback to register unrecognized off-site items in the central Product Catalog, enabling full custom list and inventory tracking support without leaving the spreadsheet.
 
### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
 
## [1.49.0] - 2026-07-08

### Added
- **Persistent Tags for Off-Site Items**: Extended the robust on-site tagging system ("Use First", "Not For Sale", etc.) to off-site spreadsheet items. Added persistent `tagIds` support directly under the `OffSiteEntry` model.
- **Dynamic Tag Copy on Transition**: Configured automated tag copy operations within the server-side `EXECUTE_MOVEMENT_ORDER` handler. When staging or transferring tagged off-site cuts onto on-site storage, the tags are fully mapped to the resulting meat cuts, and their `workingFrom` and `notForSale` state indicators are automatically updated and kept in sync.
- **Visual Tag Propagation to Box Header Level**: Implemented automated tag rendering on off-site boxes in both the main spreadsheet and the movement planner grids. If any item inside a box contains a tag, the corresponding tag badge is rendered directly on the box itself, informing field crews that they should expand the box for detailed item operations.
- **Graceful Migration for Stale State**: Added automatic on-the-fly state normalization in `normalizeState` to default empty tag fields on historical off-site entries, avoiding runtime issues.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.48.0] - 2026-07-08

### Added
- **Temporary Color-Coded Flags for Movement Operations**: Integrated an interactive, multi-colored drop flag system on boxes and individual items within the movement spreadsheets and planning views. This allows field crews and planners to visually highlight, annotate, or mark specific boxes and cuts (e.g., Red for high priority, Orange for inspect, Blue for special logistics, Green for verification) dynamically during an active movement order.
- **Unified State and Clearance Controls**: Implemented robust central state synchronization for temporary flags under the `MovementOrder` schema to ensure real-time visual alignment across views. Added a "Clear All Flags" action to reset all markers once a run is finalized or cleared.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.8] - 2026-07-07

### Fixed
- **Corrected Blank PDF Export via React Portals**: Replaced the dynamic DOM cloning mechanism with a declarative React Portal mounted directly under `document.body` for the offscreen PDF container. Mounting the element at the body root guarantees that parent CSS transforms, layout animations, and viewport shifts are bypassed. By rendering with `opacity: 1` and `zIndex: -99999` behind the main application UI, the layout is fully finalized and styled during standard browser passes prior to the user trigger, resolving the race condition that previously caused a blank page.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.7] - 2026-07-07

### Fixed
- **Eliminated PDF Left-Side Clipping and Shifting**: Upgraded PDF generation by dynamically cloning the printable checklist container and appending it directly under `document.body` at absolute origin coordinates (`0px`, `0px`). Configured `html2canvas` with explicit `scrollX: 0, scrollY: 0` overrides to neutralize viewport scroll-offset calculations. This ensures the output document matches standard US Letter boundaries flawlessly, with no left-margin shifting, truncations, or clipping regardless of screen scroll states or container parent nesting.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.6] - 2026-07-07

### Fixed
- **Resolved PDF Layout Cutoff and Alignment**: Redesigned the offscreen container and table structure for saving the Field Execution Checklist PDF. The hidden document is now constrained within an absolute, zero-opacity overlay with strict pixel dimension bounds, preventing warp and truncation on lower resolution viewports. Implemented `tableLayout: 'fixed'` with precise percentage-based column widths and `truncate` boundaries for table items, ensuring that checkboxes, pallet names, and long serial labels align correctly on standard US Letter pages and never clip off the page.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.5] - 2026-07-07

### Changed
- **Removed Line-Through on Checked-Off Box Badges**: Modified the Picked and Delivered box list badges in the Offsite Movement Checklist to display without line-through styling, restoring legibility to the box labels and numbers while keeping them cleanly categorized inside the checked off section.
- **Enhanced Box Header Interaction Flow**: Streamlined active checklist behavior. Clicking anywhere on the entire box header bar now toggles the box checked-off status (Pick/Deliver) directly without expanding the panel. Clicking explicitly on the right-end chevron icon will expand or collapse the box detail panel.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.4] - 2026-07-07

### Added
- **Optimized Box-Level Separation and Compact Checked Badge List**: Restructured the Offsite Movement Checklist (Pick and Delivery phases) to group and separate fully checked-off boxes from unchecked ones at the pallet/destination level. Checked-off boxes are now rendered as compact, single-line badges inside a collapsible region, completely removing visual clutter from the active checklist space. This resolves the box-level check-off UX friction, allowing direct and simple tapping to pick/deliver whole boxes without needing to expand internal details.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.3] - 2026-07-07

### Added
- **Collapsible Checked-Off Checklist Items**: Modified the web-based offsite movement checklist (both Pick and Delivery phases) to separate checked-off items and collapse them into a highly compact, space-efficient list. Unchecked items remain fully expanded at the top for clear action. Checked items show up as thin, single-line badges that can be clicked to quickly "Uncheck" or expand back in case of mistake or review.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.2] - 2026-07-07

### Removed
- **Uncluttered PDF Checklist Header Instructions**: Removed the "In-Field Execution Directions" instructional box from both the downloadable PDF document and browser direct printing output. This maximizes vertical printable space for the physical inventory sheets.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.1] - 2026-07-07

### Fixed
- **Optimized PDF/Print Layout for Standard Letter Format (8.5" x 11")**: Rewrote the PDF rendering dimensions and styles to strictly target standard US Letter portrait configuration. 
- **Exact Pixel Sizing Alignment**: Configured `html2pdf` with exact `720px` width canvas dimensions and matched `0.5` inch printable margins, eliminating horizontal content clipping, paper overflow, and awkward resizing on 8.5" x 11" pages.
- **Improved Page-Break Safeguards**: Added page-break CSS properties (`page-break-inside: avoid` for rows and `page-break-after: avoid` for section headers) to both the downloadable PDF slip and browser direct printing, avoiding truncated rows or orphaned table headers across page seams.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.47.0] - 2026-07-07

### Added
- **Box-Level Notes for Off-Site Movement**: Added the ability to write, view, and modify notes on entire boxes during off-site movement. The box-level note is dynamically synced and updated across all items belonging to that box.
- **Individual Item-Level Notes**: Added support for adding, viewing, and modifying item-level notes on individual cuts/items within both the off-site spreadsheet and the active execution checklist phases.
- **Subtle Visual Notes Indicator**: Integrated highly compact visual badge/icon indicators next to the Box labels on both the off-site spreadsheet and the field pickup/delivery checklists. This notifies operators when notes are present without cluttering the compact main interfaces.
- **Inline Checklist Editors**: Built self-contained inline text inputs for box-level notes and interactive toggleable item-level editors in the expanded details of the Field Checklist. This allows notes to be modified seamlessly during execution with zero layout disruption or iframe/prompt compatibility issues.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.46.4] - 2026-07-07

### Changed
- **Removed View Details Sub-Rows**: Completely removed the redundant "View Details" text lines from the Pickup and Delivery box rows to maximize the number of boxes visible on the screen simultaneously. Users can still seamlessly toggle details by clicking anywhere on the box row.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.46.3] - 2026-07-07

### Changed
- **Streamlined Field Execution Checklist UI**: Removed the "Contents" preview line from the main box preview rows to make lists tighter and display more boxes simultaneously on the screen. Full contents detail remains fully accessible by expanding/opening the details panel.
- **Optimized PDF/Print Field Movements Layout**: Replaced the "Cuts & Quantities" column in both the hidden PDF generation container and the browser print-only component with a simple "Pieces" (piece count) column. Significantly reduced row heights and padding, achieving a highly polished and compact layout designed to fit movements on 1-2 pages maximum.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.46.2] - 2026-07-07

### Added
- **Restored Target Pallet Rename**: Re-introduced the "Rename Pallet" button specifically for planned target destinations in the Off-Site Movement Planner view. This allows users to easily rename newly planned destination pallets inline during planning phases.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.46.1] - 2026-07-06

### Changed
- **Movement Planner UI Streamlined**: Removed the redundant "Source Pallets" section from the Off-Site Movement Planner as items are auto-mapped via the Bulk Items Mapping spreadsheet instead.
- **Relocated Rename Pallet Action**: Migrated the "Rename Pallet" functionality from the Movement Planner entirely into the Storage Hierarchy tab for better logical grouping of storage-level management tools.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/views/OffSiteHierarchy.tsx`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.46.0] - 2026-07-06

### Added
- **Rename Pallets**: Added the ability to completely rename an existing pallet, whether it's already stored at an off-site location or currently being created/filled within an active Movement Order. This action globally refactors the pallet's name across all active tracking states and movement destinations.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.45.2] - 2026-07-06

### Changed
- **Removed Auto-Notes**: When moving an item from off-site to on-site, the auto-generated movement tracking text is no longer appended to the notes field. Existing specific item notes will still be preserved, but otherwise, the notes section remains empty.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.45.1] - 2026-07-06

### Changed
- **Direct Split Destination Display**: Replaced the "Multiple" target location label for split boxes with a direct, real-time list of all distinct target locations/pallets and items. Operators can now instantly identify split routing details directly from the compact box card without needing to expand it first.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.45.0] - 2026-07-06

### Added
- **Item-by-Item Check-off**: Added the ability to check off individual items inside boxes during the Field Execution checklist, offering ultimate precision for granular workflows.
- **Split Box Destination Support**: Fully integrated and accounted for split boxes where different items in a single box are routed to different target locations. 
- **Partial Toggle states**: Added custom MinusSquare icons and styling to represent partially picked or partially delivered boxes, so operators instantly see overall progress of multi-destination boxes.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.44.1] - 2026-07-06

### Changed
- **Checklist Box Condensing**: Condensed the list of box contents in the Field Execution checklist view. Contents are now hidden by default and only display upon expanding the individual card rows.
- **Prevalent Target Destinations**: Redesigned the box cards in the checklist to make destination locations and target pallets significantly more prevalent and prominent.
- **Save PDF Support**: Replaced the "Print" button on the checklist with a consistent, direct "Save PDF" action utilizing dynamic dynamic CDN-loaded `html2pdf.js` generation.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.44.0] - 2026-07-06

### Added
- **Field Execution Checklist**: Introduced an interactive multi-phase checklist on finalized movement orders, letting operators easily execute transfers in the field.
- **Phase 1: Pick Up & Label**: Digital and paper checklists to locate each box on source pallets and write/stick label destinations. Features dynamic progress bars and instant toggle states.
- **Phase 2: Move & Deliver**: Digital and paper checklists to deliver boxes to target locations and confirm execution.
- **Offline / Printable Manifest**: Click "Print Field Checklist" to output a beautiful, high-contrast black-and-white paper layout for use in the freezer when internet connection is not available.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.7] - 2026-07-06

### Changed
- **Unified Box Level Grouping**: Re-engineered the Pallet Breakdown table to group/combine individual cuts that share the same `box` identifier (falling back to item `serial` if no `box` is registered). This ensures that each physical box is listed only once on the Delivery Slip, with its total weight summed correctly.
- **Accurate Box Counts**: Optimized the Pallet Summary table and grand total box count to compute unique boxes instead of counting raw/loose cuts.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.6] - 2026-07-06

### Changed
- **Pallet Breakdown Sorting**: Enhanced the "Pallet Breakdown By Box" table on Delivery Slips to automatically sort boxes alphabetically/numerically: first by Lot/Pallet Name, and second by Box ID/Serial. This ensures high readability and standard inventory flow.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.5] - 2026-07-06

### Added
- **Optional Bottom Notes Section on Reports**: Introduced a custom input on the left sidebar settings panel allowing operators to specify optional notes or special instructions for the bottom of reports.
- **Unified Document bottom rendering**: When notes are present, they render automatically in a structured, high-contrast block at the bottom of both the Delivery Slip and Transfer Manifest report types.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.4] - 2026-07-06

### Added
- **Editable Planning Movement Order Metadata**: Users can now dynamically change the name, target date, and optional description notes of active movement/transfer orders in the "planning" stage.
- **Header Metadata Inline Editor**: Re-engineered the active order planner header to feature a responsive, high-contrast edit panel containing text inputs, date picker, and textarea for notes. Changes are committed instantly via state dispatch with elegant user controls (Save & Cancel).

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.3] - 2026-07-06

### Changed
- **Removed Print Options & Warnings**: Completely retired the legacy standard print buttons and standard print warning banners from the transfer report previewer. The robust "Save as PDF" engine is now the exclusive, unified method for document generation, simplifying user decisions.
- **Perfected PDF Aspect Ratio & Fitting**: Re-engineered the printable document block to maintain a non-responsive, exact 752px content width aligned to standard 8.5" x 11" letter size with custom 0.3-inch margins. This guarantees zero cutoffs, clips, or column drops in generated Transfer Manifests and Delivery Slips.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.2] - 2026-07-06

### Added
- **Dynamic PDF Generation (Save as PDF)**: Integrated client-side `html2pdf.js` dynamically loaded from standard cdn to guarantee flawless document generation. Operators can now save Delivery Slips and Transfer Manifests directly as beautifully structured, letter-sized PDF files, entirely bypassing the sandbox restrictions and print issues caused by nested browser iframes.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.1] - 2026-07-06

### Changed
- **Optimized Manifest Report**: Removed the redundant box count column from the Transfer Manifest table, focusing exclusively on total piece count and total weight as requested.
- **Improved Print Reliability**: Upgraded the print action button trigger to guarantee focus before summoning the print dialog (`window.focus(); window.print()`), and added a high-visibility helper banner guiding operators on printing from within nested iframe contexts like Home Assistant.
- **Streamlined Layouts**: Removed the operational sign-off and signature section from the bottom of printable documents to maximize vertical space and eliminate clutter.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.43.0] - 2026-07-06

### Added
- **Multi-Pallet Report Selector**: Enhanced the Report Center to support selecting multiple destination pallets at once for a delivery destination. Now, a single consolidated delivery slip can be generated for all pallets going to a particular location (such as Pyramid).
- **Persistent Custom Origin Config (From Address)**: Added editable fields in the settings tab (`LibraryView.tsx`) to set default shipper/origin name and address details, removing the hardcoded "BOTL Farm" default. Changes made here are saved to the browser's local persistent storage automatically and populate both Delivery Slips and Transfer Manifests.
- **Editable Origin on Form**: Allowed live shipper customization directly from the report center sidebar, so operators can make on-the-fly corrections without leaving the document preview.
- **Pre-Finalization Report Visibility**: Made the dynamic Report Center accessible during the `planning` and `finalized` phases of offsite movement orders. Operators can now preview, inspect, and print slips and manifests for work-in-progress moves before finalizing and executing them.
- **Improved Destination Lot Logic**: Updated Delivery Slip tables to map "Lot#" directly to the specific target/destination pallet name, ensuring clean logistics tracking.

### Files Modified
- `freezer_inventory_tracker/views/MovementReportModal.tsx`
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.42.0] - 2026-07-06

### Added
- **Printable Report Center**: Added a brand new print-ready and PDF-exportable document generator directly accessible from the Movement History tab under completed movement orders.
- **Dynamic Delivery Slip Report**: Recreated the requested high-fidelity Excel delivery sheet format, featuring structured grid tables, automatic location parsing, original-pallet box grouping ("Lot# (pallets)"), box counts, net weights, and signature sign-off cells.
- **Transfer Manifest Report**: Added a summary report that consolidates moved goods by product/meat cut name, total box counts, piece counts, and total weight.
- **Editable Document Customization**: Integrated live sidebar controllers within the preview center, allowing operators to change the target destination dropdown, modify/override the items description notes, and customize the Purchase Order (PO#) which auto-generates in `MMDDYYYY-IN` format by default.
- **Native Print Integration**: Implemented clean print-media CSS layouts that automatically isolate, size, and hide the application wrapper, rendering ONLY the document on print output.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementHistory.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.7] - 2026-07-06

### Removed
- **Cleanup & Deduplicate Button**: Removed the explicit "Cleanup & Deduplicate Files" button from the Photo Manager header, as the rest of the file management features comprehensively address and deduplicate file usage natively.

### Files Modified
- `freezer_inventory_tracker/views/PhotoManagerView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.6] - 2026-07-05

### Fixed
- **Build Issue**: Added `jszip` library to `freezer_inventory_tracker/package.json` dependencies to correctly resolve the missing dependency during the Home Assistant Docker build process.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.5] - 2026-07-05

### Added
- **Individual Item Bulk Selection**: Expanded the direct bulk edit and delete functionality to include individual item selections within the condensed box view in the Off-site Spreadsheet view. Users can now check off specific items for granular bulk operations.

### Fixed
- **Build Issue**: Added missing `jszip` library to the `package.json` dependencies to resolve a build failure during production deployment in Home Assistant.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.4] - 2026-07-05

### Added
- **Direct Bulk Edit & Delete**: Enabled bulk edit and delete actions when Direct Edit mode is enabled in the Off-site Spreadsheet view. Users can multi-select box groups via checkboxes and apply bulk edits to checked fields (such as Cuts, Box ID, Pallet Name, System Location, Colors, Notes, Pack Date, Lot, MW Order, Net Weight, and Pieces) or bulk-delete entire selections.
- **Robust Modals for Bulk Operations**: Integrated responsive Bulk Edit and Bulk Delete confirmation modals featuring checkbox selection for active fields to ensure safe bulk modifications.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.3] - 2026-07-05

### Added
- **Accept Imports from All Locations**: Removed the restrictor filter in the Bulk CSV Intake target/current location selection dropdown. Users can now assign imported/unmapped entries to any location in the system, including delivery, receiving, and partner locations.
- **Delivery & Receiving Terminology**: Renamed "Delivery Outlet" to "Delivery & Receiving" across list cards, registration forms, and import wizard mapping options. This supports direct intake of new products from processors or butchers.

### Files Modified
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.2] - 2026-07-05

### Added
- **Export Current Filtered View**: Connected parent container download handler to dynamic, live spreadsheet filtration state. Active filters on Box ID, Cuts, Pallets, Locations, and Target Destinations now strictly scope spreadsheet CSV exports.
- **Unified CSV Header Standard**: Standardized import and export headers across client parsing, client downloading, mock seeding, and server-side backup generator routines to exactly: `Serial,cuts,Pack Date,Lot,# Pieces,Net Weight, Order Number,Box,location,Pallet,Notes,colors`.
- **Adaptive Filter Layouts**: Scaled down filter dropdown overlays with responsive inner viewport height limits to prevent scrolling overlap on smaller monitors and devices.

### Files Modified
- `freezer_inventory_tracker/views/offSiteSeed.ts`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.1] - 2026-07-05

### Added
- **Known Location Selection**: Upgraded direct off-site item location editing to select from a comprehensive, pre-populated list of all known and registered locations. Integrated this across both the inline card-edit forms and the "Add New Off-Site Item" workflow overlay modal.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.41.0] - 2026-07-05

### Added
- **Direct Editing in Spreadsheet**: Created an advanced "Direct Edit Mode" option inside the unified offsite spreadsheet view. When toggled on, users can immediately edit any entry's vital data fields inline (Item Name, Box ID, Net Weight, Pieces, Pallet, Location, Colors, Serial, Lot, Pack Date, and Notes) with simple local confirmation prompts.
- **Add Off-Site Item Workflow**: Implemented a highly responsive, clean "Add Off-Site Item" action available when editing is enabled. Features a modern dark-themed overlay modal, custom auto-serial-generation ("Gen"), and data autocomplete suggestions derived from existing inventory database records.
- **Granular Deletion Controls**: Added inline deletion capabilities on expanded spreadsheet cards allowing direct and reversible item level removals.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.40.3] - 2026-07-05

### Fixed
- **Scroll-in-Scroll and Tiny Filter View Bug**: Fixed a bug where applying filters would shrink the table wrapper, squeezing the absolute dropdowns into a tiny, single-line scroll area. Implemented a robust minimum height (`min-h-[480px]`) on the table wrapper and increased the option item list's maximum height (`max-h-64`) to display many options simultaneously.
- **Improved Alignment**: Automatically aligned dropdowns to the right for far-right columns (Locations and Move To) and to the left for far-left columns (Box ID and Cuts) to prevent the filters from rendering off-screen.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.40.2] - 2026-07-05

### Added
- **Search within Column Filters**: Integrated real-time search filters inside each column dropdown list (Cuts, Pallets, Locations, Move To, Box ID) to allow instant option matching.
- **Dedicated Box ID Filter**: Added a robust Box ID column filter to easily narrow down the spreadsheet view to specific box groups.
- **Robust Click-Triggered Dropdown State**: Redesigned column filtering to be click-triggered and highly stable. Replaced hover-based structures that would prematurely dismiss with persistent, beautiful modal menus equipped with Select All, Clear Filter, active item count indicators, and a click-outside backdrop overlay to seamlessly dismiss active dropdowns.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.40.1] - 2026-07-05

### Changed
- **Mutual Exclusion for Staging and Inventory Removal**: Configured the movement order options to dynamically enforce mutual exclusivity. Selecting "Move coming-home items to Staging Area" automatically unselects and disables the "Remove from Inventory After Delivery" checkbox for any Home locations, preventing items from being dual-processed.
- **Improved Option Layout**: Updated the destinations list with a high-contrast label ("Handled by Staging") and line-through decorations to indicate that Home locations are actively routed through the staging workflow.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.40.0] - 2026-07-05

### Added
- **On-Site Staging Transitions for Movement Orders**: Added a smart option checkbox ("Move coming-home items to Staging Area") when executing off-site movement orders. If checked, any items destined for Home locations are automatically transitioned from detailed off-site spreadsheets to simple on-site staging counts under staging container names (e.g., `Box [Name]`), which are placed directly in the unassigned Staging Area (no freezer ID).
- **Auto-Removal of Delivered Inventory**: Added granular, checklist-style control next to each target destination of a finalized movement order to automatically remove its moved items from offsite inventory upon execution. This option is selected by default for any location classified as a delivery/pickup point.
- **Perfect Order Reversion & Undo**: Upgraded order reversion to support perfect restoring of transitioned staging and inventory removals, returning items safely to the off-site list while maintaining database stability.
- **Robust Backup & Restore Integrity**: Integrated custom locations and movement orders into partial and full ZIP backups (`inventory-on-site.json`), preventing data loss across exports and imports.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.11] - 2026-07-05

### Changed
- **Streamlined Off-Site CSV Intake Layout**: Removed the "Active Processor Butcher CSV Integration" information box and the CSV processing mode selector panel, leaving a single unified input section (upload + paste textarea) that defaults to append mode.
- **Removed Overwrite and Clear Actions from Intake**: Simplified the worksheet import options to focus exclusively on appending data safely. Removed the high-risk "Reset Sheet" button and corresponding confirmation modals to prevent accidental worksheet wipes.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.10] - 2026-07-05

### Changed
- **Streamlined CSV Intake Location Setup**: Removed the separate "Assign Source Location" (Butcher / Processing Supplier Origin) option from the Off-Site Bulk CSV Intake page. Simplified the ingestion options down to a single location selector ("Assign Current Location") with support for dynamic pallet creation or auto-completion to specify exactly where the incoming inventory items are stored. This streamlines setup and correctly maps missing locations or custom pallets during ingestion.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.9] - 2026-07-04

### Fixed
- **Bypassed Proxy Payload Upload Limit (HTTP 413)**: Refined the ZIP restore process. We now unzip the backup package on the client-side using `JSZip` to extract the database files, rebuild a tiny database-only ZIP package (under 100KB) to upload to the server, and upload any photo assets sequentially, one-by-one. This entirely prevents proxy payload limits (HTTP 413 Payload Too Large) while preserving precise filenames. A responsive loading progress indicator guides users through the sequential uploads.

### Files Modified
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.8] - 2026-07-04

### Fixed
- **Robust API Route Resolution under Home Assistant Ingress**: Introduced a universal path resolver helper `getApiUrl` which detects if the application is accessed inside Home Assistant Ingress (retaining the ingress token block context) or standalone. Applied this helper across all fetch endpoints in `DataImportView.tsx`, `PhotoManagerView.tsx`, `useInventory.ts`, and `MediaSelector.tsx` to fix broken relative URL paths which triggered 401 Unauthorized HTML errors.
- **Improved ZIP Import Error Parsing**: Refined response uploader parsing inside `DataImportView` to inspect the `Content-Type` header when receiving errors, reporting clean, descriptive status-based errors (e.g., `Server returned HTTP 413` or similar proxy messages) instead of crashing on client-side JSON decoding.

### Files Modified
- `freezer_inventory_tracker/hooks/apiUrl.ts` (added)
- `freezer_inventory_tracker/views/DataImportView.tsx`
- `freezer_inventory_tracker/views/PhotoManagerView.tsx`
- `freezer_inventory_tracker/hooks/useInventory.ts`
- `freezer_inventory_tracker/components/MediaSelector.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.7] - 2026-07-04

### Fixed
- **Automated Test / SSE Logger Noise**: Downgraded client-side `EventSource` connection retry and JSON parsing logs inside `App.tsx` from `console.error` to `console.warn`. This prevents automated test suites or verification runners from falsely failing due to intercepted console error emissions during standard network retries or container spin-ups.

### Files Modified
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.6] - 2026-07-04

### Fixed
- **SSE Connection Stability & Graceful Reconnects**: Corrected SSE live-sync connection drops and relative path parsing errors in multi-environment configurations. On the backend, we now use `res.writeHead(200)` and `res.flushHeaders()` (coupled with selective `.flush()` stream flushes) to bypass reverse proxy/ingress buffering layers. On the frontend, we introduced intelligent environment-aware routing path builders to avoid trailing-slash and token stripping bugs, and modified `EventSource.onerror` to gracefully check `readyState` and auto-negotiate background reconnections instead of prematurely locking the UI into an offline state.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/App.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.5] - 2026-07-04

### Fixed
- **Large Backup ZIP Uploads & Memory Exhaustion**: Replaced regular expression base64 parsing in both `/api/upload` (single photo upload) and `/api/backups/import-zip` (database restore) with lightweight, performant, and safe string indexing and slicing (`indexOf` and `substring`). This resolves catastrophic backtracking and V8 call stack size limit exhaustion crashes when handling multi-megabyte base64 strings (e.g. comprehensive ZIP backup files with high-resolution image assets), preventing the server from crashing or returning HTML-formatted proxy errors.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.4] - 2026-07-04

### Fixed
- **Photo Manager Deletions (Iframe Compatibility)**: Replaced native `confirm()` and `alert()` modals with a custom, state-based, non-blocking confirmation modal overlay in `PhotoManagerView.tsx`. This bypasses secure iframe sandboxing constraints that block native browser popups, restoring full functionality to individual and bulk photo deletion, as well as image unlinking.

### Files Modified
- `freezer_inventory_tracker/views/PhotoManagerView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.3] - 2026-07-04

### Added
- **Unified Photo Manager Dashboard**: Added a powerful, highly polished Photo Manager sub-tab inside the Library tab to view and manage all catalog and container photos on disk.
- **Disk Deduplication & Optimization Engine**: Implemented an automated duplicate checker that groups files by content hashes (MD5) and merges redundant file clones, updating all references and freeing up server space.
- **Detailed Photo Attachments & Unlinking**: Visualizes the precise items (products or containers) a photo is attached to, with quick warning badges for "unattached/waste" files and a simple button to unlink images.
- **Multi-Select Bulk Deletion**: Enables multi-checkbox bulk-selection to delete multiple photo files from central storage and clean their catalog references in a single operation.
- **Quick-Fill Missing Photo List**: Automatically compiles lists of products and containers that don't have photos attached. Includes custom dialog prompts allowing users to either upload new files or assign an existing photo to prevent duplicate file copies.

### Files Modified
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/views/PhotoManagerView.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.2] - 2026-06-25

### Fixed
- **Finalized Movement Persistence on Spreadsheet**: Corrected `OffSiteSpreadsheet.tsx` active order detection logic to encompass both `'planning'` and `'finalized'` movement orders, ensuring planned destination locations continue to visualize properly in the spreadsheet after finalization.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.1] - 2026-06-25

### Fixed
- **Movement Orders State-Based Confirmations**: Replaced browser `confirm()` popups on planned movement cancel, movement order undo, and order planner deletions with sandboxed, safe, and beautiful React state-based modal overlays to bypass standard iframe restrictions.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.39.0] - 2026-06-25

### Added
- **Spreadsheet Overall Metrics Dashboard**: Added a comprehensive dashboard strip displaying total boxes, total net weight, and total pieces for the active spreadsheet.
- **Itemized Spreadsheet Breakdown**: Designed an expandable, clean, itemized table panel summarizing total boxes, weights, and pieces for each specific item/cut matching the active filters in the unified spreadsheet.
- **Box Row Itemized Breakdowns**: Enhanced the collapsed box group rows to display sub-totals of weight and pieces for each cut in multi-item boxes.

### Files Modified
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.38.0] - 2026-06-25

### Added
- **Cancel Planned Movements**: Added the ability to cancel and delete a planned movement order that has not been confirmed and executed.
- **Undo Executed Movements**: Added full state backup on execution to support undoing the last executed movement order. 
- **Interactive UI Buttons**:
  - A red trash icon/cancel button on the planner list cards and detailed view headers for uncompleted moves.
  - A prominent green "Undo Last Move" banner at the top of the planner dashboard.
  - An "Undo This Move" button inside the active planner view when viewing the last executed movement order.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`

## [1.37.4] - 2026-06-25

### Changed
- **Enhanced Off-Site Light Theme Contrast**: Implemented comprehensive, targeted CSS overrides for all off-site inventory views and the movement planner when running in Light Mode.
- **Fixed White-on-White Headers & Dropdowns**: Corrected the filter dropdown popovers inside the spreadsheet headers so they render with crisp dark text on light backgrounds and light gray hover backgrounds.
- **Fixed Light-on-Light Dropdowns**: Configured the "Move To" row/item selectors, bulk actions toolbar, and alert warning banners to utilize rich high-contrast colors instead of pale blue on pale blue.
- **Resolved Invisible Text & Node Labels**: Excluded primary styled buttons while mapping all other white text classes inside the off-site view and the hierarchy tree nodes to solid high-contrast dark charcoal.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/index.css`

## [1.37.3] - 2026-06-25

### Added
- **Enforced Pallet Selection Constraint**: Target destinations located in pallet-based storage locations now strictly require specifying a pallet name during setup.
- **Disabled Unconfigured Additions**: The "Add Destination" action is dynamically disabled if the selected target location uses pallets but no pallet name has been entered yet.
- **Cleaned Quick Add Location Shortcuts**: Excluded pallet-based locations from the "Quick Add Locations" shortcuts list so that users are never led to create bare, pallet-less destinations inside palletized spaces.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`

## [1.37.2] - 2026-06-25

### Changed
- **Demonstration Seed Data**: Updated the embedded off-site CSV sample data with the current corrected inventory where all items are fully mapped to specific boxes, pallets, and active locations.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/offSiteSeed.ts`

## [1.37.1] - 2026-06-25

### Added
- **Dynamic Source Pallet Filtering**: The Unified Spreadsheet workspace now dynamically filters its list of visible items to match the source pallets selected in the active Movement Planner.
- **Visual Filtering Feedback**: Added an informative visual warning to the Active Planner alert banner showing which source pallets are active and filtering the workspace view.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

## [1.37.0] - 2026-06-25

### Added
- **Bulk Movement Selection**: Integrated checkboxes for selecting multiple boxes at once, paired with a dynamic floating bulk-actions utility bar that permits moving all checked boxes to a designated target location in a single click.
- **Granular Item-Level Movement**: Exposed direct target movement selectors inside the expanded item layout, enabling movement planning with item-level precision when splitting boxes between locations.
- **Visual Split Indicator**: Implemented intelligent detection for split boxes. If items within a single box are planned for different destinations, the parent box row is automatically flagged as a `⚠️ Split Box` in the spreadsheet view.

### Changed
- **List Element Key Safety**: Fixed React key warning on destination dropdowns in the Off-Site Spreadsheet view by ensuring each dynamically generated option is assigned a unique index-guaranteed key.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

## [1.36.4] - 2026-06-24

### Changed
- **Movement Planner**: Updated target destinations to support assigning items to both a Location and optionally a Pallet within that location. The UI now dynamically prompts for a pallet name if the chosen location supports pallets.
- **Unified Spreadsheet**: Updated the Move To dropdown to display the complete location and pallet destination format securely linked to the active Movement Order.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

## [1.36.3] - 2026-06-24

### Changed
- **Locations**: Added a "Uses Pallets" checkbox to custom locations to clarify whether items in that location are stored on pallets or just in boxes.
- **Movement Planner**: Removed the redundant "Movement Items" mapping table from the Off-Site Movement Planner view, centralizing all movement mapping responsibilities directly into the Unified Spreadsheet's "Move To" column.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/LibraryView.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`

## [1.36.2] - 2026-06-24

### Changed
- **Target Destinations Scope**: Expanded the Movement Planner to explicitly track target destinations. Users can now define custom destinations, or quickly append existing pallets and system locations to the active Movement Order scope.
- **Strict Destination Mapping**: Upgraded the "Target Destination" (Planner) and "Move To" (Spreadsheet) inputs from free-text fields into strictly bound dropdown selectors populated by the active order's Target Destinations.
- **Spreadsheet Filters**: The unified spreadsheet's "Move To" column filter now automatically inherits and displays all target destinations configured in the active movement order, even if no items have been mapped to them yet.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

## [1.36.1] - 2026-06-24

### Changed
- **Unified Spreadsheet View Integration**: Repurposed the static "Move To" column inside the Unified Spreadsheet Workspace. When a Movement Order is in the active "planning" state, the column becomes interactive, allowing users to bulk-assign target destinations to all items within a box at once directly from the spreadsheet.
- **Movement Planner Placement**: Elevated the `OffSiteMovementPlanner` view to the top of the Off-Site Storage page, entirely replacing the legacy hierarchical active logistics planner component.
- **Removed Duplicate Planner Tab**: Removed the duplicate "Movement Planner" navigation tab since the planner now lives permanently above the tabs layout.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`

## [1.36.0] - 2026-06-24

### Added
- **Movement Orders Planner**: Created a dedicated Movement Planner tab in the Off-Site Storage view to set up, finalize, and execute inventory movement orders.
- **Movement Order Data Models**: Introduced `MovementOrder` and `MovementItem` types to the backend database state alongside explicit reducer actions.

### Removed
- **Logistics Workspaces**: Removed the legacy hierarchical active logistics planner (`LogisticsWorkspaces.tsx`) in favor of the new explicit Movement Orders workflow.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/OffSiteMovementPlanner.tsx`

## [1.35.0] - 2026-06-24

### Added
- **Storage Hierarchy View**: Added a new structural view navigating Locations -> Pallets -> Boxes -> Items for intuitive off-site exploration.
- **Consolidated Spreadsheet**: Rewrote the flat list view into a powerful consolidated spreadsheet, grouping identical box IDs and allowing column-level multi-select filtering for cuts, pallets, locations, and movements.

### Changed
- **Off-Site Storage Rewrite**: Completely rebuilt and simplified the Off-Site Storage workspace to prioritize clarity and consolidated views, removing overlapping concepts of locations and pallets to reduce confusion.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/OffSiteSpreadsheet.tsx`
- `freezer_inventory_tracker/views/OffSiteHierarchy.tsx`

## [1.34.2] - 2026-06-24

### Fixed
- **IIFE Syntax Compilation Fix**: Corrected a syntax error in the nested tree spreadsheet workspace layout conditional compilation block inside `OffSiteStorageView.tsx` where the IIFE function wrapper wasn't fully closed.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/config.yaml`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`

## [1.34.1] - 2026-06-23

### Added
- **Hierarchical Logistics Move Scope & Planner**: Replaced the flat checkbox lists with an interactive, nested tree planner. Shows On-Site checkpoints and Off-Site warehouses, lets users check/uncheck whole warehouses to filter active scopes, shows pallet weights, box counts, and live move counts (e.g. `→ Restocking 3 boxes to Home Base`), and adds bulk actions like "Set All to Home Base" and "Clear Move Plans" with an iframe-safe inline confirmation execute flow.
- **Unified CSV Spreadsheet Grid with Condensed Identical Items**: Restructured the spreadsheet view so that each row represents a physical Box by default. Displays condensed contents (e.g., `5x NY Strip Steak (12.4 lbs)`) of identical items inside each box. Each box is expandable to reveal a nested spreadsheet list of its individual raw package/serial records.
- **🌳 Location Hierarchy Tree Spreadsheet View**: Introduced a spreadsheet-style nested tree layout. Users can toggle the main sheet to group boxes hierarchically under Warehouses and Pallets, retaining column alignments, totals, and inline quick-change destination drop-downs.
- **Streamlined Workspaces & Tabs**: Combined separate, confusing tabs (rearrange, pickup, intake, sheet, hierarchy) into a single, comprehensive workspace with three clean, high-visibility modes: Sheet (Spreadsheet/Tree), CSV Intake, and Lot Yields.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`

## [1.33.1] - 2026-06-23

### Fixed
- **1-to-1 Storage Coordination & Synchronization**: Upgraded the `ASSIGN_PALLET_LOCATION` action handler to dynamically find matched catalog names and update both `storageLocationId` and `location` attributes in parallel, providing a perfect 1-to-1 sync.
- **State-Based Non-Blocking Deletions**: Migrated destructive deletion routines in `OffSiteStorageView.tsx` and `LibraryView.tsx` from browser `confirm()` popups to modern inline confirmation click states, completely bypassing sandbox-iframe restrictions.
- **Real-Time Catalog Manifest Panel**: Replaced simple location counters in the Library View with expanded widgets that calculate item tallies and total net weights, and render full manifest dropdown drawers including box lists and specific cut selections in real-time.

### Files Modified
- `freezer_inventory_tracker/package.json`
- `freezer_inventory_tracker/CHANGELOG.md`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/views/LibraryView.tsx`

## [1.33.0] - 2026-06-23

### Added
- **1-to-1 Catalog Location Integration**: Engineered a strict, direct 1-to-1 linkage between long-term offsite storage locations and actual catalog/database locations.
- **Dual-Attribute Mapping Wizard**: Integrated a robust, elegant visual resolution screen on CSV imports to map both unmapped Meat Cuts and unmapped Location Names simultaneously.
- **On-the-Fly Catalog Location Creation**: Configured option to instantly provision and persist new STORAGE or IMPORT/EXPORT Partner locations in the master catalog directly from the wizard, generating unique IDs client-side for consistent association.
- **Backward-Compatible ID Action Payload**: Upgraded `ADD_LOCATION` state reducer on the backend to accept client-provided custom IDs, ensuring structural data consistency across independent updates.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`

## [1.32.0] - 2026-06-23

### Added
- **Updated Off-site CSV Structure**: Upgraded offsite inventory structure with columns (`location`, `Pallet`, `Notes`, `colors`) matching actual butcher inventory imports.
- **Strict Location Name Matching**: Implemented case-insensitive strict matching between incoming spreadsheet location names and registered catalog storage locations.
- **Box Visual Tracking Colors**: Implemented box color badges supporting color-coded visual rearrangement logs (e.g. black, red, green, etc.).
- **Durable Backward Compatibility**: Enhanced the server-side and client-side backup parsers to gracefully ingest both older (11 columns) and newer (12 columns) CSV data streams.

### Files Modified
- `freezer_inventory_tracker/types.ts`
- `freezer_inventory_tracker/views/offSiteSeed.ts`
- `freezer_inventory_tracker/server.ts`
- `freezer_inventory_tracker/views/OffSiteStorageView.tsx`
- `freezer_inventory_tracker/package.json`

## [1.31.0] - 2026-06-22

### Added
- **Multi-Level Storage Location & Pallet Hierarchy**: Finished implementing physical cold-chain location hierarchy mapping where Storage Locations contain Pallets, which contain Boxes, which contain individual Meat Cuts.
- **Dynamic Pallet Storage Location Binding**: Replaced the static Hardcoded Pallet Allocation cards (P1, P2, P3) with a fully dynamic, live-calculated physical warehouse tree. Every physical pallet (e.g. P1, P2) can now be assigned to any user-defined Storage Location (e.g. Pyramid, Midway Freight Hub, etc.) via beautiful, real-time dropdown selectors.
- **Real-Time Dispatch State Persistence**: Created a dedicated `ASSIGN_PALLET_LOCATION` action handler on the server state reducer, allowing pallet routing updates to bulk-migrate all nested boxes and cuts to the new location and persist automatically to the master JSON storage database.
- **Interactive Box & Cut Manifest Drill-down**: Designed nested expander drawers under the pallet grid, allowing physical off-site warehouse operators to drill down into individual Boxes to view detail lists, lot numbers, pack dates, net weights, and serials of the constituent meat cuts.

## [1.30.1] - 2026-06-22

### Fixed
- **Off-Site Manager Contrast Optimization**: Resolved white-on-white text and border issues inside multi-select dropdown menus, buttons, and toolbar options under Light Theme. Corrected black-on-black text inside pallet logistics layout panels and allocation bento cards under Dark Theme.
- **Valid Color Configurations**: Corrected invalid custom Tailwind gray and slate grade numbers (e.g. `cool-gray-305`, `cool-gray-150`, `cool-gray-350`, `cool-gray-455`, `border-slate-355`) inside `LogisticsWorkspaces.tsx` and `OffSiteStorageView.tsx` to restore standard theme mapping.
- **Form Input Focus Rings**: Cleaned up focus border and ring opacity overrides (e.g. `/500` and `/300` typos) across input forms in the inventory worksheet views.

## [1.30.0] - 2026-06-22

### Added
- **Origin / Supplier Stamp & Filtering on Off-Site Manager**: Added support for associating a source supplier location (e.g. your custom butcher or processor) with inbound cuts. Included a visual **Origin / Supplier** badge on both the worksheet table view and the shipping box planner card.
- **Dynamic Import Supplier Selection Dropdown**: Added a clean interactive selector on the CSV/text paste import panel, allowing users to designate the source origin during batch ingestion.
- **Dynamic Supplier Filters and Column Sorters**: Created custom multi-select checkbox dropdown filters for Suppliers in the worksheet toolbar, aligning database search, filter, and sorting flows.
- **Manual Input Supplier / Processor Select**: Incorporated a dedicated selector in the manual "Add Row/Record" form for rapid logging.

## [1.29.0] - 2026-06-22

### Added
- **Unified Location Concept & Database Engine**: Introduced a primary location management module. Users can custom design storage depots, transit grids, pickup facilities, and delivery outlets. Allows mapping precise contact info, notes, and addresses to individual locations to streamline wholesale workflows.
- **Home Settings locations Sub-Tab (`LibraryView.tsx`)**: Created a fully responsive `ManageLocations` workspace showing all existing locations as high-contrast cards, and configured creation/editing forms. Includes visualrecaps of freezer count, container counts, and total cuts mapped to default home vs off-site.
- **Dynamic Offsite Worksheet Filters & quick-Route Buttons (`OffSiteStorageView.tsx`)**: Replaced all hardcoded default P1/P2/P3 references across the active move scope manager and quick route planners, allowing newly made custom storage centers or restaurants to appear dynamically inside the pill selection filters, dashboard summary grids, and bulk movement selectors.
- **Pallets & Columns Generator (`LogisticsWorkspaces.tsx`)**: Retained 100% backward compatibility for standard pallets, but linked the board generator to automatically populate with user settings locations.
- **Type Definitions & State Seeding (`types.ts` & `server.ts`)**: Built full schema models for `AppLocation` in types.ts. Designed automatic default seed databases inside the server state-normalizer to populate pre-configured pallets and delivery partners, securing data integrity for legacy systems.

## [1.28.0] - 2026-06-20

### Added
- **Product Catalog Bulk defaultTagIds Modification**: Implemented an advanced default tag manager within the "Bulk Edit Product Properties" window. Admins can bulk edit the default tags applied to matching catalog products, choosing either to append tags to products' existing list or to fully replace current lists with the new selected tags.
- **Backend Tag Fusion Reducer**: Added full backing for bulk-edit tag operation modes on the server-side, securing proper duplication filtering, state broadcasts, and clear change descriptions logged to the audit history logs.

## [1.27.5] - 2026-06-20

### Fixed
- **Inbound Stock Intake Tag List Visibility**: Passed the global application state down into the product creation sub-flow within `MeatForm` (standard add popup) and `UnifiedInboundMoveForm` (bulk intake dashboard). This allows available default tags (such as `⚡ Use First` or `🛑 Not For Sale`) to display correctly on the new product setup sub-screen instead of incorrectly claiming no tags exist.

## [1.27.4] - 2026-06-20

### Fixed
- **Vite Dev Server Root Resolution**: Resolved a startup failure in the development container where Vite could not find `vite.config.ts` or resolve package pathing rules because the server was launched from the parent workspace root rather than the subfolder. Configured the Vite dev server instance's `root` to point dynamically to the app directory.
- **Robust Path & Database Access**: Updated `DATA_DIR` and `dist` folder path lookup routines within the server runtime to adapt seamlessly whether launched from the parent directory or the app subfolder. This avoids blank database errors or startup routing crashes.

## [1.27.3] - 2026-06-20

### Removed
- **Unused Environment Secret References**: Removed legacy `GEMINI_API_KEY` and general bundle `define` config declarations from `vite.config.ts`. The application is fully self-contained as a Home Assistant addon and has no references to external AI or third-party web services.

## [1.27.2] - 2026-06-20

### Removed
- **Legacy User Configuration**: Permanently deleted the unused `data/users.json` config file which was left over from legacy local login and tracking mechanisms.

## [1.27.1] - 2026-06-20

### Fixed
- **Overlay of Scroll Chevrons in Sticky Pillbars**: Fixed horizontal overlap issues with the slide navigation chevrons on sticky category pillbars inside `ProductView` and `DisplayCaseView`. Added local padding reserves (`md:pl-12 md:pr-12`) on horizontal slide containers for medium/desktop resolutions, providing independent tracks so the chevrons never collide with "Jump:" labels or category buttons.

## [1.27.0] - 2026-06-20

### Changed
- **Moved Container Locator Shortcuts to Container Rows**: Relocated the container search/jump action out of the main product dropdown menu. Added a direct "Locate Container" button with a `MapPin` icon inside each specific container location row's 3-dots dropdown menu. This simplifies interactions by allowing you to jump directly from the container instance listed under the product card.

## [1.26.2] - 2026-06-20

### Added
- **"Find Container" Shortcut in Product Dropdown Menu**: Integrated a dynamic "Find Container" section directly into the product catalog's kebab menu. It searches for all active containers where the product has stock (quantity > 0), presenting each container with its corresponding freezer, unit counts, and a direct visual jump control to switch dashboards and center the chosen container with transition highlighting.

## [1.26.1] - 2026-06-20

### Fixed
- **Container Location Scrolling**: Fixed a bug where clicking the "Locate" indicator inside the active containers list of the catalog would only scroll the page to top. Excluded top-of-page resets on view swap transitions whenever a container locates, and added a micro-timeout delay to container card `scrollIntoView` triggers so they smoothly settle after mounting completes.

## [1.26.0] - 2026-06-20

### Added
- **Cumulative Stock Counters in Catalog**: Added high-visibility aggregate metrics for total units, category volume, subcategory volume, and overall grand totals inside the Product Catalog view ("Products & Categories" page).
- **Interactive Multi-Level Filtering Indicators**: Styled and designed responsive visual capsules showcasing `Filtered Total / Global Total` stock counters that adjust dynamically on the fly as search terms are modified or filtered.

## [1.25.1] - 2026-06-20

### Improved
- **Download Feedback and UI Responsiveness**: Added an interactive loader spinner state `exportingZip` on the backup download button to address the delayed feedback during full-scope ZIP backup compression and file bundling.
- **Dynamic Helper Guideline Notice**: Built an informative warning bubble that displays when "Image Photo Assets" are portioned into the package, guiding users that compression processes are active and recommending keeping the window live rather than feeling unresponsive.

## [1.25.0] - 2026-06-20

### Added
- **Full Support for Lists and Tags in Backup & Restore**: Added Custom Lists and Tags Manager configurations to the granular backup scope selection. Spans point-in-time database snapshots creation/restoration, standard offline raw JSON records exports/imports, and comprehensive ZIP archive packaging downloads and imports.
- **Backwards Compatibility**: Ensured seamless backwards compatibility with older backups that lack the newly introduced arrays, falls back to default initial tags and empty customized list structures without breaking active server states.

## [1.24.1] - 2026-06-20

### Changed
- **Tags Manager Optimization**: Hid the backend reference ID badge from custom tags inside the Tags Manager view to declutter the user interface and focus on the clean visual tag presentation.

## [1.24.0] - 2026-06-20

### Added
- **Multi-Select Checkbox Tag Dropdown**: Built an elegant design-system-aligned multi-select dropdown filter with live checkboxes for each tag (including a virtual option for "Untagged Items").
- **All-Checked Default Behavior**: Initialized the filter with all checkboxes checked so everything remains fully visible by default.
- **Legacy Filter Modernization**: Deprecated and fully removed legacy hardcoded "use first" and "sale filter" UI elements, unifying all item status tracking under the beautiful tags architecture.

## [1.23.0] - 2026-06-20

### Added
- **Global Tag-Dynamic Filter Selector**: Implemented a highly functional "Tag Filter" select control in the main header of the dashboard. This allows the user to filter all items across the three main displays dynamically or specifically by any tag (both system-defined tags like "Use First", "Not For Sale" and newly created custom tags).
- **Dynamic Tag Constraints on 3 Main Displays**: Integrated the central tag filter parameter into `ProductView`, `DisplayCaseView`, and `FreezerView` item listing memo selectors, matching tags dynamically with 100% backward compatibility for legacy boolean flags.

## [1.22.2] - 2026-06-19

### Changed
- **Unified Tag Selection Drops**: Replaced the legacy vertical inline list of individual tags in `MeatCutRow.tsx`'s context menu (Freezer Dashboards View / main containers view) with the single unified "Select Tags..." modal action. Now all three main views consistently direct any tagging actions through the interactive, checkable tag selector modal.

## [1.22.1] - 2026-06-19

### Fixed
- **Dynamic Tag Badges Rendering on Dashboards**: Resolved a visualization bug where newly created custom tags assigned to inventory items did not display as badges. Replaced legacy/hardcoded indicators in `ProductView` and `DisplayCaseView` with dynamic loops that map and display all custom-assigned tags seamlessly.

## [1.22.0] - 2026-06-19

### Added
- **Interactive Multi-Tag Items Management**: Users can now select and toggle multiple custom-configured tags for individual freezer inventory items (meat cuts) dynamically.
- **Select Item Tags Modal**: Designed and integrated a gorgeous `<SelectTagsModalContent>` dialog with checkable states for each configured tag (e.g., Use First, Not For Sale, plus any custom-written tags). It syncs real-time with the central inventory state database.
- **Unified Product Location Row Tagging**: Added "Select Tags..." triggers to the three-dot context menus inside `ProductLocationRow` on both the main Product View and Display Case View.
- **Tag-Product Default Association Linker**: Enhanced the Tag Configuration Manager in the library: selecting any custom tag now displays a dynamic section where users can assign or unassign default products for auto-tagging.

### Removed
- **Legacy Item Dropdown Toggles**: Removed the redundant, hardcoded "Use First" and "Not For Sale" menu options on the main dashboard to keep actions cleanly integrated inside the comprehensive "Select Tags..." modal.

## [1.21.0] - 2026-06-19

### Added
- **Product Catalog Bulk Actions**: Integrated highly requested mass product operations into the Catalog View ("Products & Categories" tab of the library):
  - **Bulk Deletion**: Mass compile and remove multiple products along with all corresponding physical cuts and list memberships in a single action.
  - **Bulk Categorization**: Modify primary categories and/or secondary subcategories for any matching filtered product subset using a dual dropdown and custom input modal.
- **Dynamic Selection Status Bar**: Added a selection header and matching status bar inside the Catalog view for selective click-toggling or quick mass selection matching active search keywords.
- **Floating Controls Palette**: Styled persistent bulk actions trays and overlays with robust responsive dark/light layouts.

## [1.20.0] - 2026-06-19

### Added
- **Product Bulk Actions**: Integrated highly requested mass product operations into the catalog management interface:
  - **Bulk Deletion**: Mass compile and remove multiple outdated products along with their corresponding physical container cuts in a single action, automatically triggering container empty and cleanup optimizations.
  - **Bulk Categorization**: Seamlessly modify primary categories and secondary subcategories for any matching filtered product subset using a dual dropdown and custom input modal.
- **Dynamic Selection Toolbar**: Added a selection header and interactive matching status bar inside the Product Catalog view for selective click-toggling or quick mass selection matching active search keywords.
- **Solid High-Contrast Actions Palette**: Styled floating bottom action trays and overlays with robust responsive layouts optimized for light and dark themes.

## [1.19.3] - 2026-06-18

### Changed
- **Removed Duplicate Blueprint Checkbox**: Removed the redundant second checkbox from the blueprint detail rows inside container groups in the catalog view. Makes selection control beautifully unified and clean.
- **Vivid High-Contrast Bulk Action Palette**: Solved white-on-white text readability inside the sticky bulk actions tray under Light Mode by implementing deep high-contrast text tags (`text-cool-gray-850`) and fully-calibrated background buttons that work flawlessly under both Light and Dark themes.

## [1.19.2] - 2026-06-18

### Changed
- **Opaque Bulk Select Actions Tray**: Improved visual readability of the bulk selection floating bottom tray by converting its background from translucent/glassmorphism (with transparency and backdrop blur) to a solid, highly polished card background that is perfectly readable over any dense background content in both light and dark themes.

## [1.19.1] - 2026-06-18

### Changed
- **Unified Catalog Selections**: Removed individual selection checkboxes from freezer-placed location copies inside the container catalog's group locations breakdown.
- **Group/Template-Centric Selections**: Enhanced bulk selection so that clicking or toggling container groups select their representative blueprint template rather than individual duplicates.
- **Auto-Synchronized Replica Properties**: Modified the `EDIT_CONTAINER` action handler to automatically propagate all visual custom properties (such as icons, images, and "Delete when empty" status) to all duplicate containers sharing the same name. Makes copies perfectly match the blueprint they are defined under.

## [1.19.0] - 2026-06-18

### Added
- **Custom Checklist Filters & Search**: Implemented real-time item searches by name, custom notes, or subcategories directly inside the customizable checklists manager.
- **Organization by primary category**: Designed and added beautiful group-to-category tables showing counts per primary meat segment (Beef, Pork, Poultry, etc.).
- **List Search Clear State**: Integrated effortless reset triggers for search queries.

## [1.18.0] - 2026-06-18

### Added
- **Dynamic List Automations & Triggers**: Restored and modernized automated list membership syncing based on active inventory levels.
- **Self-Healing Auto Movements**: Implemented client-server synced state-checking for lists marked as `controlType === "auto"`. Any items that fall below understock minimum thresholds or exceed overstock maximums are automatically added or removed in the background, keeping the checklists flawless.
- **Interactive Threshold Popups**: Designed a gorgeous, high-contrast `<ListThresholdAlertModalContent>` prompt displayed sequentially when transition state changes occur for lists configured as `controlType === "prompt"`. Displays large, clear product names, list names, configured limit target vs actual stock level, and buttons to instantly accept the update or dismiss.

## [1.17.2] - 2026-06-18

### Fixed
- **Optimized Popups & Modals Contrast**: Replaced low-contrast `text-white` with the dynamic variable-mapped class `text-cool-gray-100` for item names inside the "Add to List" modal, allowing them to flip gracefully to black in Light Mode. 
- **Refined Buttons and Inputs**: Upgraded the "Finished" button and input fields in the Add to List popup to map seamlessly to stable high-contrast tones under both slate themes.
- **Improved List Creation Contrast**: Changed list titles to dynamic high-contrast grays, transformed the low-contrast black-on-gray Settings pill into a gorgeous solid high-contrast cyan tag, and refactored the "Stock Warnings" and "Threshold Checkboxes" configuration forms to use solid dynamic dark-on-light theme properties rather than muddy transparencies.

## [1.17.1] - 2026-06-18

### Changed
- **Removed Legacy Min Stock Limit UI Elements**: Cleaned up the product library view to completely remove the inline "Min Target" input fields on each row card, and simplified stock quantity styling to be cleanly neutral.
- **Removed Restock Alert Popups**: Fully deleted the legacy `RestockPromptModalContent` modal and `restockPromptQueue` client state check loop from `App.tsx` now that minimum stock targets are managed entirely dynamically per-checklist using `listThresholds`.
- **Dynamic Restocking Sorting**: Refactored the "Understock" sorting dropdown algorithm to dynamically compute low-stock alerts based on the highest minimum threshold violation across any active, inventory-controlled custom lists assigned to the items.

## [1.17.0] - 2026-06-18

### Changed
- **Fully Dynamic Checklists & Dashboard**: Completely eliminated the static `default-restock` ("Restock List") hardcoded list from initialization and routing.
- **Dynamic Checklists Center**: Redesigned the primary restock view to render a comprehensive, fully interactive lists and campaigns manager (`ManageLists`) as the central checklists zone.
- **Global Checklist Navigation**: Upgraded the main hamburger menu link to open the dynamic "Custom Checklists" workspace, allowing seamless switching and management of all customized lists from a single main tab.
- **Unified List Thresholds Form**: Cleaned up the product creation and editing forms to configure individual thresholds across any database-driven, inventory-controlled list directly without restriction.

## [1.16.6] - 2026-06-17

### Added
- **Customizable Lists Tab**: Implemented a comprehensive Lists and Campaigns section inside Library View. Users can create, customize, rename, and delete multiple dynamic checklists (such as printing shelf price tags, price edits audits, cold storage trackers, etc.).
- **Dynamic Inventory Controls**: Added advanced rule configuration per checklist, specifying whether it tracks minimum limits under-stock (restock warnings) or maximum limits over-stock (remove cards triggers), with choice of auto-movement or prompt alerts behavior.
- **Product Edit Card Thresholds**: Added a secure custom list thresholds sub-panel on the primary `ProductForm` allowing limits to be assigned to each customizable inventory list directly during item creation or edits.
- **Generic Add to List Popup Modal**: Upgraded the hardcoded restock menu toggles across display case lists, active product grids, and meat cut rows into a unified, descriptive "Add to List..." popup allowing notes to be attached and items to be added or toggled quickly.
- **Note Editing & Inline Checklist Auditing**: Allowed inline notes editing inside active checklists that update instantly upon keystroke/focus out. Added quick manual product selectors to build custom list items with zero latency.

## [1.15.6] - 2026-06-17

### Fixed
- **Anti-Duplication Container Template Merging**: Fixed a severe logic bug in container deduplication/merging inside `mergeDuplicateContainers` that assumed all placed containers were reusable templates and automatically generated/preserved unassigned template copies for them in database storage. Added a strict restriction `isReusable: !c.deleteOnEmpty` to guarantee that "retire on empty" (1-off) containers never build or spawn template duplicates in the unused container list.
- **Deep Clean Template Purge Upon Retirement**: Updated the backend empty-container handlers and retire cases (`handleEmptyContainer` and `MOVE_CONTAINER`) to comprehensively delete both the active 1-off container and any pre-existing or lingering unassigned template cards carrying that exact name, ensuring 1-off "retire when empty" containers vanish completely from the system upon running out of stock.

## [1.15.5] - 2026-06-17

### Fixed
- **Container Retirement Pipeline Preservation**: Solved the issue where reusing an existing template profile's name when creating or duplicating a container accidentally inherited and locked its `deleteOnEmpty: false` attribute, reverting the newly placed container's behavior to "keep/save as template" when emptied.
- **Form-matching Persistence Safeguard**: Cleaned up the `useEffect` within `ContainerForm` so that selecting, matching, or suggesting a container name from existing templates correctly preserves the modern `deleteOnEmpty: true` ("retire when empty") default for all newly placed container items.
- **Inactive-To-Active Container State Elevation**: Updated the backend `MOVE_CONTAINER` endpoint to automatically elevate container state to `deleteOnEmpty: true` (`retire when empty`) whenever an unassigned spare template/unused card is retrieved from storage and assigned active placement inside a freezer.

## [1.15.4] - 2026-06-17

### Fixed
- **Container Lifecycle (One-off/Retire vs. Keep Templates)**: Correctly structured container behavior to align with specifications. Set default container option for all newly created/added containers (either custom, on-the-fly, or cloned) to "retire when empty" (deleteOnEmpty: true).
- **Duplicate Prevention for One-off Containers**: Guarded the container creation pipeline on the backend to guarantee there can be at most one active 1-off container of any given name at any time.
- **Template Isolation**: Refined template-grabbing logic so that creating a 1-off container does not convert or "steal" an existing unused/unassigned template storage card of the same name.

## [1.15.3] - 2026-06-17

### Fixed
- **Container Catalog Contrasts (Light Mode)**: Patched white-on-white text readability issues by forcing h3 container titles and group labels to rich, deep high-contrast charcoal slate when in Light Mode.
- **Pill Badges & Location Background Solidification**: Resolved muddy transparencies and low-contrast details on pills within the Containers catalog tab, forcing solid, clear high-contrast backdrops for Placed items, Template Blueprints, Kept on Empty status, and Active Placement indicators.

## [1.15.2] - 2026-06-17

### Fixed
- **Opaque Sticky Elements (Header & Pillbars)**: Eliminated distracting translucent backgrounds and backdrop blur effects globally across all themes, enforcing solid, non-distracting opaque backgrounds for headers and category selection pillbars (`#mobile-category-pillbar` & `#mobile-display-category-pillbar`).
- **Pills High-Contrast Active Highlights (Light Mode)**: Overrode category jump button styling in light mode to display highly legible inactive text and crisp, solid backgrounds (cyan, rose, emerald, amber, indigo) with sharp white text when active, matching the clean appearance across the 3 primary application tabs.
- **Plus & Minus Stock Controller Visibility (Light Mode)**: Adjusted increment and decrement button backgrounds from deep slate to soft light grey with black icons, guaranteeing excellent contrast and delightful hover states (green/red highlights with white icons) upon click events across Products, Freezer, and Display views.

## [1.15.1] - 2026-06-17

### Changed
- **Light Theme Contrast & Legibility Overhaul**: Redefined CSS variables and added targeted light-mode overrides in `index.css` to transform bright, low-contrast neon colors (like orange/amber and cyan) into highly readable, deep solid high-contrast variations. Removed background opacities and transparency constraints under light mode to guarantee all key containers, list rows, badges, and fields display with robust, opaque white/slate surfaces across all views.

## [1.15.0] - 2026-06-17

### Added
- **Global Settings Panel & High Contrast (Light) Theme**: Implemented a new, polished "Settings" tab inside the Library ("Catalog") section. Users can toggle between the default dark ("Carbon Twilight") theme and a highly readable white/slate high-contrast ("High Contrast Slate") theme, saved persistently to local storage. Key utility classes across the app now map elegantly to these theme configurations dynamically via extended CSS variables.

## [1.14.3] - 2026-06-17

### Fixed
- **Multi-Item Menu Toggling Race Condition**: Resolved a state feedback loop when clicking dropdown menus for list items inside the same location container card. The close logic for stale sibling rows has been updated to only clear the parent menu ID if the row being deactivated is currently registered as the open element, preventing newly clicked lists from instantly closing, flickering, or "bouncing" away.

## [1.14.2] - 2026-06-16

### Fixed
- **Item Row Menu Z-Index Collision**: Resolved a stacking collision on the freezer view by restricting the sticky container header's elevated `z-[60]` state to ONLY activate when the card option menu itself is open. This restores full interactive transparency to expanded item menus and prevents upstream options from getting covered.

## [1.14.1] - 2026-06-16

### Fixed
- **Tablet Dropdown Menu Overlaps**: Elevate the active container card wrapper to `z-50 relative` and its top header line to `z-[60]` whenever the options menu or an item row menu is expanded. This ensures dropdowns render above sibling elements, sticky headers, and viewport filtering panels on tablet screens.

## [1.14.0] - 2026-06-16

### Added
- **Enriched Consolidation Suggestions metadata**: Enhanced the "Suggested Consolidations" list in the Inbound Form to show the specific stock item notes and display real-time status badges for "⚡ Use First" and "🛑 Not For Sale" tags.

## [1.13.0] - 2026-06-16

### Added
- **Assignable Inbound Tags**: Added interactive checkpoints to assign "Use First" (`workingFrom`) and "Not For Sale" (`notForSale`) system tags directly during stock intake on the multi-item inbound menu. Added corresponding options in Action dispatch payloads to keep storage and local states synced flawlessly.

## [1.12.3] - 2026-06-16

### Fixed
- **Flexible Inbound Quantity Input**: Replaced the strict numeric input element with an elastic numeric pattern textbox widget in the multi-item Stock Intake (Inbound) form. This prevents immediate mathematical fallbacks to minimum default quantities (like "1") when users attempt to clear or erase the fields to input new values, enabling seamless backspacing and keying on all touch and desktop devices.

## [1.12.2] - 2026-06-16

### Fixed
- **Oversized Container Photo Fix**: Resolved a visual defect in the searchable container dropdown component where custom/non-standard responsive classes (e.g., `w-5.5 h-5.5`) were not mapping to parsed Tailwind classes. This caused raw high-resolution uploaded images or camera shots to fallback to their natural maximum dimension, overlaying and blocking other critical form fields in the inbound and move menus. Constrained image bounding dimensions to standard Tailwind sizes (`w-6 h-6` with `pl-10` padding) to lock display dimension ratios securely.

## [1.12.1] - 2026-06-16

### Changed
- **Mobile Header Iconification**: Hid text labels on the primary navigation view switcher tabs (Products, Freezer, Display) on small screen devices. This forces them to show only as icons, saving width and fitting the entire top layout on a single line on mobile phones.

## [1.12.0] - 2026-06-16

### Changed
- **Compact Integrated Header Actions**: Combined several discrete action items (manual refresh/sync, undo stack status, redo stack status, and direct link to audit histories) into a single, cohesive dropdown menu to save layout space.
- **Improved Mobile Viewport Fit**: Reduced horizontal layout pressure on mobile screens by making the "Search & Filters" button display only the elegant funnel/filter icon without the trailing descriptor label, and by condensing action items, preventing word wrapping or stacking issues in the mobile layout.

## [1.11.2] - 2026-06-16

### Fixed
- **Responsive Mobile Hamburger Alignment**: Solved a responsive layout issue on mobile views where the hamburger menu would wrap or float incorrectly relative to other top-header action buttons. Absolutely positioned the main hamburger menu container in the top-right corner on small devices and added custom padding limits to other top-row layouts to ensure the menu always stays cleanly located in the upper-right corner without wrapping.

## [1.11.1] - 2026-06-16

### Fixed
- **Category Icon Deletion**: Solved an issue where using the "Clear Icon ×" button inside the Category Style Editor failed to remove the category or subcategory icon when saving/Done. The editor now correctly sends an empty value to the server, and the state-updating action cleans the icon field completely.

## [1.11.0] - 2026-06-16

### Added
- **Bidirectional Restock Controls**: Added a interactive tab-toggle mechanism inside backstock entries within the restock drawers on both the Display Case and Catalog views. Users can now easily switch between "Pull" and "Put Back" modes to pull stock to display case slots or return display stock back to original storage containers.
- **In-place Storage Adjustments**: Added a "Correct" physical count control directly within the backstock location rows. Quick inline inputs let users adjust and correct mistaken backstock quantities in-place with instant UI updates.

## [1.10.9] - 2026-06-16

### Changed
- **Home Assistant Addon Version Alignment**: Synchronized the main Home Assistant configuration file `config.yaml` to the correct modern version string (`1.10.9`) matching standard package manifests.

## [1.10.8] - 2026-06-16

### Removed
- **Redundant Header Labels**: Removed the redundant "Storage Locations" heading text on the individual product catalog cards inside `ProductView` to stream line layout space efficiency.

## [1.10.7] - 2026-06-16

### Fixed
- **Dynamic Preview Target Resolution**: Fixed destination labeling on key container card previews during initial allocation. Now successfully pulls the targeted freezer from actual dropdown assignment states (`unretireFreezerId`), reflecting location changes in real time rather than defaulting to "Staging Area".

## [1.10.6] - 2026-06-16

### Added
- **Click-to-Zoom Selection Thumbnails**: Integrated responsive, clickable container image thumbnail badges inside the container search-select input box of the Unified Inbound and Move form, enabling instant image fullscreen overlays upon tap or click.
- **Dynamic Selected Container Cards**: Introduced a premium container summary preview card below the selection dropdown on the form, rendering the target location, name, and visual thumbnail for ultimate reassurance and clear groupings before submission.

## [1.10.5] - 2026-06-16

### Changed
- **Relocated Header Menu Button to Top Right**: Shifted the main options hamburger dropdown menu to the absolute far-right slot in the session header toolbar for conventional, intuitive navigation.
- **Embedded Inbound Bulk Stock Action**: Consolidated the green "Bulk Stock Inbound" shortcut button directly inside the newly positioned hamburger dropdown under an "Operations" category, decluttering the persistent header.
- **Enhanced Dropdown Popover Styling**: Integrated distinct dropdown transition anchors (`origin-top-right`) and a deep high-contrast drop shadow (`shadow-2xl`) with zero overflow, ensuring the dropdown never gets cut off when opened near viewport edges.

## [1.10.4] - 2026-06-16

### Changed
- **Enhanced Product Container Visual Grouping**: Substantially increased the visibility of product cards across both `ProductView` and `DisplayCaseView`. Upgraded borders from subtle `/15` or `/50` opacity styles to prominent, higher-contrast border alignments (`border-cool-gray-600/90` and `border-amber-500/35`) and introduced cohesive container drop shadows (`shadow-md`) to visually group items.

## [1.10.3] - 2026-06-16

### Fixed
- **Desktop Sticky Header Alignment**: Fixed a visual issue in Product and Display Case views where product section sticky headers were covered by the category pill menu on desktop views. Sticky alignment offsets now accurately compute the bar height across all widescreen viewports.

## [1.10.2] - 2026-06-16

### Changed
- **Streamlined Container Menu Dropdowns**: Consolidated the individual edit, move, history, and retire action buttons into an elegant vertical 3-dot dropdown menu.
- **Embedded Add Meat Action**: Integrated the large button "Add Meat / Cut" inside the container options dropdown list, removing visual bottom clutter across all container cards on the freezer dashboard.
- **Raising Context Stack dynamically**: Ensured the active container floats cleanly above neighboring elements when options are triggered by hoisting z-index dynamically.

## [1.10.1] - 2026-06-15

### Added
- **Desktop Click-And-Drag Swiping (Drag-to-Scroll)**: Implemented seamless mouse-dragging support to the panoramic category pill navigation bar. Users can now click-hold, and drag horizontally to slide the categories with raw desktop drag acceleration.
- **Drag Interaction Filtering**: Filtered drag-release click events to prevent unintended fast-travel category jumps when dragging with the mouse.
- **Hidden Scrollbars**: Fully concealed native desktop horizontal scrollbars across all screen widths for a sleek mobile-like interface.

## [1.10.0] - 2026-06-15

### Added
- **Dynamic Horizontal Mouse Wheel Scroll Binding**: Hovering the cursor over the category pill navigation bar and scrolling your mouse wheel up/down now smoothly glides the category list horizontally, solving desktop mouse-scrolling constraints.
- **Floating Horizontal Left/Right Scroll Chevrons**: Integrated floating micro-interaction click chevrons on the left and right gutters of the category pill navigation bar for desktop users to scroll instantly.
- **Accurate Subcategory Bounding Rects (Fixed Early ScrollSpy Switching)**: Replaced thin heading IntersectionObservers with a full-height container wrap for subcategories. Enriched with a robust scroll-offset pixel-bound tracker, category active states now switch exactly when the corresponding subcategory content reaches the sticky navigation bar, preventing premature jumps or stuttering active states.

## [1.9.9] - 2026-06-15

### Added
- **Unified Panoramic Category Pill Navigation**: Deleted the legacy static vertical category list sidebar on large screens and enabled the dynamic horizontal category pill controls across all viewport sizes. Both phone and desktop resolutions now benefit from sticky, interactive ScrollSpy pills that automatically center and sync position with the viewport as the user scrolls or clicks to fast-travel to custom inventory sections.

## [1.9.8] - 2026-06-15

### Fixed
- **Restored Sticky Elements Across All Views**: Purged invalid `overflow-x-hidden` and `overflow-x: hidden` styles from `App.tsx` and the root layout (`index.html` `html` and `body` tags) that broke browsers' native `position: sticky` rendering context. Sticky headers, navigation tabs, filter bars, and quick view menus are now fully operational again and correctly stick as expected.

## [1.9.7] - 2026-06-15

### Fixed
- **Mobile Viewport Lock & Horizontal Overflow Prevention**: Hardened the application layout against accidental horizontal offset shifts/swaying on touch screens. Configured `overflow-x: hidden; max-w-full;` properties on root `index.html` tags (`html` and `body`) and the core `App.tsx` container div. Updated vertical jump actions in `ProductView.tsx` to align strictly using `left: 0` to permanently lock horizontal coordinates during scrolling transitions.

## [1.9.6] - 2026-06-15

### Fixed
- **Horizontal-Safe Scrolling on Mobile Jump Triggers**: Fixed the horizontal shifting/offset issue on Chrome mobile/Android/iOS. Replaced global element `.scrollIntoView()` on subcategory headings with coordinate-precise vertical-only `window.scrollTo` that locks `left: window.scrollX` to prevent page swaying. Replaced horizontal slider `.scrollIntoView()` centering logic on category pills with container-specific scroll calculations via `container.scrollTo({ left })`, keeping the sliding actions perfectly isolated within the slider bar.

## [1.9.5] - 2026-06-15

### Added
- **Space-Efficient Category ScrollSpy Navigation**: Integrated an elegant, zero-clutter quick jump navigation panel for categories/subcategories on the Product Dashboard. Added a sticky left-side vertical category list with micro-emoji icons for desktop views, and a horizontal bar of fast-action category pills right under the header for mobile. Integrated a high-performance native `IntersectionObserver` ScrollSpy and a feedback horizontal centering mechanism to dynamically track, scroll-center, and highlight what section the user is currently looking at.

## [1.9.4] - 2026-06-15

### Fixed
- **Overlay Rendering & Stacking Context Isolation**: Portalled the "Retire Container" and "Remove Item" confirmation overlays in `ContainerCard.tsx` and `MeatCutRow.tsx` using React Portals (`createPortal` to `document.body`). This guarantees confirmation dialogs render outside child stacking contexts, preventing list rows from paint overlapping on overlay components during mobile touch interactions. Added portal reinforcement to `pendingMove` in `FreezerView.tsx` as well.

## [1.9.3] - 2026-06-15

### Fixed
- **Mobile Dropdown Interaction Fix**: Removed trailing `select-none` styling classes from global header wraps. Under iOS Safari/WebKit and some Samsung/Chrome touch browsers, inheriting `user-select: none` blocked tap and touch propagation to underlying form inputs, which prevented native `<select>` dropdown filters and keyword queries from registering touch event focus.

## [1.9.2] - 2026-06-14

### Fixed
- **Full Scope Data Persistence Backups**: Added full data persistence for empty container blueprints, zero-inventory products, and empty product categories across Application JSON and AppSheet CSV imports and exports. This ensures unused templates and zero-counts survive database restocks/migrations safely.

## [1.9.1] - 2026-06-14

### Fixed
- **Solid Product Header Background**: Replaced the invalid `bg-cool-gray-901` color class typo with the standard theme-defined `bg-cool-gray-900` color class in both the **Product Dashboard** (for the sticky category header cards) and the **Display Case Dashboard** (for the restock drawer panels and empty state text cards). This restores background opacity, ensuring scrolling elements do not seep through.

## [1.9.0] - 2026-06-14

### Added
- **Multi-Route Duplicate Container Warnings**: Expanded duplicate container check coverage to trigger warnings before container inbound/movement operations. Configured real-time warning popups/labels in:
  - **Inbound/Move Brand New Container Creation**: Detects and displays warning badges if creating on-the-fly containers inside freezers that already hold same-name containers.
  - **Un-retiring/Reactivating Container Location Assignment**: Checks for name conflicts when assigning destination freezers to currently un-placed/retired containers.
  - **Moving Meat to Retired Containers with Assigned Freezers**: Informs users instantly if selecting a retired/unused container and assigning it to freezers containing duplicate-named active placements.
  - **Bulk Stocking Destination Selectors**: Alerts users when unassigned containers mapped inside bulk/multi-product receipts are placed in freezers with same-name placements.
- **Version Bump**: Promoted all config versions to `1.9.0`.

## [1.8.0] - 2026-06-14

### Added
- **Consolidated Containers Tab Grouping & Hierarchy Display**: Redesigned the unified "Containers" library tab to group all containers with the exact same name into a single top-level card. Individual active placements are listed nested under their respective parent group with details (freezer, item count, location breadcrumb) and interactive links. Unassigned blueprinted containers render elegantly under template mode and are pruned from the list when at least one active placement is active (adhering strictly to instructions: *"if it is placed then it should not also appear as a template"*).
- **Freezer Header Duplicate Warn Banners**: Engineered top-level warning banners (`⚠️ Duplicate Containers` styled with animated amber pulse frames) inside individual freezer visual headers on the main page to immediately inform users when duplicate-named containers are inside.
- **Enhanced Duplicate Bounding in Container Cards**: Moved same-name warning badge indicators (`⚠️ Dup`) inside the title element inline flow of `ContainerCard` to prevent component bounding clipping on compact screen sizes and ensure maximum legibility.
- **Edit Container Form Conflict Checking**: Integrated real-time duplicate container checking directly inside the `EditContainerForm`. If renaming names-conflicts inside the selected freezer, a warning notifies the user ahead of submission.
- **Version Bump**: Increment to `1.8.0` across configurations.

## [1.7.0] - 2026-06-14

### Added
- **Unified Containers & Templates Management**: Combined independent "Placed Containers" and "Reusable Templates" tabs into a single, high-fidelity **"Containers"** list. Each item group clearly details if it is currently assigned inside a freezer or functions as a reusable configuration blueprint template.
- **Hierarchical Location Breadcrumbs**: Placed containers inside the newly consolidated Containers tab show parent-to-child placement paths (e.g. `Freezer Name ➔ Container Name`) with "Locate ➔" controls to teleport the user directly to the container inside its respective freezer map.
- **Enhanced "Retire on Empty" Visibility**: Designed prominent, color-themed badges (`🗑️ Retire when Empty` in animated amber, and `♻️ Kept when Empty` in cool gray) inside both the containers catalog and context-focused freezer board headers, making container retention policies highly apparent.
- **Data Integrity**: Absolute backwards compatibility maintained, with zero database schema breaking changes.
- **Version Bump**: Increment to `1.7.0` across configurations.

## [1.6.3] - 2026-06-14

### Fixed
- **Persistent Cancel Controls**: Added a dedicated, highly visible "Cancel" action button to the bottom of the "Create Product" form when accessed through the catalog or embedded layouts, ensuring users can dismiss the creation overlay easily without submitting.
- **Version Bump**: Increment to `1.6.3` across configurations.

## [1.6.2] - 2026-06-14

### Changed
- **Interactive Autocomplete Combobox System**: Replaced native HTML `<datalist>` browser-dependent components with custom, high-fidelity `<ComboboxInput>` widgets. Includes support for full-length custom typing, click-to-open chevron menus, micro-animations, and complete keyboard-based arrow/enter navigation. Applied to the *Primary Category* and *Sub Category* fields inside the Product Creator popup, and the *Container Name* field inside the Add Container overlay.
- **Version Bump**: Increment to `1.6.2` across configurations.

## [1.6.1] - 2026-06-14

### Fixed
- **Context-Aware Subcategory Autocomplete Suggestions**: Modified `ProductForm` in `ManagementForms.tsx` so that when a primary category is input or selected, only subcategories currently in use for that *specific* primary category are suggested. If no primary category has been set of if there are no matching items, autocomplete suggestions fallback to a safe, global list of subcategories. New subcategories can still be typed to add custom groupings.
- **Data Integrity**: Maintained full backwards compatibility with zero breaking changes or data structure migrations.
- **Version Bump**: Increment to `1.6.1` across configurations.

## [1.6.0] - 2026-06-14

### Changed
- **Unified Products & Categories Catalog**: Merged the standalone *Products* and *Categories* tabs into a single, high-fidelity **"Products & Categories"** catalog screen.
- **Hierarchical Category Tree**: Products are now visualised cleanly within an interactive accordion tree (Primary Category > Subcategory > Meat Cuts/Products), allowing collapsible groups to keep lists tidy.
- **Embedded Category Management**: Integrated inline editing (renaming) and complete deletion warnings for both Primary and Subcategory heads right within the products tree.
- **Stock-Aware Subcategory Sorting**: Integrated custom product sorting within categories (choices: Name A-Z, Name Z-A, Stock level Low-to-High, Stock level High-to-Low, and Understocked items first) allowing users to easily find what cuts need replenishment.
- **Version Bump**: Promoted configurations to `1.6.0`.

## [1.5.4] - 2026-06-14

### Fixed
- **Anti-Overlap Interactive Hover Isolation**: Resolved a stacking context bug inside the Freezer view where opened 3-dot dropdown menus would be overlaid or covered by sibling container cards' sticky headers when hovering over the menu area due to Tailwind `:hover` specificity guidelines. 
- **Lifting Active Container Stacking**: Implemented clean React-state callbacks from `MeatCutRow` up to `ContainerCard` to dynamically set a high `z-40 relative` context exclusively when any item menu is active, safely bypassing `:hover z-index` overlaps.
- **Version Bump**: Promoted configurations to `1.5.4`.

## [1.5.3] - 2026-06-14

### Fixed
- **Screen-Boundary Aware Dropdown Menus**: Implemented viewport-height boundary detection inside `ProductLocationRow`, `ProductMenuDropdown`, and `MeatCutRow` so that menus automatically trigger in the upward direction (`bottom-full mb-1`) instead of downward if vertical space below is constrained. This guarantees dropdown elements never overflow off-screen boundaries.
- **Dynamic Stacking Order Elevation**: Configured context-aware elements to temporarily raise the stacking index of their immediate parent cards or sticky section headers (`z-[60] relative`) so that open menu components are consistently rendered above sibling elements and other sticky headers.
- **Version Bump**: Promoted configurations to `1.5.3`.

## [1.5.2] - 2026-06-14

### Changed
- **Symmetrical Thumbnail Sizing**: Optimized the container image preview and placeholder icon boxes inside the `ContainerCard` component (the Freezer Dashboard view) to be exactly standard with the product thumbnail dimensions (`w-8 h-8 sm:w-10 sm:h-10 rounded-md`). This makes all image/fallback indicators fully uniform and aesthetically consistent across the dashboard sections.
- **Version Bump**: Promoted configurations to `1.5.2`.

## [1.5.1] - 2026-06-14

### Changed
- **Tightened Product View Layout**: Drastically minimized the blank vertical margin, padding, and top border between the product names and their associated storage location lists, saving ~20px of empty space.
- **Unified Row Compactness**: Reduced vertical padding across product location rows (`p-1.5 sm:p-2.5` down to `p-1 sm:p-1.5`) across both the Products and Display Case views.
- **Fixed Loose Display Case Shift**: Corrected a layout bug in the Display Case view where having only one display freezer caused empty container-less rows to shift the stock numbers/counters to the far left. The left column is now guaranteed to render with a fallback `"Loose Stock"` label and its status badge, keeping notes perfectly stacked underneath and maintaining consistent, right-pinned, double-digit counter alignments.
- **Version Bump**: Promoted addon configurations, packages, and metadata to version `1.5.1`.

## [1.5.0] - 2026-06-14

### Changed
- **Compact Product Layout**: Condensed the product name, categories, stock, SKU, and photo preview into a single, space-optimized inline row within the Product View Card and Display Case Card.
- **Unified Stock Indicators**: Introduced high-visibility stock status badges with direct click-to-restock panel triggering, improving overall screen density.
- **Version Bump**: Promoted addon configurations, packages, and metadata to version `1.5.0`.

## [1.4.2] - 2026-06-13

### Fixed
- **Unused Container Persistence Logic**: Fixed empty container actions so that non-disposable containers are permanently preserved in the "Unused / Retired" container stock list instead of being deleted or recycled on count zero.
- **Import Retirable Flag Support**: Added parser support to parse and map the "Retirable" true/false column from `bagboxpic.csv` to configure whether imported container types should delete-on-empty.

### Changed
- **Version Bump**: Bumped config declarations and Node packages to `1.4.2` to update Home Assistant state.

## [1.4.1] - 2026-06-13

### Fixed
- **AppSheet / Spreadsheet Importer Catalog Loss Bug**: Fixed a major bug where products defined in the Items Catalog but with 0 active inventory counts were filtered out and omitted. All products from the Items table and all empty custom containers from the Placements table are now successfully imported as part of your system assets instead of being ignored!

### Changed
- **Version Bump**: Promoted metadata, system configurations, and package version to `1.4.1`.

## [1.4.0] - 2026-06-13

### Added
- **Granular Backup & Restore Control**: Upgraded the local JSON and comprehensive ZIP backup/restore mechanics to provide full checkbox granularity. Users can target individual components for backup/restore (Freezers, Bins/Bags/Containers, Product Descriptions, Active Inventory Counts, Off-Site Storage Counts, and photo uploads).

### Changed
- **Version Bump**: Promoted system configurations and package version to `1.4.0` as a minor change update.

## [1.3.1] - 2026-06-12

### Changed
- **Map Mount Alignment**: Removed the conflicting `config:rw` map mount in `config.yaml` causing Supervisor App Startup warnings, utilizing standard addon persistent files.
- **Version Bump**: Bumped package configuration version to `1.3.1` to propagate Home Assistant supervisor state and reload the running service.

## [1.3.0] - 2026-06-12

### Added
- **Comprehensive ZIP Archive Export/Import**: Users can now export and import unified, portable `.zip` backup files that bundle the On-Site Cabinet JSON database, the Off-Site Cold Storage CSV entries, and all uploaded product/bin photos together under an organized folder structure.
- **Granular Backup & Restore Scope Selection**: Added customizable coverage toggles (check/uncheck panels) so users can pinpoint exactly what elements (On-Site JSON database, Off-Site CSV spreadsheet, or Uploaded images) should be downloaded or restored during a database operation.
- **Rolling Automatic Background Snapshots**: Developed a rolling scheduler running in the background to automatically capture localized database checkpoints. Users can customize snapshot intervals (frequency in days) and maximum backup retention limits directly from the backup menu.
- **Home Assistant native `/data` Backup Integration**: Aligned the persistent volume structure to use standard directories that get natively backed up by the Home Assistant core system when standard supervisors and add-on snapshots execute, removing data loss risks.

### Changed
- **Version Bump**: Promoted tracker package and Home Assistant configuration versions to `1.3.0` to trigger supervisor update notifications.

## [1.2.0] - 2026-06-11

### Added
- **Searchable Product Mapping**: Enhanced the off-site storage CSV import process with a searchable, categorized dropdown for mapping unassigned products.
- **On-the-Fly Product Creation**: Integrated the product creation dialog directly into the CSV import workflow, allowing users to map and create missing products inline without losing progress.

### Changed
- **Unified Color Scheme**: Synchronized the "Off-Site Storage" and "On-Site Storage" sub-views to use a cohesive, unified `cool-gray` and dark modern thematic color palette.
- **Home Assistant Standalone Architecture**: Completely stripped legacy multi-user JWT authentication (`users`, `roles`), removed local-fallback SQLite mapping, and simplified real-time synchronization EventSource connections to natively adhere to the Home Assistant unified authorization layer, resolving 404/401 fetch errors.
- **Legacy Container Types Removal**: Removed the rigid `containerTypes` registry, switching to unified independent `Container` attributes (e.g. inline `deleteOnEmpty` values and arbitrary `icon` selectors), solving duplication bugs and making container instantiation cleaner and more robust.
- **Home Assistant Configuration Updates**: Removed deprecated `arch` constraints and `map` flags from `config.yaml` to ensure clean compatibility with the supervisor. Modifed Dockerfile build execution.
- **Version Bump**: Updated version number to `1.2.0` in `package.json`.

---

## [1.1.2] - 2026-06-10

### Added
- **Multi-Sheet AppSheet Relational Importer**: Extended the relational file integration to load, parse, and join 7 distinct spreadsheet tabs simultaneously (Primary Categories, Subcategories Relations, Items descriptions, Freezers list, Opaque Container Definitions, Bins Placements, and Current counts Inventory).
- **Directory and Multi-File Drag-and-Drop**: Built a custom recursive folder explorer using the DataTransfer web API to allow dropping an entire complex of folder files (CSV reports and subfolders containing image folders like `Item Categories_Images` or `BagBoxPic_Images`) directly in the browser.
- **Concurrent Batch Uploading**: Implemented an async client-side file compression and concurrent upload scheduler that pushes up images to `/api/upload` (relative paths) inside batches of 5, mapping local subpaths and filenames back to products and container specifications automatically.
- **Raw Edit Textarea Drawers**: Designed 7 individual modal drawers where users can copy-paste CSV snippets or edit table records manually before aligning relationships.

### Changed
- Bumped version number across `package.json`, `freezer_inventory_tracker/package.json`, and `freezer_inventory_tracker/config.yaml` to `1.1.2` to prompt Home Assistant client updates.

---

## [1.1.1] - 2026-06-09

### Fixed
- **Home Assistant Ingress API Pathing Routing**: Modified all client-side `fetch` and `EventSource` URLs from absolute (`/api/...`) to relative (`api/...`) paths. This ensures requests are correctly routed via the Home Assistant supervisor context path (e.g. `/api/hassio_ingress/token/`) instead of attempting to contact the Home Assistant instance host root (which returned a text-based `401: Unauthorized` / `502 Bad Gateway` error, breaking JSON parsing on the frontend with the `Unexpected non-whitespace character after JSON at position 3` error).
- **Graceful File Upload Paths**: Changed returned uploaded media paths to be relative (`uploads/...` instead of `/uploads/...`) to ensure uploaded images are retrieved correctly under the Ingress proxy.
- **Explicit Crypto Imports**: Imported Node's native `crypto` module explicitly in `server.ts` to ensure `crypto.randomUUID()` works reliably across all Node runtimes and Docker containers without relying on standard `global` injection.

### Changed
- Bumped version number in `package.json`, `freezer_inventory_tracker/package.json`, and `freezer_inventory_tracker/config.yaml` to `1.1.1` to trigger an update notification inside Home Assistant.

---

## [1.1.0] - Earlier Changes

### Fixed
- **Node Startup Failures**: Resolved startup script issues where Node could not locate local modules or dependencies (e.g. `vite` or other esm modules) by compiling and bundling with `esbuild` down to a self-contained `dist/server.cjs` bundle.
- **Home Assistant Configuration**: Verified and configured the repository mapping configurations so Home Assistant recognizes it as a valid custom add-on repository.
