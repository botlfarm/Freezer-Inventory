# Freezer Inventory Tracker

A high-performance, full-featured inventory tracking and logistics management system built with React, TypeScript, Tailwind CSS, and Express. Uniquely engineered for home freezers, butcher shop processing, commercial meat lockers, and off-site cold storage facilities. 

Operates seamlessly as a standalone web application or natively as a **Home Assistant Add-on** with Ingress integration, multi-architecture Docker support, and automatic volume persistence.

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
  - [1. Butcher Processing & Cut Cataloging](#1-butcher-processing--cut-cataloging)
  - [2. Interactive Spreadsheet Workspaces](#2-interactive-spreadsheet-workspaces)
  - [3. Off-Site Storage & Logistics Planner](#3-off-site-storage--logistics-planner)
  - [4. QR & Barcode Camera Scanner](#4-qr--barcode-camera-scanner)
  - [5. Data Portability, Backups & Preview Mode](#5-data-portability-backups--preview-mode)
  - [6. High-Contrast Sage Interface](#6-high-contrast-sage-interface)
- [Home Assistant Integration](#-home-assistant-integration)
  - [Option A: Local Add-on Installation (Recommended)](#option-a-local-add-on-installation-recommended)
  - [Option B: GitHub Add-on Repository](#option-b-github-add-on-repository)
- [Local Development](#-local-development)
- [Data Storage & Persistence Architecture](#-data-storage--persistence-architecture)

---

## 🌟 Overview

The **Freezer Inventory Tracker** eliminates spreadsheet confusion and lost frozen inventory. Designed to handle everything from individual homestead chest freezers to multi-location commercial butcher operations, it tracks detailed meat cuts, weights, box numbers, pallet locations, serial numbers, pack dates, and movement histories in real time.

### Key Architectural Highlights
* **Home Assistant Native**: Full Ingress support with dynamic proxy path stripping and Supervisor API awareness.
* **Persistent Storage**: Automatically routes database state (`freezer_data.json`) to `/data` volume mounts inside Home Assistant Alpine containers or local disk mounts in standalone Node environments.
* **Instant Interactive Sorting & Filtering**: Real-time multi-column sorting, live search filters, box aggregation, and bulk record operations.
* **Zero-Data-Loss Backups**: Complete JSON database snapshots and full ZIP export/import packages including uploaded image media.

---

## 🎯 Key Features

### 1. Butcher Processing & Cut Cataloging
* **Comprehensive Cut Fields**: Catalog items with Primary Category (Beef, Pork, Poultry, Lamb, Seafood, Wild Game), Cut Name, Net Weight (lbs), Piece Count (# pcs), Box ID, Lot Number, Pack Date, Order Number, Serial Number, and Pallet / Location tags.
* **Butcher Yield Analytics**: Track hanging carcass weights versus packaged yields, producer records, cut breakdown summaries, and processing dates.

### 2. Interactive Spreadsheet Workspaces
* **Dual Spreadsheet Views**: Dedicated interactive spreadsheets for both Butcher Processing records and Off-Site Inventory.
* **Box Grouping & Expansion**: Toggle between itemized flat views and grouped-by-box views with condensed summary rows and expandable child item lists.
* **Interactive Column Sorting**: Click any table header (Box, Cut Name, Net Weight, Pieces, Location, Pallet, Serial, Pack Date, Status) to instantly sort groups and items.
* **Bulk Editing**: Multi-select rows to batch-update locations, box assignments, order numbers, or lot numbers in a single operation.

### 3. Off-Site Storage & Logistics Planner
* **Multi-Facility Tracking**: Manage inventory across on-site freezers, off-site commercial cold storage, walk-in coolers, and transport vehicles.
* **Movement Manifests**: Create, plan, and track outbound shipping transfers between facilities with printable transfer manifests and audit trails.
* **Movement History**: Complete chronological log of every check-in, transfer, edit, and checkout event.

### 4. QR & Barcode Camera Scanner
* **Rapid Checking & Audits**: Built-in camera scanner for reading QR codes and barcodes on boxes, pallets, or individual cuts.
* **Instant Box Transfers**: Scan a box QR code to immediately check its contents, update its current storage location, or mark items as checked out.

### 5. Data Portability, Backups & Preview Mode
* **CSV Import/Export**: Import spreadsheets from CSV or AppSheet mapping guides and export inventory data at any time.
* **ZIP & JSON Backups**: One-click full database snapshots and media-inclusive ZIP backup archives.
* **Read-Only Live Preview Mode**: Inspect historical backup snapshots safely without overwriting or modifying your active database state.

### 6. High-Contrast Sage Interface
* **Optimized for Real-World Visibility**: Styled with high-contrast typography (`#0d1007`) and soft sage accents (`#c5cdb0`) for maximum legibility in freezer rooms, butcher shops, and high-glare environments under direct lighting.

---

## 🏡 Home Assistant Integration

This application is built from the ground up to run inside Home Assistant as an Add-on.

### Option A: Local Add-on Installation (Recommended)

1. Enable the **Samba share** or **SSH & Web Terminal** add-on in Home Assistant.
2. Navigate to your Home Assistant `addons` folder (e.g. `/addons/`).
3. Create a subdirectory named `freezer_inventory_tracker`.
4. Copy all project repository files into `/addons/freezer_inventory_tracker/`.
5. Open Home Assistant and go to **Settings** -> **Add-ons** -> **Add-on Store**.
6. Click the three dots in the top-right corner and select **Check for updates**.
7. Scroll down to **Local add-ons**, select **Freezer Inventory Tracker**, and click **Install**.
8. Start the add-on and click **Open Web UI** (or access via the sidebar link).

---

### Option B: GitHub Add-on Repository

To install directly from a GitHub repository:
1. Go to **Settings** -> **Add-ons** -> **Add-on Store** in Home Assistant.
2. Click the three dots in the top-right corner and select **Repositories**.
3. Add your repository URL: `https://github.com/YOUR_USERNAME/YOUR_REPO`.
4. Locate **Freezer Inventory Tracker** in the store and click **Install**.

---

## 🛠️ Local Development

To run and test the application locally outside of Docker / Home Assistant:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The dev server will launch on port `3000`.

3. **Type Checking & Linting**:
   ```bash
   npm run lint
   ```

4. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

---

## 💾 Data Storage & Persistence Architecture

- **Home Assistant Environment**: Data is persisted inside Home Assistant's `/data/freezer_data.json` directory, ensuring all records, settings, and logs survive add-on updates, container rebuilds, and system restarts.
- **Standalone Node Environment**: State is stored in the root folder as `freezer_data.json`.
- **Automatic Fallbacks**: Older data schemas automatically migrate on startup with safe default fallbacks to prevent runtime crashes.
