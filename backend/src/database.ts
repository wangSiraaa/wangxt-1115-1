import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'database.sqlite');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database | null = null;
let SQL: any = null;

export async function getDb(): Promise<Database> {
  if (db !== null) return db as Database;
  if (!SQL) {
    SQL = await initSqlJs();
  }
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  return db as Database;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export async function initDatabase() {
  const d = await getDb();
  d.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      region TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      isRefrigerated INTEGER DEFAULT 0,
      unit TEXT,
      basePrice REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      storeId TEXT NOT NULL,
      batchNo TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      productionDate TEXT NOT NULL,
      expiryDate TEXT NOT NULL,
      inboundDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'normal',
      unitCost REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plateNo TEXT NOT NULL UNIQUE,
      name TEXT,
      isColdChain INTEGER DEFAULT 0,
      capacity INTEGER DEFAULT 0,
      driverName TEXT,
      driverPhone TEXT,
      status TEXT DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      storeId TEXT,
      storeName TEXT
    );

    CREATE TABLE IF NOT EXISTS expiry_lists (
      id TEXT PRIMARY KEY,
      listNo TEXT NOT NULL UNIQUE,
      storeId TEXT NOT NULL,
      submitterId TEXT,
      submitterName TEXT,
      submitTime TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS expiry_list_items (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      batchId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT,
      sku TEXT,
      category TEXT,
      batchNo TEXT,
      quantity INTEGER NOT NULL,
      productionDate TEXT,
      expiryDate TEXT,
      expiryDays INTEGER,
      isRefrigerated INTEGER DEFAULT 0,
      unitCost REAL DEFAULT 0,
      basePrice REAL DEFAULT 0,
      expiryGrade TEXT DEFAULT 'normal',
      disposeMethod TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS allocations (
      id TEXT PRIMARY KEY,
      allocNo TEXT NOT NULL UNIQUE,
      listId TEXT NOT NULL,
      sourceStoreId TEXT NOT NULL,
      targetStoreId TEXT NOT NULL,
      vehicleId TEXT,
      vehicleName TEXT,
      plateNo TEXT,
      isColdChain INTEGER DEFAULT 0,
      operatorId TEXT,
      operatorName TEXT,
      planDate TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS allocation_items (
      id TEXT PRIMARY KEY,
      allocationId TEXT NOT NULL,
      listItemId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT,
      sku TEXT,
      batchNo TEXT,
      quantity INTEGER NOT NULL,
      isRefrigerated INTEGER DEFAULT 0,
      unitCost REAL DEFAULT 0,
      basePrice REAL DEFAULT 0,
      receivedQty INTEGER DEFAULT 0,
      lossQty INTEGER DEFAULT 0,
      pendingQty INTEGER DEFAULT 0,
      diffQty INTEGER DEFAULT 0,
      diffRemark TEXT
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      settleNo TEXT NOT NULL UNIQUE,
      allocationId TEXT NOT NULL UNIQUE,
      totalCost REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      lossAmount REAL DEFAULT 0,
      finalAmount REAL DEFAULT 0,
      lossRate REAL DEFAULT 0,
      sellableAmount REAL DEFAULT 0,
      pendingAmount REAL DEFAULT 0,
      lossLocked INTEGER DEFAULT 0,
      accountantId TEXT,
      accountantName TEXT,
      settleTime TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS settle_segments (
      id TEXT PRIMARY KEY,
      settlementId TEXT NOT NULL,
      allocationItemId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT,
      sku TEXT,
      batchNo TEXT,
      segmentType TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitCost REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      unitPrice REAL DEFAULT 0,
      reviewStatus TEXT DEFAULT 'pending',
      reviewerId TEXT,
      reviewerName TEXT,
      reviewTime TEXT,
      reviewRemark TEXT
    );

    CREATE TABLE IF NOT EXISTS batch_traces (
      id TEXT PRIMARY KEY,
      batchNo TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT,
      fromStoreId TEXT NOT NULL,
      fromStoreName TEXT,
      toStoreId TEXT NOT NULL,
      toStoreName TEXT,
      allocationId TEXT NOT NULL,
      allocNo TEXT,
      settlementId TEXT,
      settleNo TEXT,
      shippedQty INTEGER DEFAULT 0,
      receivedQty INTEGER DEFAULT 0,
      lossQty INTEGER DEFAULT 0,
      pendingQty INTEGER DEFAULT 0,
      unitCost REAL DEFAULT 0,
      lossAmount REAL DEFAULT 0,
      locked INTEGER DEFAULT 0,
      traceTime TEXT,
      signDiff INTEGER DEFAULT 0,
      signDiffAmount REAL DEFAULT 0
    );
  `);
  saveDb();
}
