import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Select, Typography, Modal, message, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { expiryListApi, storeApi } from '../services/api';
import { useAppStore } from '../store/app';
import type { ExpiryList, Store } from '../types';
import CreateExpiryListModal from '../components/CreateExpiryListModal';

const { Title } = Typography;

export default function ExpiryListPage() {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExpiryList[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filters, setFilters] = useState({ storeId: '', status: '' });
  const [createModalOpen, setCreateModalOpen] = useState(false);

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
      const params: any = {};
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.status) params.status = filters.status;
      const list = await expiryListApi.getList(params);
      setData(list);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await expiryListApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await expiryListApi.submit(id);
      message.success('提交成功');
      loadData();
    } catch (err: any) {
      message.error(err.message || '提交失败');
    }
  };

  const statusOptions = [
    { label: '草稿', value: 'draft' },
    { label: '已提交', value: 'submitted' },
    { label: '已调拨', value: 'allocated' },
    { label: '已结算', value: 'settled' },
  ];

  const columns = [
    { title: '清单编号', dataIndex: 'listNo', width: 200 },
    {
      title: '门店',
      dataIndex: 'storeId',
      width: 140,
      render: (id: string) => stores.find(s => s.id === id)?.name || '-',
    },
    { title: '提交人', dataIndex: 'submitterName', width: 120 },
    { title: '提交时间', dataIndex: 'submitTime', width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          draft: { color: 'default', text: '草稿' },
          submitted: { color: 'blue', text: '已提交' },
          allocated: { color: 'cyan', text: '已调拨' },
          settled: { color: 'green', text: '已结算' },
        };
        const s = map[v] || { color: 'default', text: v };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '备注', dataIndex: 'remark' },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: any, r: ExpiryList) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/expiry-lists/${r.id}`)}>
            详情
          </Button>
          {r.status === 'draft' && (
            <>
              <Button size="small" type="primary" onClick={() => handleSubmit(r.id)}>
                提交
              </Button>
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const canCreate = currentUser?.role === 'store_manager';

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>临期清单</Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ width: 200 }}
          placeholder="选择门店"
          allowClear
          value={filters.storeId || undefined}
          onChange={(v) => setFilters({ ...filters, storeId: v || '' })}
          options={stores.map(s => ({ label: s.name, value: s.id }))}
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建清单
          </Button>
        )}
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      {createModalOpen && (
        <CreateExpiryListModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
