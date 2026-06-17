import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Select, Typography, message } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { allocationApi, storeApi, expiryListApi } from '../services/api';
import { useAppStore } from '../store/app';
import type { Allocation, Store, ExpiryList } from '../types';
import CreateAllocationModal from '../components/CreateAllocationModal';

const { Title } = Typography;

export default function AllocationPage() {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Allocation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [expiryLists, setExpiryLists] = useState<ExpiryList[]>([]);
  const [filters, setFilters] = useState({ status: '', listId: '' });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ExpiryList | null>(null);

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const initData = async () => {
    const [s, l] = await Promise.all([
      storeApi.getList(),
      expiryListApi.getList({ status: 'submitted' }),
    ]);
    setStores(s);
    setExpiryLists(l);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.listId) params.listId = filters.listId;
      const list = await allocationApi.getList(params);
      setData(list);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (expiryLists.length === 0) {
      message.warning('暂无可调拨的临期清单');
      return;
    }
    setCreateModalOpen(true);
  };

  const statusOptions = [
    { label: '待发货', value: 'pending' },
    { label: '运输中', value: 'shipped' },
    { label: '已收货', value: 'received' },
    { label: '已结算', value: 'settled' },
  ];

  const columns = [
    { title: '调拨单号', dataIndex: 'allocNo', width: 200 },
    {
      title: '来源门店',
      dataIndex: 'sourceStoreId',
      width: 140,
      render: (id: string) => stores.find(s => s.id === id)?.name || '-',
    },
    {
      title: '目标门店',
      dataIndex: 'targetStoreId',
      width: 140,
      render: (id: string) => stores.find(s => s.id === id)?.name || '-',
    },
    { title: '车辆', dataIndex: 'vehicleName', width: 120 },
    { title: '车牌号', dataIndex: 'plateNo', width: 120 },
    {
      title: '冷链',
      dataIndex: 'isColdChain',
      width: 80,
      render: (v: number) => (v === 1 ? <Tag color="blue">是</Tag> : '否'),
    },
    { title: '操作人', dataIndex: 'operatorName', width: 100 },
    { title: '计划日期', dataIndex: 'planDate', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const m: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '待发货' },
          shipped: { color: 'blue', text: '运输中' },
          received: { color: 'cyan', text: '已收货' },
          settled: { color: 'green', text: '已结算' },
        };
        const s = m[v] || { color: 'default', text: v };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: Allocation) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/allocations/${r.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const canCreate = currentUser?.role === 'warehouse';

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>调拨管理</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ width: 240 }}
          placeholder="选择临期清单"
          allowClear
          value={filters.listId || undefined}
          onChange={(v) => setFilters({ ...filters, listId: v || '' })}
          options={expiryLists.map(l => ({ label: l.listNo, value: l.id }))}
        />
        <Select
          style={{ width: 160 }}
          placeholder="状态"
          allowClear
          value={filters.status || undefined}
          onChange={(v) => setFilters({ ...filters, status: v || '' })}
          options={statusOptions}
        />
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建调拨
          </Button>
        )}
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      {createModalOpen && (
        <CreateAllocationModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            loadData();
            initData();
          }}
        />
      )}
    </div>
  );
}
