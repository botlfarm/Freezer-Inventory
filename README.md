> **Notice:** This README was entirely written by Gemini.

# Freezer Inventory Tracker

A full-stack inventory management and cold-chain tracking application built with React, TypeScript, Tailwind CSS, Express, and SQLite. Designed for homesteads, farms, butcher operations, and commercial cold storage, it runs either as a standalone web app / Progressive Web App (PWA) or natively as a **Home Assistant Add-on** with Ingress support.

For detailed technical architecture, relational database schemas, synchronization mechanics, backup rules, and test coverage, see [`APP_CONTEXT.md`](./APP_CONTEXT.md).

---

## Overview

Freezer Inventory Tracker organizes physical food and meat inventory from butcher processing through off-site cold storage and into on-site freezers and display cases:

- **On-Site Freezers & Display Cases**: Track freezers, display cases, containers, and loose stock with fast `+`/`-` adjustments, tag-based restock and removal priorities, container templates, and physical reconciliation audits.
- **Local On-Site Voice Control**: Hands-free speech and dictation workspace for on-site stock updates, container creation, restock checks, and custom phrase/bundle shortcuts via the **Voice Dictionary**.
- **Off-Site Storage & Movement Logistics**: Manage multi-facility storage, pallets, and boxes using spreadsheet views, drag-and-drop staging worksheets, barcode-assisted pick/delivery scanning, and movement manifests.
- **Butcher Processing & Traceability**: Record butcher orders, carcass-to-package yields, CSV cutsheet imports with deduplication, and batch chain-of-custody traceability up to on-site transfer.
- **Custom Lists & Notifications**: Monitor minimum/maximum stock thresholds with automated daily digests, scheduled reports, and immediate alerts via SMTP email, webhooks, or in-app notifications.
- **Multi-User Sync, Security & Offline PWA**: Real-time Server-Sent Events (SSE) synchronization across operational zones, local PIN user accounts and device management, offline PWA caching with queued mutations, and an isolated Demo Sandbox mode.
- **Unified Audit Trail & Backups**: Cross-facility history log with tiered undo, automated rolling snapshots, and full or selective SQLite (`.db`), JSON, and media-inclusive `.zip` backup/restore tools, plus optional Nextcloud and Google Sheets connectors.

---

## Quick Start

### Local Development
```bash
npm install
npm run dev      # Starts Express + Vite dev server on port 3000
npm run lint     # TypeScript type-check (tsc --noEmit)
npm test         # Runs Vitest suite
npm run build    # Builds client and server bundle to dist/
npm start        # Runs production server
```

### Persistence & Home Assistant Add-on
- **Home Assistant**: Install via a local add-on folder or GitHub add-on repository. Persistent state (`inventory.db`, backups, and uploaded media) is stored in `/data`.
- **Standalone Node**: Data is stored locally under `./data/inventory.db`.

For the full system reference, refer to [`APP_CONTEXT.md`](./APP_CONTEXT.md).
