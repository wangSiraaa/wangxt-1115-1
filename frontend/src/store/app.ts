import { create } from 'zustand';
import type { User, Store } from '../types';

interface AppState {
  currentUser: User | null;
  stores: Store[];
  setCurrentUser: (user: User | null) => void;
  setStores: (stores: Store[]) => void;
}

const mockUsers: User[] = [
  { id: '1', username: 'manager01', name: '刘店长', role: 'store_manager', storeId: 'st1', storeName: '朝阳门店' },
  { id: '2', username: 'warehouse01', name: '王仓管', role: 'warehouse', storeId: 'wh1', storeName: '华北区域仓' },
  { id: '3', username: 'finance01', name: '李会计', role: 'finance', storeId: 'wh1', storeName: '华北区域仓' },
];

export const useAppStore = create<AppState>((set) => ({
  currentUser: mockUsers[0],
  stores: [],
  setCurrentUser: (user) => set({ currentUser: user }),
  setStores: (stores) => set({ stores }),
}));

export const mockUserList = mockUsers;
