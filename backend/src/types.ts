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
}

export interface Store {
  id: string;
  code: string;
  name: string;
  type: 'store' | 'warehouse';
  region: string;
  address: string;
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

export interface ExpiryList {
  id: string;
  listNo: string;
  storeId: string;
  submitterId: string;
  submitterName: string;
  submitTime: string;
  status: 'draft' | 'submitted' | 'allocated' | 'settled';
  remark: string;
}

export type ExpiryGrade = 'critical' | 'warning' | 'normal';
export type DisposeMethod = 'promotion' | 'allocation' | 'pending';

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
  expiryGrade: ExpiryGrade;
  disposeMethod: DisposeMethod;
  category: string;
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
  receivedQty: number;
  lossQty: number;
  pendingQty: number;
  diffQty: number;
  diffRemark: string;
}

export type SettleSegmentType = 'sellable' | 'loss' | 'pending_review';

export interface SettleSegment {
  id: string;
  settlementId: string;
  allocationItemId: string;
  productId: string;
  productName: string;
  sku: string;
  batchNo: string;
  segmentType: SettleSegmentType;
  quantity: number;
  unitCost: number;
  amount: number;
  unitPrice: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewerId: string;
  reviewerName: string;
  reviewTime: string;
  reviewRemark: string;
}

export interface BatchTrace {
  id: string;
  batchNo: string;
  productId: string;
  productName: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  allocationId: string;
  allocNo: string;
  settlementId: string;
  settleNo: string;
  shippedQty: number;
  receivedQty: number;
  lossQty: number;
  pendingQty: number;
  unitCost: number;
  lossAmount: number;
  locked: number;
  traceTime: string;
  signDiff: number;
  signDiffAmount: number;
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
}

export type Role = 'store_manager' | 'warehouse' | 'finance';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  storeId: string;
  storeName: string;
}
