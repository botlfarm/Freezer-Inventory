# Custom Developer Agent Instructions for Freezer Inventory Tracker

These guidelines must be strictly followed by any AI agent or assistant when working on this repository to maintain perfect stability, history, and Home Assistant live compatibility.

## 1. Automated Version Control & SemVer Bumping
Every single change made to the codebase—no matter how trivial, small, or cosmetic—**MUST** bump the application's version in all relevant files.

### Action Checklist
- Bump `"version"` in `/freezer_inventory_tracker/package.json`
- Bump `version` in `/freezer_inventory_tracker/config.yaml`
- Create a corresponding release header in `/freezer_inventory_tracker/CHANGELOG.md`

### Versioning Rules
- **Patch Bumps (0.0.1)**: For small changes, bug fixes, cosmetic updates, or streamlining existing screens (e.g., from `1.39.9` to `1.39.10`).
- **Minor Bumps (0.1.0)**: For larger changes, brand new components, features, or workflows (e.g., from `1.39.9` to `1.40.0`).
- **Major Bumps (1.0.0)**: For large breaking modifications or database restructures (e.g., from `1.39.9` to `2.0.0`).

---

## 2. Enforced Changelog Updating
You **MUST** write an entry at the top of `/freezer_inventory_tracker/CHANGELOG.md` before finalizing any turn or change.
- Detail the version, date, and categorizations (e.g., `### Added`, `### Changed`, `### Fixed`).
- List the precise list of modified files under a `### Files Modified` header in each release block.

---

## 3. Backward Compatibility & Live Home Assistant Safety
This application is used **live** inside Home Assistant as an add-on. Therefore:
- **No Destructive Database Changes**: Database structures, existing types, and key names (`AppInventoryState` schema) must always be backwards compatible.
- **Graceful Fallbacks**: Older data parsed from user states or local JSON backups that do not contain newly introduced properties/fields must fall back gracefully to sensible default values (e.g., using optional chaining, `|| []`, or `??` default assignments) to prevent crashes on startup.
- **Auto-Migrations**: If schema changes are strictly necessary, implement automatic on-the-fly migration paths in `/freezer_inventory_tracker/server.ts` during state loading (`normalizeState` or `loadStateSync`).

---

## 4. Comprehensive Backup & Restore Integrity
Whenever a new feature adds information, properties, or records to the application:
- Ensure the new data fields are integrated into the central JSON and ZIP backup mechanisms.
- Files to audit:
  - **Server-Side API**: Check `/freezer_inventory_tracker/server.ts` backup and restore endpoints (e.g. `/api/backups/create`, `/api/backups/restore/:filename`, `/api/backups/export-zip`, `/api/backups/import-zip`).
  - **Client-Side Views**: Update data managers like `/freezer_inventory_tracker/views/DataImportView.tsx` to handle selections for the new data scope during custom backups or restores.
  - **Mapping Guide**: Keep `/freezer_inventory_tracker/FREEZER_MAPPING_AI_GUIDE.md` updated with relevant data formats to assist users with CSV/AppSheet translations.

---

## 5. Relational Database Architecture & Minimizing Data Duplication
The application utilizes a relational SQLite database architecture. Always adhere to relational normalization principles:
- **Minimize Data Duplication**: Avoid duplicating entity data across multiple tables or models. Rather than storing redundant text/fields (such as product names, category details, or duplicated descriptions), store relational references (foreign keys/identifiers like `productId`, `containerId`, `orderId`) and resolve relations dynamically.
- **Single Source of Truth**: Keep canonical entity information within its designated primary table (`products`, `containers`, `orders`, etc.) and reference those IDs across transactions, inventory cuts, and movements.
- **Exceptions for Immutable Audit Logs**: Only store raw text snapshots when preserving historical import data or physical package labels as originally printed (e.g. `originalCutName` representing the immutable raw package text from external processors).

