import request from '../utils/request';
import type { Store, Product, Vehicle, User, InventoryBatch, ExpiryList, Allocation, Settlement } from '../types';

export const storeApi = {
  getList: (params?: { type?: string }) => request.get<any, Store[]>('/api/base/stores', { params }),
};

export const userApi = {
  getList: () => request.get<any, User[]>('/api/base/users'),
};

export const productApi = {
  getList: () => request.get<any, Product[]>('/api/base/products'),
};

export const vehicleApi = {
  getList: (params?: { isColdChain?: number; status?: string }) =>
    request.get<any, Vehicle[]>('/api/base/vehicles', { params }),
};

export const inventoryApi = {
  getList: (params?: { storeId?: string; status?: string; isExpiringOnly?: boolean }) =>
    request.get<any, InventoryBatch[]>('/api/base/inventory', { params }),
  getDetail: (id: string) => request.get<any, InventoryBatch>(`/api/base/inventory/${id}`),
};

export const expiryListApi = {
  getList: (params?: { storeId?: string; status?: string }) =>
    request.get<any, ExpiryList[]>('/api/expiry-lists', { params }),
  getDetail: (id: string) => request.get<any, ExpiryList>(`/api/expiry-lists/${id}`),
  create: (data: any) => request.post<any, ExpiryList>('/api/expiry-lists', data),
  update: (id: string, data: any) => request.put<any, ExpiryList>(`/api/expiry-lists/${id}`, data),
  submit: (id: string) => request.post<any, ExpiryList>(`/api/expiry-lists/${id}/submit`),
  delete: (id: string) => request.delete<any, void>(`/api/expiry-lists/${id}`),
};

export const allocationApi = {
  getList: (params?: { listId?: string; status?: string; sourceStoreId?: string; targetStoreId?: string }) =>
    request.get<any, Allocation[]>('/api/allocations', { params }),
  getDetail: (id: string) => request.get<any, Allocation>(`/api/allocations/${id}`),
  create: (data: any) => request.post<any, Allocation>('/api/allocations', data),
  updateStatus: (id: string, status: string) =>
    request.put<any, Allocation>(`/api/allocations/${id}/status`, { status }),
};

export const settlementApi = {
  getList: (params?: { allocationId?: string; status?: string }) =>
    request.get<any, Settlement[]>('/api/settlements', { params }),
  getDetail: (id: string) => request.get<any, Settlement>(`/api/settlements/${id}`),
  create: (data: any) => request.post<any, Settlement>('/api/settlements', data),
  update: (id: string, data: any) => request.put<any, Settlement>(`/api/settlements/${id}`, data),
  confirm: (id: string) => request.post<any, Settlement>(`/api/settlements/${id}/confirm`),
};
