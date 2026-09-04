# Freezer Inventory Tracker for Home Assistant

> 🤖 **Notice**: This entire application, codebase, documentation, and database architecture is **100% written and maintained by AI** using Google AI Studio.

---

## ❄️ Overview

**Freezer Inventory Tracker** is a full-featured inventory tracking and cold-storage logistics management system designed specifically for **Home Assistant** (and also usable as a standalone web app).

It provides complete lifecycle tracking for frozen meats, bulk packages, chest freezers, butcher processing cuts, commercial lockers, and off-site cold storage facilities.

---

## 🚀 Key Features

- **🏠 Home Assistant Native**: Seamlessly integrates with Home Assistant via Ingress with full Supervisor API support and persistent volume storage.
- **🥩 Butcher Processing & Cut Cataloging**: Track primary categories (Beef, Pork, Poultry, Lamb, Seafood, Wild Game), cut names, weights, piece counts, box numbers, lot numbers, pack dates, order numbers, and pallet/location tags.
- **📊 Interactive Spreadsheet Workspaces**: Spreadsheet-style editing with box grouping, expandable child rows, multi-column sorting, and bulk record operations.
- **🚚 Off-Site Storage & Logistics Planner**: Manage multi-facility inventory across on-site freezers, off-site commercial cold storage, walk-in coolers, and transport vehicles with transfer manifests.
- **📱 QR & Barcode Camera Scanner**: Rapid check-in, box scanning, physical tag verification, and live audits using your device's camera.
- **💾 Comprehensive Backup & Restore**: Robust SQLite database snapshots, CSV/AppSheet import & export, and full ZIP archive backups with image media packing and chunked uploads.
- **🛡️ Built-in Audit History**: Detailed activity and transaction audit trail recording every addition, edit, movement, checkout, and restoration event.

---

## 📦 Home Assistant Installation

### Option 1: Home Assistant Add-on Repository (Recommended)
1. In Home Assistant, navigate to **Settings** > **Add-ons** > **Add-on Store**.
2. Click the top-right menu (three dots) > **Repositories**.
3. Add this GitHub repository URL.
4. Locate **Freezer Inventory Tracker**, click **Install**, and start the add-on.
5. Enable **Show in sidebar** for quick access through Home Assistant Ingress.

### Option 2: Local Add-on Installation
1. Copy the `freezer_inventory_tracker` folder into your Home Assistant `/addons/` directory.
2. In the Add-on Store, click **Check for updates**.
3. Install **Freezer Inventory Tracker** from your local repository section.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, HTML5-QRCode, JSBarcode
- **Backend**: Node.js, Express, SQLite (`better-sqlite3`), Adm-Zip
- **Deployment**: Docker multi-arch (`amd64`, `aarch64`) with Home Assistant S6-overlay / Ingress

---

## 📄 License & Attribution

Developed with **Google AI Studio**. Free to use, adapt, and run on Home Assistant.
