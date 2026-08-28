# Mapping Instructions for AppSheet to Freezer Maps JSON Backup

This document is designed to be fed directly into an AI model (such as Claude, ChatGPT, or Gemini) along with your AppSheet dataset spreadsheet (or raw CSV files). It instructs the AI model on how to cleanly translate, align, and format your data into the native, fully-validated JSON schema required by the **JSON Backup / Restore** utility of the Freezer Maps system.

---

## Part 1: Native JSON Backup Schema Definition

The target restore file must be a single JSON object conforming to the structure below.

```typescript
interface ContainerType {
  id: string;          // e.g., "ct-box", "ct-bag", "unassigned"
  name: string;        // e.g., "Box", "Bag", "Unassigned Location"
  deleteOnEmpty: boolean;
  icon: string;        // Lucide icon name, e.g., "Package", "Folder", "Box"
}

interface Freezer {
  id: string;          // Unique ID, e.g., "f-upright", "f-chest"
  name: string;        // Display name of physical freezer, e.g., "Upright Freezer"
}

interface Container {
  id: string;          // Unique identification key (case-insensitive primary key)
  name: string;        // Readable box/bag label, e.g., "Top Shelf Beef Ribs"
  typeId: string;      // Matches an id from containerTypes, or defaults to "unassigned"
  freezerId?: string;  // Matches an id from freezers list
  imageUrl?: string;   // Optional image URL
}

interface Product {
  id: string;          // Unique product ID, matches meatCuts.productId
  name: string;        // Display name, e.g., "Beef Ribeye Steak"
  primaryCategory: string; // e.g., "Beef", "Pork", "Poultry", "Seafood"
  subCategory: string; // e.g., "Steaks", "Ground", "Roasts", "Ribs"
  imageUrl?: string;   // Optional image URL
  productNumbers?: string[]; // Optional backend processor SKU/item numbers, e.g., ["15425"]
  barcode?: string;    // Optional 12-digit 0-lb base UPC-A barcode, e.g., "215425000003"
  salePrice?: number;  // Optional unit sales price ($), e.g., 14.99
  salePriceUnit?: 'lb' | 'package'; // Sales price unit, defaults to 'lb' ("per lb" or "per package")
}

interface MeatCut {
  id: string;          // Unique UUID for the physical count entry
  productId: string;   // Must match an existing product.id (case-insensitive)
  quantity: number;    // Stock remaining (integer or decimal)
  containerId: string; // Must match an existing container.id (case-insensitive)
  notes?: string;      // Optional lot tags, dates, weight, or comments (differentiates split items)
  tagIds?: string[];   // Optional tag IDs attached to this specific item entry
}

interface HistoryEntry {
  id: string;          // UUID
  timestamp: string;   // ISO 8601 String (e.g., "2026-06-04T00:00:00.000Z")
  description: string; // Human-readable change log entry
  targetId: string;    // Related entity ID
  user: string;        // Name of user who performed import, e.g. "AI Sync Script"
}

interface Tag {
  id: string;          // e.g., "use-first", "not-for-sale", "personal-stock"
  name: string;        // e.g., "Use First", "Not For Sale", "Personal Stock"
  description?: string;
  color?: string;
  textColor?: string;
  excludeFromDisplayRestock?: boolean; // When true, items with this tag won't count towards Display Case restock backstock
}

// Complete Unified Root Application State
interface InventoryState {
  freezers: Freezer[];
  containers: Container[];
  products: Product[];
  meatCuts: MeatCut[];
  tags?: Tag[];
  history: HistoryEntry[];
  containerTypes: ContainerType[];
}
```

---

## Part 2: Step-by-Step AI Translation Guidelines

When an AI model reads an AppSheet workbook (consisting of spreadsheets/sheets like **Stock/Counts**, **Products**, and **Containers/Locations**), it should follow these mapping rules:

### Step 1: Initialize Standard Types
Every valid JSON backup should include standard layout definitions for `containerTypes`. Please output this exact array in the output root level:
```json
"containerTypes": [
  { "id": "unassigned", "name": "Standard Location", "deleteOnEmpty": false, "icon": "MapPin" },
  { "id": "ct-bag", "name": "Bag", "deleteOnEmpty": false, "icon": "Folder" },
  { "id": "ct-box", "name": "Box", "deleteOnEmpty": false, "icon": "Package" },
  { "id": "ct-bin", "name": "Bin", "deleteOnEmpty": false, "icon": "Box" }
]
```

---

### Step 2: Extract & Resolve Freezers (`freezers` Array)
1. Read the **Containers/Locations** worksheet.
2. Locate the colum that represents the physical freezer location (often named `Freezer`, `Freezer ID`, `Location`, `Room`, or `Fridge`).
3. Extract all unique non-empty freezer names.
4. Clean these names (e.g., `"Upright Freezer"`, `"Chest Freezer"`).
5. Generate a unique ID prefix for each, e.g., `"freezer-upright"`, `"freezer-chest"`.
6. Output the `freezers` array:
   ```json
   "freezers": [
     { "id": "freezer-upright", "name": "Upright Freezer" },
     { "id": "freezer-chest", "name": "Chest Freezer" }
   ]
   ```

---

### Step 3: Extract Products Catalog (`products` Array)
1. Read the **Products Catalog/Details** worksheet. If none exists, infer catalog entries from items mentioned in the stock worksheet.
2. Identify the primary identifier columns (usually columns matching `ItemID`, `Product ID`, `ID`, `Item Name`, `Name`, `Category`, `Sub-Category`, `Cut`).
3. For each unique row:
   - **ID**: Convert to string. Normalize it: trim whitespace and ensure it is consistent with references in the Stock table. (Keep original spelling but normalize case/whitespace).
   - **Name**: Use a clean, readable name (e.g. `"Beef Ribeye Steak"`).
   - **Primary Category**: e.g., `"Beef"`, `"Pork"`, `"Poultry"`, `"Lamb"`, or `"Seafood"`. If empty, guess based on properties or assign `"Uncategorized"`.
   - **Sub-Category**: e.g., `"Steaks"`, `"Ground"`, `"Sausage"`, `"Ribs"`.
   - **Product Numbers / Item Numbers**: Optional array of backend SKU item numbers (e.g. `["15425"]`).
   - **Barcode**: Optional 12-digit UPC-A weight-embedded barcode (e.g. `"215425000003"`).
4. Output the `products` list. Example:
   ```json
   {
     "id": "item-101",
     "name": "Ground Beef (80/20)",
     "primaryCategory": "Beef",
     "subCategory": "Ground",
     "productNumbers": ["15425"],
     "barcode": "215425000003"
   }
   ```

---

### Step 4: Extract Containers (`containers` Array)
1. Read the **Containers/Locations** worksheet.
2. Match columns like `BagBoxID`, `Container ID`, `Box ID`, `Name`, `Type`, `Freezer`.
3. For each distinct row:
   - **ID**: Trim whitespace. This is the primary foreign key referred to by Stock records! Keep exact spelling/number sequences (e.g., `"Box 12"` or `"B12"`).
   - **Name**: Ensure a clean consumer label (e.g., `"Beef Box 12"`).
   - **TypeId**: Use `"ct-box"`, `"ct-bag"`, `"ct-bin"`, or default to `"unassigned"`.
   - **FreezerId**: Match the ID of the physical freezer extracted in **Step 2** based on the freezer name text in this row.

---

### Step 5: Map Stock & Quantities (`meatCuts` Array)
This is the transaction/inventory table:
1. Read the **Stock/Counts/Inventory** worksheet.
2. Align columns:
   - **Product ID / Item ID** -> maps to `productId`
   - **Container ID / Location ID / BagBoxID** -> maps to `containerId`
   - **Count / Qty / Quantity** -> maps to `quantity` (convert string numbers to integers or decimals)
   - **Lot/Note / Description / Date** -> maps to `notes` (e.g., `"Lot 4, Pack Date 12/24"`)
3. For each row:
   - Generate a random short UUID or string for `id` (e.g., `"mc-72f8a1bc"` or similar).
   - Ensure `productId` and `containerId` match the exact string identifiers from **Step 3 & Step 4** (matching casing/spelling exactly to avoid orphaned references).
   - Ensure the quantity is a real positive number.
4. Output the entries. Example:
   ```json
   {
     "id": "mc-abc-123",
     "productId": "item-101",
     "quantity": 12,
     "containerId": "box-12",
     "notes": "Pack date Nov '25"
   }
   ```

---

### Step 6: Create History Entry & Wrap Full Payload
Add an introductory log in the `history` array to verify standard operation, then compile all arrays into the final root object structure.

---

## Part 3: Exemplary Fully Formatted JSON Backup File

Below is a complete, syntactically correct example representation showing how 2 freezers, 2 containers, 3 products, and counts link together seamlessly:

```json
{
  "freezers": [
    {
      "id": "f-chest",
      "name": "Main Chest Freezer"
    },
    {
      "id": "f-upright",
      "name": "Upright Garage Freezer"
    }
  ],
  "containers": [
    {
      "id": "BOX-01",
      "name": "Ribeyes & T-Bones Box 1",
      "typeId": "ct-box",
      "freezerId": "f-chest"
    },
    {
      "id": "BAG-A",
      "name": "Ground Pork Bulk Bag A",
      "typeId": "ct-bag",
      "freezerId": "f-upright"
    }
  ],
  "products": [
    {
      "id": "PROD-BEEF-RIBEYE",
      "name": "Ribeye Steak 1.5 inch",
      "primaryCategory": "Beef",
      "subCategory": "Steaks"
    },
    {
      "id": "PROD-BEEF-TBONE",
      "name": "T-Bone Steak",
      "primaryCategory": "Beef",
      "subCategory": "Steaks"
    },
    {
      "id": "PROD-PORK-GROUND",
      "name": "Ground Pork 1lb Tubes",
      "primaryCategory": "Pork",
      "subCategory": "Ground"
    }
  ],
  "meatCuts": [
    {
      "id": "cut-uuid-001",
      "productId": "PROD-BEEF-RIBEYE",
      "quantity": 6,
      "containerId": "BOX-01",
      "notes": "Lot 4A, Pack Date 05/20/2026"
    },
    {
      "id": "cut-uuid-002",
      "productId": "PROD-BEEF-TBONE",
      "quantity": 4,
      "containerId": "BOX-01",
      "notes": "Pack Date 05/18/2026"
    },
    {
      "id": "cut-uuid-003",
      "productId": "PROD-PORK-GROUND",
      "quantity": 20,
      "containerId": "BAG-A",
      "notes": "Home Grown Processing"
    }
  ],
  "history": [
    {
      "id": "hist-uuid-001",
      "timestamp": "2026-06-04T00:00:00.000Z",
      "description": "Restored complete inventory data synchronized from AppSheet relational dataset via AI Mapping Guide.",
      "targetId": "system-restore",
      "user": "AI Migration Specialist"
    }
  ],
  "containerTypes": [
    { "id": "unassigned", "name": "Standard Location", "deleteOnEmpty": false, "icon": "MapPin" },
    { "id": "ct-bag", "name": "Bag", "deleteOnEmpty": false, "icon": "Folder" },
    { "id": "ct-box", "name": "Box", "deleteOnEmpty": false, "icon": "Package" },
    { "id": "ct-bin", "name": "Bin", "deleteOnEmpty": false, "icon": "Box" }
  ]
}
```
Instructions: Save database to a `.json` file and upload it in the Database Settings tab under the "JSON Backup / Restore" option.

---

## Part 3: Butcher CSV & Pallet Mapping Guide

When importing Butcher records or CSV logs into off-site storage, entries support both source location mapping and target pallet placement:

- **Serial**: Unique cut serial number (e.g. `31229106`)
- **Original Cut Name**: Processing cut description (e.g. `14082 PORK TRIM`)
- **Location**: Storage facility or butcher location name (e.g. `Wholesale Meats LLC`, `Cold Storage Warehouse`)
- **Pallet**: Target pallet ID or placement designation (e.g. `Pallet P-101`, `Pallet A3`)
- **Pack Date**: Packaging timestamp string (e.g. `03/12/26`)
- **Lot**: Processing lot identifier (e.g. `1192007126`)
- **Box**: Box ID or container grouping (e.g. `11920-06`)
- **Pieces & Net Weight**: Numeric counts and weight in lbs (e.g. `11.2` lbs)

