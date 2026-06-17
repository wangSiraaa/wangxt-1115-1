import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Select, Typography, message } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { settlementApi, allocationApi } from '../services/api';
import { useAppStore } from '../store/app';
import type { Settlement, Allocation } from '../types';

const { Title } = Typography;

export default function SettlementPage() {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Settlement[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [filters, setFilters] = useState({ status: '' });

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const initData = async () => {
    const allocs = await allocationApi.getList({ status: 'received' });
    setAllocations(allocs);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      const list = await settlementApi.getList(params);
      setData(list);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (allocationId: string) => {
    try {
      const alloc = allocations.find(a => a.id === allocationId);
      if (!alloc) return;
      const res = await settlementApi.create({
        allocationId,
        accountantId: currentUser?.id,
        accountantName: currentUser?.name,
      });
      message.success('结算单已创建');
      navigate(`/settlements/${res.id}`);
    } catch (err: any) {
      message.error(err.message || '创建失败');
    }
  };

  const statusOptions = [
    { label: '草稿', value: 'draft' },
    { label: '已确认', value: 'confirmed' },
  ];

  const columns = [
    { title: '结算单号', dataIndex: 'settleNo', width: 200 },
    {
      title: '关联调拨单',
      dataIndex: 'allocationId',
      width: 200,
      render: (id: string, r: any) => (
        <Button type="link" onClick={() => navigate(`/allocations/${id}`)}>
          查看调拨单
        </Button>
      ),
    },
    { title: '总成本', dataIndex: 'totalCost', width: 120, render: (v: number) => `¥${v?.toFixed(2) || '-'}` },
    { title: '折扣金额', dataIndex: 'discountAmount', width: 120, render: (v: number) => `¥${v?.toFixed(2) || '-'}` },
    { title: '损耗金额', dataIndex: 'lossAmount', width: 120, render: (v: number) => `¥${v?.toFixed(2) || '-'}` },
    { title: '最终金额', dataIndex: 'finalAmount', width: 120, render: (v: number) => `¥${v?.toFixed(2) || '-'}` },
    { title: '会计', dataIndex: 'accountantName', width: 100 },
    { title: '结算时间', dataIndex: 'settleTime', width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const m: Record<string, { color: string; text: string }> = {
          draft: { color: 'orange', text: '草稿' },
          confirmed: { color: 'green', text: '已确认' },
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
      render: (_: any, r: Settlement) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/settlements/${r.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const canCreate = currentUser?.role === 'finance';
  const pendingAllocs = allocations.filter(a => !data.some(s => s.allocationId === a.id));

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>财务结算</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ width: 160 }}
          placeholder="状态"
          allowClear
          value={filters.status || undefined}
          onChange={(v) => setFilters({ ...filters, status: v || '' })}
          options={statusOptions}
        />
        {canCreate && pendingAllocs.length > 0 && (
          <Select
            style={{ width: 260 }}
            placeholder="选择待结算调拨单创建结算单"
            onChange={(v) => handleCreate(v)}
            options={pendingAllocs.map(a => ({ label: a.allocNo, value: a.id }))}
          />
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
    </div>
  );
}
