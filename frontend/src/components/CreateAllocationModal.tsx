import { useState, useEffect } from 'react';
import { Modal, Form, Table, Button, Input, Space, Tag, Select, Typography, message, DatePicker, Alert } from 'antd';
import { vehicleApi, storeApi, expiryListApi } from '../services/api';
import { allocationApi } from '../services/api';
import { useAppStore } from '../store/app';
import type { Vehicle, Store, ExpiryList, ExpiryListItem } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateAllocationModal({ open, onClose, onSuccess }: Props) {
  const { currentUser } = useAppStore();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [expiryLists, setExpiryLists] = useState<ExpiryList[]>([]);
  const [selectedList, setSelectedList] = useState<ExpiryList | null>(null);
  const [selectedItems, setSelectedItems] = useState<ExpiryListItem[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (open) {
      initData();
      form.resetFields();
      setSelectedList(null);
      setSelectedItems([]);
      setSelectedVehicle('');
    }
  }, [open]);

  const initData = async () => {
    const [v, s, l] = await Promise.all([
      vehicleApi.getList({ status: 'available' }),
      storeApi.getList(),
      expiryListApi.getList({ status: 'submitted' }),
    ]);
    setVehicles(v);
    setStores(s);
    setExpiryLists(l);
  };

  const loadListDetail = async (listId: string) => {
    setListLoading(true);
    try {
      const detail = await expiryListApi.getDetail(listId);
      setSelectedList(detail);
      setSelectedItems(detail.items || []);
    } finally {
      setListLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedList) {
      message.error('请选择临期清单');
      return;
    }
    if (selectedItems.length === 0) {
      message.error('请选择商品');
      return;
    }
    const values = await form.validateFields();
    const hasRefrigerated = selectedItems.some(i => i.isRefrigerated === 1);
    const vehicle = vehicles.find(v => v.id === values.vehicleId);
    if (hasRefrigerated && vehicle?.isColdChain !== 1) {
      message.error('清单包含冷藏商品，必须选择冷链车辆');
      return;
    }
    setSubmitting(true);
    try {
      await allocationApi.create({
        listId: selectedList.id,
        sourceStoreId: selectedList.storeId,
        targetStoreId: values.targetStoreId,
        vehicleId: values.vehicleId,
        operatorId: currentUser?.id,
        operatorName: currentUser?.name,
        planDate: values.planDate?.format('YYYY-MM-DD'),
        remark: values.remark,
        itemIds: selectedItems.map(i => i.id),
      });
      message.success('创建调拨成功');
      onSuccess();
    } catch (err: any) {
      message.error(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const hasRefrigerated = selectedItems.some(i => i.isRefrigerated === 1);

  const itemColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 100 },
    { title: '商品名称', dataIndex: 'productName', width: 160 },
    { title: '批次号', dataIndex: 'batchNo', width: 140 },
    {
      title: '冷藏',
      dataIndex: 'isRefrigerated',
      width: 70,
      render: (v: number) => (v === 1 ? <Tag color="blue">冷藏</Tag> : '常温'),
    },
    { title: '数量', dataIndex: 'quantity', width: 80 },
    { title: '到期日期', dataIndex: 'expiryDate', width: 100 },
    {
      title: '到期天数',
      dataIndex: 'expiryDays',
      width: 90,
      render: (v: number) => <Tag color={v <= 7 ? 'red' : v <= 15 ? 'orange' : 'gold'}>{v}天</Tag>,
    },
  ];

  const availableVehicles = hasRefrigerated
    ? vehicles.filter(v => v.isColdChain === 1)
    : vehicles;

  return (
    <Modal
      open={open}
      title="新建调拨单"
      width={1100}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          创建调拨
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Space wrap align="start">
          <Space align="center">
            <Text>临期清单：</Text>
            <Select
              style={{ width: 280 }}
              placeholder="选择临期清单"
              value={selectedList?.id || undefined}
              loading={listLoading}
              onChange={(v) => loadListDetail(v)}
              options={expiryLists.map(l => ({ label: l.listNo, value: l.id }))}
            />
          </Space>
          {selectedList && (
            <Text type="secondary">
              门店：{stores.find(s => s.id === selectedList.storeId)?.name || '-'}
            </Text>
          )}
        </Space>

        {selectedList && (
          <>
            <div>
              <Title level={5} style={{ margin: '8px 0' }}>选择调拨商品</Title>
              <Table
                rowKey="id"
                size="small"
                dataSource={selectedList.items || []}
                columns={itemColumns}
                scroll={{ x: 800, y: 280 }}
                pagination={false}
                rowSelection={{
                  selectedRowKeys: selectedItems.map(i => i.id),
                  onChange: (_keys, rows) => setSelectedItems(rows as ExpiryListItem[]),
                }}
              />
            </div>

            {hasRefrigerated && (
              <Alert
                type="warning"
                showIcon
                message="选中商品包含冷藏商品，必须选择冷链车辆"
              />
            )}

            <Form form={form} layout="inline">
              <Form.Item
                label="目标门店"
                name="targetStoreId"
                rules={[{ required: true, message: '请选择目标门店' }]}
              >
                <Select
                  style={{ width: 200 }}
                  placeholder="选择目标门店"
                  options={stores.filter(s => s.id !== selectedList.storeId).map(s => ({ label: s.name, value: s.id }))}
                />
              </Form.Item>
              <Form.Item
                label="运输车辆"
                name="vehicleId"
                rules={[{ required: true, message: '请选择车辆' }]}
              >
                <Select
                  style={{ width: 260 }}
                  placeholder={hasRefrigerated ? '仅显示冷链车辆' : '选择车辆'}
                  value={selectedVehicle || undefined}
                  onChange={setSelectedVehicle}
                  options={availableVehicles.map(v => ({
                    label: `${v.name} - ${v.plateNo}${v.isColdChain === 1 ? '（冷链）' : ''}`,
                    value: v.id,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label="计划日期"
                name="planDate"
                rules={[{ required: true, message: '请选择计划日期' }]}
              >
                <DatePicker style={{ width: 180 }} />
              </Form.Item>
            </Form>

            <Form form={form}>
              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Form>
          </>
        )}
      </Space>
    </Modal>
  );
}
