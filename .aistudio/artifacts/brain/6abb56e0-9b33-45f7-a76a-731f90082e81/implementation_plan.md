# Comprehensive End-to-End Automated Test Suite

A complete, production-grade automated testing suite that validates the full farm-to-freezer lifecycle: restoring a sample database, intake and butcher CSV processing with deduplication, multi-facility off-site logistics, home freezer operations, sales, reconciliations, and backup/restore integrity.

## User Review & Critical Decisions

> [!IMPORTANT]
> The test architecture uses Vitest with an isolated SQLite database environment to run realistic full-stack workflows without contaminating live production databases. All tests run cleanly inside `npm test` so that every CI build, Home Assistant release, and commit automatically executes the full workflow suite.

- **Confirmed Decision 1**: Execute end-to-end workflows using realistic server API operations and SQLite database integration within the Vitest test runner.
- **Confirmed Decision 2**: Provide bundled realistic fixture files (`sample_farm_restore.json`, `initial_butcher_cutsheet.csv`, and `appended_butcher_cutsheet.csv`) in `tests/fixtures/`.
- **Confirmed Decision 3**: Run the comprehensive workflow suite directly within `npm test` so that all 8 core test suites execute synchronously on every build.

---

## 1. Overview & Core Concept

- **What It Does**: Establishes a comprehensive, multi-phase automated integration test suite covering the entire user journey:
  1. **Restore Initial State**: Restores a sample database containing locations, products, categories, freezers, and containers.
  2. **Butcher Intake & CSV Upload**: Creates a new butcher order, parses and imports a 7-column/8-column butcher CSV cutsheet, matches cuts to products, and assigns them to the butcher location.
  3. **CSV Append & Deduplication**: Uploads an updated CSV containing additional cuts and verifies that existing cuts are not duplicated while new cuts are appended.
  4. **Off-Site Logistics & Pallet Staging**: Moves cuts from the butcher facility to cold storage on a pallet, and transfers designated cuts to home into the unassigned staging area.
  5. **Home Freezer Allocation**: Moves items from staging into individual freezers (e.g. Chest Freezer, Walk-In) and specific bins.
  6. **Daily Home Operations**:
     - Moves items between bins and freezers (with variant consolidation).
     - Restocks items based on inventory thresholds.
     - Transfers retail stock into the display freezer.
     - Sells items by reducing quantities (outbound) and verifies automatic container archiving when emptied.
     - Combines containers and preserves cut groupings.
     - Creates containers from existing reusable container templates.
     - Performs freezer reconciliations (verifying count adjustments, shrinkage, and audit history logs).
  7. **Outbound to Off-Site**: Moves home inventory into staging and shifts it off-site, assigning tare/net weights and inventory box numbers.
  8. **Backup & Restore Roundtrip**: Creates a full system backup snapshot, executes destructive inventory mutations, restores the backup, and verifies bit-for-bit data parity across all tables.

---

## 2. End-to-End Test Workflow Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AUTOMATED WORKFLOW SUITE                               │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [Phase 1: Database Initialization]
       │
       ▼
  Restore Sample Database ──► Validate 20+ Tables, Locations, Products, Freezers
       │
       ▼
  [Phase 2: Butcher Ingestion & CSV Deduplication]
       │
       ├─► Create Butcher Order (Species, Animal Count, Kill/Hang Weights)
       ├─► Upload Initial CSV Cutsheet (Serial, Cut, PackDate, Lot, Pieces, Weight, Box)
       ├─► Assign Cuts to Butcher Location & Pallet
       └─► Re-upload Modified CSV with New Records ──► Verify Zero Duplication
       │
       ▼
  [Phase 3: Multi-Facility Off-Site Logistics]
       │
       ├─► Create Movement Order: Butcher Facility ──► Cold Storage & Home
       ├─► Cold Storage Items ──► Remain on Pallet at Off-Site Facility
       └─► Home Items ──► Move to Home Staging Area (staging_loose)
       │
       ▼
  [Phase 4: Home Freezer Inventory Operations]
       │
       ├─► Allocate from Staging into Walk-In & Chest Freezer Containers
       ├─► Restock Display Freezer from Storage Freezers
       ├─► Sell Cuts (Outbound Deductions) ──► Test Zero-Quantity Container Cleanup
       ├─► Combine Containers (Merge Bin B into Bin A with Variant Consolidation)
       ├─► Create Containers using Container Templates
       └─► Freezer Reconciliation (Audited Physical Inventory Count Verification)
       │
       ▼
  [Phase 5: Reverse Staging & Off-Site Movement]
       │
       ├─► Move Cuts from Home Freezers to Home Staging
       └─► Dispatch from Home to Off-Site Location with Box Numbers & Weights
       │
       ▼
  [Phase 6: Backup & Restore Verification Roundtrip]
       │
       ├─► Generate Full System Backup (ZIP & SQLite)
       ├─► Execute Destructive Mutations (Delete Containers, Empty Freezers)
       ├─► Restore Previous Backup Snapshot
       └─► Assert Strict Data Integrity Across All Tables & History
```

---

## 3. Key Technical Decisions & Trade-Offs

- **Isolated SQLite In-Memory / Ephemeral DB per Test Suite**:
  - *Chosen Approach*: Each test suite initializes an isolated, lightweight SQLite instance using the identical schema definitions and migrations from `server.ts`.
  - *Why*: Guarantees hermetic, reproducible tests that execute in seconds without polluting the production database (`/data/inventory.db`) or leaving lingering files on developer machines.
- **Bundled CSV & JSON Fixtures**:
  - *Chosen Approach*: Real-world fixture files in `tests/fixtures/` representing actual butcher cutsheets (Beef & Pork cuts, serials, weights, pack dates) and farm database states.
  - *Why*: Tests run against real-world edge cases (quoted fields, hyphenated box numbers, unmapped cut names, floating-point weights) rather than synthetic hardcoded strings.
- **Relational Consistency Verification**:
  - *Chosen Approach*: Assert foreign key integrity and relational normalization rules across `butcher_orders`, `off_site_entries`, `containers`, `meat_cuts`, and `history`.

---

## 4. Technical Architecture & Test Suites

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TEST SUITES                               │
├───────────────────────────────────┬────────────────────────────────────┤
│ tests/fixtures/                   │ Realistic Data Fixtures            │
│   ├── sample_farm_restore.json    │ Full backup snapshot with 20+ tbls │
│   ├── initial_butcher_cutsheet.csv│ First intake cutsheet (15 cuts)    │
│   └── appended_butcher_cutsheet.csv│ Updated cutsheet with 5 new cuts   │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/restore-lifecycle.test.ts   │ Database restore, backup, reload   │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/butcher-csv-workflow.test.ts│ Order creation, CSV parse, dedup   │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/offsite-logistics.test.ts   │ Movement orders, pallets, staging  │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/home-operations.test.ts     │ Move, restock, display case, sales │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/container-merge.test.ts     │ Templates, create, combine bins    │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/reconciliation.test.ts      │ Physical reconciliation audits     │
├───────────────────────────────────┼────────────────────────────────────┤
│ tests/reverse-staging.test.ts     │ Home to off-site dispatch flow     │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Planned Test Implementation Steps:
1. **Fixtures Creation**: Build realistic CSV files and JSON database backup fixtures in `tests/fixtures/`.
2. **Restore & Backup Suite (`tests/restore-lifecycle.test.ts`)**: Validate preview, dependency checking, selective and full restore, and roundtrip data fidelity.
3. **Butcher Intake & Deduplication Suite (`tests/butcher-csv-workflow.test.ts`)**: Validate CSV parsing, product auto-mapping, target location/pallet assignment, and duplicate prevention when importing an updated CSV.
4. **Off-Site Logistics Suite (`tests/offsite-logistics.test.ts`)**: Validate multi-stop movement orders, pallets at cold storage, and home staging intake.
5. **Home Operations Suite (`tests/home-operations.test.ts`)**: Validate moving cuts, restock thresholds, display freezer stocking, sales deductions, and auto-archive.
6. **Container & Template Suite (`tests/container-merge.test.ts`)**: Validate template instantiation, container merging, and variant consolidation.
7. **Reconciliation Suite (`tests/reconciliation.test.ts`)**: Validate count reconciliation, variance tracking, and audit log generation.
8. **Reverse Movement Suite (`tests/reverse-staging.test.ts`)**: Validate packing home items into boxes, staging, and transferring to off-site with weights and tracking numbers.
9. **Full Build & Test Verification**: Execute `npm test` and `compile_applet` to ensure 100% pass rate.
