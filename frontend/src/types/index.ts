export interface Store {
  id: string;
  code: string;
  name: string;
  type: 'store' | 'warehouse';
  region: string;
  address: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  isRefrigerated: number;
  unit: string;
  basePrice: number;
}

export interface InventoryBatch {
  id: string;
  productId: string;
  storeId: string;
  batchNo: string;
  quantity: number;
  productionDate: string;
  expiryDate: string;
  inboundDate: string;
  status: 'normal' | 'expiring' | 'expired' | 'allocated';
  unitCost: number;
  productName?: string;
  sku?: string;
  category?: string;
  isRefrigerated?: number;
  unit?: string;
  basePrice?: number;
}

export interface Vehicle {
  id: string;
  plateNo: string;
  name: string;
  isColdChain: number;
  capacity: number;
  driverName: string;
  driverPhone: string;
  status: 'available' | 'in_use' | 'maintenance';
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'store_manager' | 'warehouse' | 'finance';
  storeId: string;
  storeName: string;
}

export interface ExpiryListItem {
  id: string;
  listId: string;
  batchId: string;
  productId: string;
  productName: string;
  sku: string;
  batchNo: string;
  quantity: number;
  productionDate: string;
  expiryDate: string;
  expiryDays: number;
  isRefrigerated: number;
  unitCost: number;
  basePrice: number;
}

export interface ExpiryList {
  id: string;
  listNo: string;
  storeId: string;
  submitterId: string;
  submitterName: string;
  submitTime: string;
  status: 'draft' | 'submitted' | 'allocated' | 'settled';
  remark: string;
  items?: ExpiryListItem[];
}

export interface AllocationItem {
  id: string;
  allocationId: string;
  listItemId: string;
  productId: string;
  productName: string;
  sku: string;
  batchNo: string;
  quantity: number;
  isRefrigerated: number;
  unitCost: number;
  basePrice: number;
}

export interface Allocation {
  id: string;
  allocNo: string;
  listId: string;
  sourceStoreId: string;
  targetStoreId: string;
  vehicleId: string;
  vehicleName: string;
  plateNo: string;
  isColdChain: number;
  operatorId: string;
  operatorName: string;
  planDate: string;
  status: 'pending' | 'shipped' | 'received' | 'settled';
  remark: string;
  items?: AllocationItem[];
  sourceStore?: Store;
  targetStore?: Store;
}

export interface Settlement {
  id: string;
  settleNo: string;
  allocationId: string;
  totalCost: number;
  discountAmount: number;
  lossAmount: number;
  finalAmount: number;
  lossRate: number;
  accountantId: string;
  accountantName: string;
  settleTime: string;
  status: 'draft' | 'confirmed';
  remark: string;
  allocation?: Allocation;
  allocItems?: AllocationItem[];
  sourceStore?: Store;
  targetStore?: Store;
}

export type RoleType = 'store_manager' | 'warehouse' | 'finance';
