import { useState, useEffect } from 'react';
import { Modal, Form, Table, Button, Input, InputNumber, Space, Tag, Select, Typography, message, Checkbox } from 'antd';
import { inventoryApi, storeApi, expiryListApi } from '../services/api';
import { useAppStore } from '../store/app';
import type { InventoryBatch, Store } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateExpiryListModal({ open, onClose, onSuccess }: Props) {
  const { currentUser } = useAppStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedRows, setSelectedRows] = useState<InventoryBatch[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [storeId, setStoreId] = useState<string>(currentUser?.storeId || '');

  useEffect(() => {
    if (open) {
      initData();
      setSelectedRows([]);
      setQuantities({});
      form.resetFields();
    }
  }, [open]);

  useEffect(() => {
    if (open && storeId) {
      loadBatches();
    }
  }, [open, storeId]);

  const initData = async () => {
    const s = await storeApi.getList({ type: 'store' });
    setStores(s);
  };

  const loadBatches = async () => {
    setLoading(true);
    try {
      const list = await inventoryApi.getList({ storeId, isExpiringOnly: true });
      const filtered = list.filter((b: InventoryBatch) => dayjs(b.expiryDate).diff(dayjs(), 'day') >= 0);
      setBatches(filtered);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (id: string, val: number | null) => {
    if (val !== null && val !== undefined) {
      setQuantities({ ...quantities, [id]: val });
    }
  };

  const handleSubmit = async () => {
    if (!storeId) {
      message.error('请选择门店');
      return;
    }
    if (selectedRows.length === 0) {
      message.error('请选择商品');
      return;
    }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const items = selectedRows.map((r: InventoryBatch) => ({
        batchId: r.id,
        quantity: quantities[r.id] || r.quantity,
      }));
      await expiryListApi.create({
        storeId,
        submitterId: currentUser?.id,
        submitterName: currentUser?.name,
        remark: values.remark,
        items,
      });
      message.success('创建成功');
      onSuccess();
    } catch (err: any) {
      message.error(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getExpiryTag = (expiryDate: string) => {
    const days = dayjs(expiryDate).diff(dayjs(), 'day');
    if (days <= 7) return <Tag color="red">还剩{days}天</Tag>;
    if (days <= 15) return <Tag color="orange">还剩{days}天</Tag>;
    if (days <= 30) return <Tag color="gold">还剩{days}天</Tag>;
    return <Tag color="green">还剩{days}天</Tag>;
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', width: 100 },
    { title: '商品名称', dataIndex: 'productName', width: 180 },
    { title: '批次号', dataIndex: 'batchNo', width: 140 },
    {
      title: '冷藏',
      dataIndex: 'isRefrigerated',
      width: 70,
      render: (v: number) => (v === 1 ? <Tag color="blue">冷藏</Tag> : '常温'),
    },
    { title: '可用数量', dataIndex: 'quantity', width: 90 },
    {
      title: '调拨数量',
      width: 120,
      render: (_: any, r: InventoryBatch) => (
        <InputNumber
          min={1}
          max={r.quantity}
          value={quantities[r.id] ?? r.quantity}
          onChange={(v: number | null) => handleQuantityChange(r.id, v)}
          style={{ width: '100%' }}
          disabled={!selectedRows.find((s: InventoryBatch) => s.id === r.id)}
        />
      ),
    },
    { title: '到期日期', dataIndex: 'expiryDate', width: 110 },
    {
      title: '到期状态',
      dataIndex: 'expiryDate',
      width: 100,
      render: (v: string) => getExpiryTag(v),
    },
  ];

  return (
    <Modal
      open={open}
      title="新建临期清单"
      width={1000}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          创建
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Space wrap>
          <Text>门店：</Text>
          <Select
            style={{ width: 240 }}
            placeholder="选择门店"
            value={storeId || undefined}
            onChange={(val: string) => setStoreId(val)}
            options={stores.map((s: Store) => ({ label: s.name, value: s.id }))}
          />
        </Space>

        <div>
          <Title level={5} style={{ margin: '8px 0' }}>
            选择临期商品（已过滤过期商品）
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            已过期的商品不可调拨，已自动过滤
          </Text>
          <Table
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={batches}
            columns={columns as any}
            scroll={{ x: 900, y: 400 }}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedRows.map((r: InventoryBatch) => r.id),
              onChange: (_keys: React.Key[], rows: InventoryBatch[]) => {
                setSelectedRows(rows);
                const newQuantities = { ...quantities };
                rows.forEach((r: InventoryBatch) => {
                  if (newQuantities[r.id] === undefined) {
                    newQuantities[r.id] = r.quantity;
                  }
                });
                setQuantities(newQuantities);
              },
            }}
          />
        </div>

        <Form form={form}>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}
