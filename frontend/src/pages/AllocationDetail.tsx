import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Tag, Space, Button, Typography, message, Divider, Card, Steps,
  Popconfirm, Modal, Form, InputNumber, Input, Alert, Row, Col, Statistic,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, SendOutlined, InboxOutlined,
  ExclamationCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { allocationApi, storeApi, settlementApi, ReceiveItemInput } from '../services/api';
import type { Allocation, Store, Settlement, AllocationItem, BatchTrace } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

export default function AllocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Allocation | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [traces, setTraces] = useState<BatchTrace[]>([]);

  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveForm] = Form.useForm();
  const [receiveItems, setReceiveItems] = useState<ReceiveItemInput[]>([]);
  const [submittingReceive, setSubmittingReceive] = useState(false);

  useEffect(() => {
    initData();
  }, [id]);

  const initData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, s, t] = await Promise.all([
        allocationApi.getDetail(id),
        storeApi.getList(),
        allocationApi.getTrace(id).catch(() => [] as BatchTrace[]),
      ]);
      setDetail(d);
      setStores(s);
      setTraces(t || []);
      try {
        const settles = await settlementApi.getList({ allocationId: id });
        if (settles.length > 0) {
          setSettlement(settles[0]);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string, msg: string) => {
    if (!id) return;
    try {
      await allocationApi.updateStatus(id, status);
      message.success(msg);
      initData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const openReceiveModal = () => {
    if (!detail) return;
    const items: ReceiveItemInput[] = (detail.items || []).map((it: AllocationItem) => ({
      id: it.id,
      receivedQty: it.quantity,
      lossQty: 0,
      pendingQty: 0,
      diffRemark: '',
    }));
    setReceiveItems(items);
    receiveForm.resetFields();
    setReceiveModalOpen(true);
  };

  const handleReceiveQtyChange = (idx: number, field: keyof ReceiveItemInput, val: any) => {
    const newItems = [...receiveItems];
    (newItems[idx] as any)[field] = val ?? 0;
    const it = detail?.items?.[idx];
    if (it) {
      const sum = (newItems[idx].receivedQty || 0) + (newItems[idx].lossQty || 0) + (newItems[idx].pendingQty || 0);
      if (sum > it.quantity) {
        message.warning(`${it.productName} 实收+报损+待复核超过发货量(${it.quantity})`);
      }
    }
    setReceiveItems(newItems);
  };

  const handleSubmitReceive = async () => {
    if (!id || !detail) return;
    const hasOver = receiveItems.some((ri, idx) => {
      const it = detail.items?.[idx];
      return it && (ri.receivedQty + ri.lossQty + ri.pendingQty > it.quantity);
    });
    if (hasOver) {
      message.error('存在商品实收+报损+待复核超过发货量，请检查');
      return;
    }
    const hasNeg = receiveItems.some(ri => ri.receivedQty < 0 || ri.lossQty < 0 || ri.pendingQty < 0);
    if (hasNeg) {
      message.error('数量不能为负数');
      return;
    }
    setSubmittingReceive(true);
    try {
      await allocationApi.updateStatus(id, 'received', receiveItems);
      message.success('签收成功');
      setReceiveModalOpen(false);
      initData();
    } catch (err: any) {
      message.error(err.message || '签收失败');
    } finally {
      setSubmittingReceive(false);
    }
  };

  if (!detail) return null;

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待发货' },
    shipped: { color: 'blue', text: '运输中' },
    received: { color: 'cyan', text: '已收货' },
    settled: { color: 'green', text: '已结算' },
  };

  const currentStep = {
    pending: 0,
    shipped: 1,
    received: 2,
    settled: 3,
  }[detail.status] || 0;

  const hasRefrigerated = (detail.items || []).some(i => i.isRefrigerated === 1);
  const sourceStore = detail.sourceStore || stores.find(s => s.id === detail.sourceStoreId);
  const targetStore = detail.targetStore || stores.find(s => s.id === detail.targetStoreId);

  const shippedTotal = (detail.items || []).reduce((s, i) => s + i.quantity, 0);
  const receivedTotal = (detail.items || []).reduce((s, i) => s + (i.receivedQty || 0), 0);
  const lossTotal = (detail.items || []).reduce((s, i) => s + (i.lossQty || 0), 0);
  const pendingTotal = (detail.items || []).reduce((s, i) => s + (i.pendingQty || 0), 0);
  const diffTotal = shippedTotal - receivedTotal - lossTotal - pendingTotal;
  const totalCost = (detail.items || []).reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const lossAmount = lossTotal * (totalCost / Math.max(1, shippedTotal));

  const itemColumns = [
    { title: 'SKU', dataIndex: 'sku', width: 100 },
    { title: '商品名称', dataIndex: 'productName', width: 180 },
    { title: '批次号', dataIndex: 'batchNo', width: 140 },
    {
      title: '冷藏',
      dataIndex: 'isRefrigerated',
      width: 70,
      render: (v: number) => (v === 1 ? <Tag color="blue">冷藏</Tag> : '常温'),
    },
    { title: '发货量', dataIndex: 'quantity', width: 80 },
    { title: '实收量', dataIndex: 'receivedQty', width: 80, render: (v: number) => v || 0 },
    { title: '报损量', dataIndex: 'lossQty', width: 80, render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : 0 },
    { title: '待复核', dataIndex: 'pendingQty', width: 80, render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : 0 },
    {
      title: '签收差异',
      width: 90,
      render: (_: any, r: AllocationItem) => {
        const diff = r.quantity - (r.receivedQty || 0) - (r.lossQty || 0) - (r.pendingQty || 0);
        return diff !== 0 ? <Tag color="warning">{diff}</Tag> : 0;
      },
    },
    { title: '单位成本', dataIndex: 'unitCost', width: 90, render: (v: number) => `¥${v}` },
    {
      title: '差异说明',
      dataIndex: 'diffRemark',
      width: 140,
      render: (v: string) => v || '-',
    },
  ];

  const traceColumns = [
    { title: '批次号', dataIndex: 'batchNo', width: 160 },
    { title: '商品', dataIndex: 'productName', width: 180 },
    { title: '发货门店', dataIndex: 'fromStoreName', width: 120 },
    { title: '收货门店', dataIndex: 'toStoreName', width: 120 },
    { title: '发货量', dataIndex: 'shippedQty', width: 80 },
    { title: '实收量', dataIndex: 'receivedQty', width: 80 },
    { title: '报损量', dataIndex: 'lossQty', width: 80, render: (v: number) => v > 0 ? <span style={{ color: '#ff4d4f' }}>{v}</span> : 0 },
    { title: '待复核', dataIndex: 'pendingQty', width: 80, render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : 0 },
    { title: '签收差异', dataIndex: 'signDiff', width: 80, render: (v: number) => v !== 0 ? <Tag color="warning">{v}</Tag> : 0 },
    { title: '差异金额', dataIndex: 'signDiffAmount', width: 100, render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
    { title: '损耗金额', dataIndex: 'lossAmount', width: 100, render: (v: number) => v ? <span style={{ color: '#ff4d4f' }}>¥{v.toFixed(2)}</span> : '-' },
    {
      title: '状态',
      dataIndex: 'locked',
      width: 80,
      render: (v: number) => v === 1 ? <Tag color="green" icon={<CheckOutlined />}>已锁定</Tag> : <Tag color="default">流转中</Tag>,
    },
    { title: '追踪时间', dataIndex: 'traceTime', width: 170 },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/allocations')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>调拨单详情</Title>
        {detail.isColdChain === 1 && <Tag color="blue" icon={<ExclamationCircleOutlined />}>冷链运输</Tag>}
      </Space>

      <Card loading={loading}>
        {hasRefrigerated && detail.isColdChain !== 1 && (
          <Alert
            type="error"
            showIcon
            message="冷链异常"
            description="包含冷藏商品但未使用冷链车辆，请核查！"
            style={{ marginBottom: 16 }}
          />
        )}

        <Steps
          current={currentStep}
          items={[
            { title: '待发货', icon: <SendOutlined /> },
            { title: '运输中', icon: <SendOutlined /> },
            { title: '已收货', icon: <InboxOutlined /> },
            { title: '已结算', icon: <CheckOutlined /> },
          ]}
          style={{ marginBottom: 24 }}
        />

        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="调拨单号">{detail.allocNo}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {(() => {
              const s = statusMap[detail.status] || { color: 'default', text: detail.status };
              return <Tag color={s.color}>{s.text}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="来源门店">{sourceStore?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="目标门店">{targetStore?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="运输车辆">
            {detail.vehicleName || '-'} {detail.isColdChain === 1 ? <Tag color="blue">冷链车</Tag> : <Tag>普通车</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="车牌号">{detail.plateNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="操作人">{detail.operatorName || '-'}</Descriptions.Item>
          <Descriptions.Item label="计划日期">{detail.planDate || '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{detail.remark || '-'}</Descriptions.Item>
        </Descriptions>

        {detail.status !== 'pending' && (
          <>
            <Divider orientation="left">签收概览</Divider>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={5}>
                <Card size="small">
                  <Statistic title="发货总量" value={shippedTotal} />
                </Card>
              </Col>
              <Col span={5}>
                <Card size="small">
                  <Statistic title="实收总量" value={receivedTotal} valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={5}>
                <Card size="small">
                  <Statistic title="报损总量" value={lossTotal} valueStyle={{ color: '#ff4d4f' }} />
                </Card>
              </Col>
              <Col span={5}>
                <Card size="small">
                  <Statistic title="待复核" value={pendingTotal} valueStyle={{ color: '#fa8c16' }} />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic title="签收差异" value={diffTotal} valueStyle={{ color: diffTotal !== 0 ? '#faad14' : undefined }} />
                </Card>
              </Col>
            </Row>
          </>
        )}

        <Divider orientation="left">商品明细</Divider>
        <Table
          rowKey="id"
          dataSource={detail.items || []}
          columns={itemColumns}
          scroll={{ x: 1300 }}
          pagination={false}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <strong>{shippedTotal}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5}>
                  <strong style={{ color: '#52c41a' }}>{receivedTotal}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <strong style={{ color: '#ff4d4f' }}>{lossTotal}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7}>
                  <strong style={{ color: '#fa8c16' }}>{pendingTotal}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} colSpan={3}>
                  <strong>总成本：¥{totalCost.toFixed(2)}　预估损耗：¥{lossAmount.toFixed(2)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        {traces.length > 0 && (
          <>
            <Divider orientation="left">
              <Space>
                批次追溯
                <Tag color={traces[0]?.locked === 1 ? 'green' : 'default'}>
                  {traces[0]?.locked === 1 ? '财务已锁定' : '财务未锁定'}
                </Tag>
              </Space>
            </Divider>
            <Alert
              type="info"
              showIcon
              message="区域仓视角"
              description="此处可查看每批货物的去向、签收差异和损耗情况。结算完成后数据锁定，仍可追溯查看。"
              style={{ marginBottom: 12 }}
            />
            <Table
              rowKey="id"
              dataSource={traces}
              columns={traceColumns}
              scroll={{ x: 1500 }}
              pagination={{ pageSize: 10 }}
            />
          </>
        )}

        {settlement && (
          <>
            <Divider orientation="left">结算信息</Divider>
            <Descriptions column={4} bordered size="middle">
              <Descriptions.Item label="结算单号">{settlement.settleNo}</Descriptions.Item>
              <Descriptions.Item label="总成本">¥{settlement.totalCost?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="可售金额">¥{settlement.sellableAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="损耗金额">
                <span style={{ color: '#ff4d4f' }}>¥{settlement.lossAmount?.toFixed(2) || '-'}</span>
                {settlement.lossLocked === 1 && <Tag color="green" style={{ marginLeft: 8 }}>已锁定</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="待复核金额">¥{settlement.pendingAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="折扣金额">¥{settlement.discountAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="损耗率">{(settlement.lossRate || 0).toFixed(2)}%</Descriptions.Item>
              <Descriptions.Item label="最终结算">¥{settlement.finalAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="会计">{settlement.accountantName || '-'}</Descriptions.Item>
              <Descriptions.Item label="结算时间">{settlement.settleTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                {settlement.status === 'confirmed' ? <Tag color="green">已确认</Tag> : <Tag color="orange">草稿</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}

        <Divider />
        <Space>
          {detail.status === 'pending' && (
            <Popconfirm title="确认开始发货？" onConfirm={() => handleStatusChange('shipped', '已开始发货')}>
              <Button type="primary" icon={<SendOutlined />}>
                开始发货
              </Button>
            </Popconfirm>
          )}
          {detail.status === 'shipped' && (
            <Button type="primary" icon={<InboxOutlined />} onClick={openReceiveModal}>
              录入签收差异
            </Button>
          )}
          {detail.status === 'received' && !settlement && (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => navigate(`/settlements`)}>
              去财务结算
            </Button>
          )}
          {settlement && (
            <Button icon={<EyeOutlined />} onClick={() => navigate(`/settlements/${settlement.id}`)}>
              查看结算单
            </Button>
          )}
          {traces.length > 0 && (
            <Button onClick={() => message.info('区域仓可在上方「批次追溯」查看完整流向')}>
              查看追溯说明
            </Button>
          )}
        </Space>
      </Card>

      <Modal
        open={receiveModalOpen}
        title="录入签收差异（实收 / 报损 / 待复核）"
        width={1100}
        onCancel={() => setReceiveModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setReceiveModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submittingReceive}
            onClick={handleSubmitReceive}
          >
            确认签收
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message="注意"
          description="部分商品报损时，财务结算会拆分为可售、报损、待复核三段，不会整单作废。"
          style={{ marginBottom: 12 }}
        />
        <Table
          rowKey="id"
          dataSource={detail.items || []}
          pagination={false}
          scroll={{ y: 420, x: 1000 }}
          columns={[
            { title: '商品名称', dataIndex: 'productName', width: 180, fixed: 'left' as const },
            { title: '批次号', dataIndex: 'batchNo', width: 140 },
            { title: '发货量', dataIndex: 'quantity', width: 80 },
            {
              title: '实收数量',
              width: 130,
              fixed: 'right' as const,
              render: (_: any, _r: any, idx: number) => (
                <InputNumber
                  min={0}
                  max={detail.items?.[idx].quantity}
                  value={receiveItems[idx]?.receivedQty}
                  onChange={(v) => handleReceiveQtyChange(idx, 'receivedQty', v)}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: '报损数量',
              width: 130,
              fixed: 'right' as const,
              render: (_: any, _r: any, idx: number) => (
                <InputNumber
                  min={0}
                  max={detail.items?.[idx].quantity}
                  value={receiveItems[idx]?.lossQty}
                  onChange={(v) => handleReceiveQtyChange(idx, 'lossQty', v)}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: '待复核数量',
              width: 130,
              fixed: 'right' as const,
              render: (_: any, _r: any, idx: number) => (
                <InputNumber
                  min={0}
                  max={detail.items?.[idx].quantity}
                  value={receiveItems[idx]?.pendingQty}
                  onChange={(v) => handleReceiveQtyChange(idx, 'pendingQty', v)}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: '差异说明',
              width: 200,
              fixed: 'right' as const,
              render: (_: any, _r: any, idx: number) => (
                <Input
                  placeholder="签收差异说明"
                  value={receiveItems[idx]?.diffRemark}
                  onChange={(e) => handleReceiveQtyChange(idx, 'diffRemark', e.target.value)}
                />
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
