# Clean Removal of Cloud Connectors & Reversion to Local Intake

Cleanly remove the experimental Nextcloud WebDAV and Google Sheets/Docs connectors, remove proxy server endpoints, remove connector UI dialogs/sub-tabs, and restore the proven, credential-free local file intake and attachment workflow across the entire application.

> [!IMPORTANT]
> **Confirmed Decision**: The user confirmed that storing shared cloud credentials across a multi-user, multi-device deployment poses significant security risks. All connector code, server proxies, and settings UI will be removed completely. Cutsheet imports and order attachments will rely strictly on standard client-side file selection and drag-and-drop without storing any external credentials.

---

### 1. Overview & Core Concept

- **What It Does**: Reverts the application to its clean state prior to the connectors addition. External cloud storage links and credentials are removed from `server.ts`, `LibraryView.tsx`, `ButcherRecordsView.tsx`, and `App.tsx`.
- **Target Audience / Persona**: Multi-user farm and freezer operators accessing the system simultaneously from home, phones, and warehouse tablets with zero risk of shared credential exposure.
- **Key Value**: 100% credential privacy and safety. No external cloud credentials are stored or shared across devices. Local file uploading (CSV drag-and-drop and attachment picking) remains fast, robust, and completely offline-capable.

---

### 2. User Experience & Visual Design

- **Settings View (`LibraryView.tsx`)**:
  - The Settings tab returns to its focused, clean layout with **General** and **PWA & Devices** sub-tabs (or unified settings), eliminating the "Connectors" sub-tab and references.
- **Butcher Records Intake (`ButcherRecordsView.tsx`)**:
  - The cutsheet intake dropzone returns to its clean single-purpose layout: **"Drop CSV Cutsheet Here"** or **"Browse File"**.
  - The redundant "Select from Nextcloud" and "Import from Google Sheet" buttons and contextual links are removed.
  - The order document attachments section reverts to local image and document uploads without cloud modal popups.
- **Top Header & Menus (`App.tsx`)**:
  - Clean `Catalog & Settings` routing without connector globals, modal shortcuts, or custom events.

---

### 3. Key Technical Decisions & Trade-Offs

- **Decision 1: Full Removal vs. Disabling**
  - *Chosen Approach*: Full removal of connector code, proxy endpoints, and modal components.
  - *Why*: Eliminates dead code, reduces bundle size, avoids lingering security vectors, and guarantees that no orphaned WebDAV or Google Sheet routines remain in the production codebase.
- **Decision 2: File Ingestion Strategy**
  - *Chosen Approach*: Standard HTML5 File API (`<input type="file" accept=".csv" />` and drag-and-drop file readers).
  - *Why*: Completely client-side, zero server storage of passwords, works natively across mobile Safari, Chrome, and desktop, and functions in 100% offline environments without internet access.

---

### 4. Technical Architecture & System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Devices / Browsers                │
│  (Phone / Tablet / Desktop - Multi-User Offline Sync)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                Standard HTML5 File Input / Drag & Drop
                (Local File -> In-Memory CSV Parsing)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Freezer Inventory Tracker Frontend            │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ ButcherRecordsView    │       │ LibraryView (Settings)│  │
│  │ - Drag & Drop CSV     │       │ - General Settings    │  │
│  │ - Local Attachments   │       │ - PWA & Devices       │  │
│  └───────────────────────┘       └───────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    REST API (Standard Crud)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server (server.ts / SQLite)               │
│  - Meat cuts, containers, freezers, movements               │
│  - No external WebDAV proxies / No cloud credential storage │
└─────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Implementation Sequence

1. **Delete Connector Component Files**:
   - Delete `/components/connectors/NextcloudFileModal.tsx`
   - Delete `/components/connectors/GoogleSheetImportModal.tsx`
   - Delete `/components/connectors/ConnectorsSettingsPanel.tsx`
   - Remove empty `/components/connectors/` directory.

2. **Clean Server Endpoints & Helpers (`server.ts`)**:
   - Remove `/api/connectors/nextcloud/test`, `/api/connectors/nextcloud/browse`, `/api/connectors/nextcloud/download`, and `/api/connectors/google-sheets/import`.
   - Remove `parseWebDavXml` and `parseGoogleSheetCsvUrl` helper functions.

3. **Revert Views**:
   - `views/LibraryView.tsx`: Remove `ConnectorsSettingsPanel` import, remove `"connectors"` from `LibraryTab` and sub-tab states, and remove `freezer-switch-settings-subtab` event logic.
   - `views/ButcherRecordsView.tsx`: Remove Nextcloud and Google Sheets import modals, buttons, and settings link; retain direct local CSV upload.
   - `App.tsx`: Clean up `LibraryTab` typing and remove `__navigateToConnectors`.
   - `types.ts`: Remove any remaining connector-specific interfaces if present.

4. **Update Automated Tests (`tests/`)**:
   - Remove or replace `tests/connectors-service.test.ts` with tests verifying clean local CSV parsing.
   - Verify `npm test` passes 100%.

5. **SemVer & Documentation**:
   - Bump version to `2.55.3` in `package.json`, `config.yaml`, and `version.ts`.
   - Update `CHANGELOG.md` with release notes and `### Files Modified`.
   - Verify zero errors with `npm run lint` and `compile_applet`.
