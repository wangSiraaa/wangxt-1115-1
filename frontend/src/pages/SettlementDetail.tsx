import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Tag, Space, Button, Typography, message, Divider, Card,
  Form, InputNumber, Input, Alert, Popconfirm, Statistic, Row, Col,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined, SaveOutlined, LockOutlined } from '@ant-design/icons';
import { settlementApi, storeApi } from '../services/api';
import type { Settlement, Store } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

export default function SettlementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    initData();
  }, [id]);

  useEffect(() => {
    if (detail) {
      form.setFieldsValue({
        totalCost: detail.totalCost,
        discountAmount: detail.discountAmount,
        lossAmount: detail.lossAmount,
        finalAmount: detail.finalAmount,
        remark: detail.remark,
      });
    }
  }, [detail, form]);

  const initData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        settlementApi.getDetail(id),
        storeApi.getList(),
      ]);
      setDetail(d);
      setStores(s);
    } finally {
      setLoading(false);
    }
  };

  const recalcFinal = (values: any) => {
    const total = values.totalCost || 0;
    const disc = values.discountAmount || 0;
    const loss = values.lossAmount || 0;
    return Math.max(0, total - disc - loss);
  };

  const handleSave = async () => {
    if (!id) return;
    const values = await form.validateFields();
    const finalAmount = recalcFinal(values);
    const lossRate = values.totalCost > 0 ? (values.lossAmount || 0) / values.totalCost : 0;
    setSaving(true);
    try {
      await settlementApi.update(id, {
        ...values,
        finalAmount,
        lossRate,
      });
      message.success('保存成功');
      initData();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setConfirming(true);
    try {
      await settlementApi.confirm(id);
      message.success('结算已确认，损耗金额已锁定');
      initData();
    } catch (err: any) {
      message.error(err.message || '确认失败');
    } finally {
      setConfirming(false);
    }
  };

  if (!detail) return null;

  const isConfirmed = detail.status === 'confirmed';
  const allocation = detail.allocation;
  const sourceStore = detail.sourceStore || stores.find(s => s.id === allocation?.sourceStoreId);
  const targetStore = detail.targetStore || stores.find(s => s.id === allocation?.targetStoreId);

  const itemColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'productName', width: 200 },
    { title: '批次号', dataIndex: 'batchNo', width: 160 },
    {
      title: '冷藏',
      dataIndex: 'isRefrigerated',
      width: 80,
      render: (v: number) => (v === 1 ? <Tag color="blue">冷藏</Tag> : '常温'),
    },
    { title: '数量', dataIndex: 'quantity', width: 100 },
    { title: '单位成本', dataIndex: 'unitCost', width: 100, render: (v: number) => `¥${v}` },
    {
      title: '金额小计',
      width: 120,
      render: (_: any, r: any) => `¥${(r.quantity * r.unitCost).toFixed(2)}`,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/settlements')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>结算单详情</Title>
        {isConfirmed && <Tag color="green" icon={<LockOutlined />}>已确认（不可修改）</Tag>}
      </Space>

      <Card loading={loading}>
        {isConfirmed && (
          <Alert
            type="info"
            showIcon
            message="结算已确认"
            description="结算完成后，损耗金额等财务数据已锁定，不可再修改。"
            style={{ marginBottom: 16 }}
          />
        )}

        <Descriptions column={2} bordered size="middle" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="结算单号">{detail.settleNo}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {isConfirmed ? <Tag color="green">已确认</Tag> : <Tag color="orange">草稿</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="关联调拨单">
            {allocation ? (
              <Button type="link" onClick={() => navigate(`/allocations/${allocation.id}`)}>
                {allocation.allocNo}
              </Button>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="会计">{detail.accountantName || '-'}</Descriptions.Item>
          <Descriptions.Item label="来源门店">{sourceStore?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="目标门店">{targetStore?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="结算时间" span={2}>{detail.settleTime || '-'}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">调拨商品明细</Divider>
        <Table
          rowKey="id"
          dataSource={detail.allocItems || []}
          columns={itemColumns}
          scroll={{ x: 900 }}
          pagination={false}
        />

        <Divider orientation="left">财务核算</Divider>
        <Form form={form} layout="vertical" disabled={isConfirmed}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="商品总成本" name="totalCost" rules={[{ required: true, message: '请输入' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="¥"
                  onChange={() => {
                    const vals = form.getFieldsValue();
                    form.setFieldsValue({ finalAmount: recalcFinal(vals) });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="折扣金额" name="discountAmount">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="¥"
                  onChange={() => {
                    const vals = form.getFieldsValue();
                    form.setFieldsValue({ finalAmount: recalcFinal(vals) });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="损耗金额" name="lossAmount">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="¥"
                  onChange={() => {
                    const vals = form.getFieldsValue();
                    form.setFieldsValue({ finalAmount: recalcFinal(vals) });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="最终结算金额" name="finalAmount">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="¥"
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="损耗率"
                  value={detail.lossRate * 100}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: detail.lossRate > 0.1 ? '#ff4d4f' : '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col span={18}>
              <Form.Item label="备注" name="remark">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider />
        <Space>
          {!isConfirmed && (
            <>
              <Button icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                保存
              </Button>
              <Popconfirm
                title="确认结算完成？"
                description="确认后损耗金额等财务数据将锁定，不可再修改。"
                onConfirm={handleConfirm}
                okButtonProps={{ loading: confirming }}
              >
                <Button type="primary" icon={<CheckOutlined />}>
                  确认结算
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
}
