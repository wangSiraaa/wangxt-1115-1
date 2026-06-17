import { useState, useEffect } from 'react';
import { Table, Tag, Space, Select, Typography, Input } from 'antd';
import { inventoryApi, storeApi } from '../services/api';
import type { InventoryBatch, Store } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;

export default function Inventory() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InventoryBatch[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filters, setFilters] = useState({ storeId: '', keyword: '' });

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const initData = async () => {
    const s = await storeApi.getList();
    setStores(s);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let list = await inventoryApi.getList();
      if (filters.storeId) {
        list = list.filter(i => i.storeId === filters.storeId);
      }
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        list = list.filter(i =>
          (i.productName || '').toLowerCase().includes(kw) ||
          (i.sku || '').toLowerCase().includes(kw) ||
          (i.batchNo || '').toLowerCase().includes(kw)
        );
      }
      setData(list);
    } finally {
      setLoading(false);
    }
  };

  const getExpiryTag = (expiryDate: string, status: string) => {
    if (status === 'expired' || dayjs(expiryDate).diff(dayjs(), 'day') < 0) {
      return <Tag color="red">已过期</Tag>;
    }
    const days = dayjs(expiryDate).diff(dayjs(), 'day');
    if (days <= 7) return <Tag color="red">还剩{days}天</Tag>;
    if (days <= 15) return <Tag color="orange">还剩{days}天</Tag>;
    if (days <= 30) return <Tag color="gold">还剩{days}天</Tag>;
    return <Tag color="green">还剩{days}天</Tag>;
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'productName', width: 200 },
    { title: '批次号', dataIndex: 'batchNo', width: 160 },
    {
      title: '门店',
      dataIndex: 'storeId',
      width: 140,
      render: (id: string) => stores.find(s => s.id === id)?.name || '-',
    },
    { title: '库存数量', dataIndex: 'quantity', width: 100 },
    {
      title: '是否冷藏',
      dataIndex: 'isRefrigerated',
      width: 100,
      render: (v: number) => (v === 1 ? <Tag color="blue">冷藏</Tag> : '常温'),
    },
    { title: '生产日期', dataIndex: 'productionDate', width: 120 },
    { title: '到期日期', dataIndex: 'expiryDate', width: 120 },
    {
      title: '到期状态',
      dataIndex: 'expiryDate',
      width: 120,
      render: (v: string, r: any) => getExpiryTag(v, r.status),
    },
    {
      title: '批次状态',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          normal: { color: 'green', text: '正常' },
          expiring: { color: 'orange', text: '临期' },
          expired: { color: 'red', text: '过期' },
          allocated: { color: 'blue', text: '已调拨' },
        };
        const s = map[v] || { color: 'default', text: v };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '单位成本', dataIndex: 'unitCost', width: 100, render: (v: number) => `¥${v}` },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>库存批次</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ width: 200 }}
          placeholder="选择门店"
          allowClear
          value={filters.storeId || undefined}
          onChange={(v) => setFilters({ ...filters, storeId: v || '' })}
          options={stores.map(s => ({ label: s.name, value: s.id }))}
        />
        <Search
          placeholder="搜索商品/SKU/批次号"
          style={{ width: 260 }}
          allowClear
          onSearch={(v) => setFilters({ ...filters, keyword: v })}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </div>
  );
}
