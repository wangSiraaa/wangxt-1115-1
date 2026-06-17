import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions, Table, Tag, Space, Button, Typography, message, Divider, Card,
  Form, InputNumber, Input, Alert, Popconfirm, Statistic, Row, Col,
  Tabs, Radio, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, SaveOutlined, LockOutlined,
  CheckCircleTwoTone, CloseCircleTwoTone, ExclamationCircleOutlined,
  MinusCircleOutlined, PlusCircleOutlined,
} from '@ant-design/icons';
import { settlementApi, storeApi } from '../services/api';
import type { Settlement, Store, SettleSegment, BatchTrace, ReviewStatus, SettleSegmentType } from '../types';

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
  const [segments, setSegments] = useState<SettleSegment[]>([]);
  const [traces, setTraces] = useState<BatchTrace[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingSegment, setReviewingSegment] = useState<SettleSegment | null>(null);
  const [reviewApproved, setReviewApproved] = useState<boolean | null>(null);
  const [reviewConvertTo, setReviewConvertTo] = useState<SettleSegmentType>('sellable');
  const [reviewRemark, setReviewRemark] = useState('');
  const [reviewing, setReviewing] = useState(false);

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
      setSegments(detail.segments || []);
      setTraces(detail.traces || []);
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

  const isConfirmed = detail?.status === 'confirmed';
  const lossLocked = detail?.lossLocked === 1;

  const sellableSegments = useMemo(() => segments.filter(s => s.segmentType === 'sellable'), [segments]);
  const lossSegments = useMemo(() => segments.filter(s => s.segmentType === 'loss'), [segments]);
  const pendingSegments = useMemo(() => segments.filter(s => s.segmentType === 'pending_review'), [segments]);

  const sellableAmt = sellableSegments.reduce((s, i) => s + (i.segmentAmount ?? i.amount), 0);
  const lossAmt = lossSegments.reduce((s, i) => s + (i.segmentAmount ?? i.amount), 0);
  const pendingAmt = pendingSegments.reduce((s, i) => s + (i.segmentAmount ?? i.amount), 0);

  const recalcFinal = (values: any) => {
    const total = values.totalCost || 0;
    const disc = values.discountAmount || 0;
    return Math.max(0, total - disc - lossAmt);
  };

  const handleSave = async () => {
    if (!id) return;
    const values = await form.validateFields();
    const finalAmount = recalcFinal(values);
    const lossRate = values.totalCost > 0 ? lossAmt / values.totalCost : 0;
    setSaving(true);
    try {
      await settlementApi.update(id, {
        ...values,
        sellableAmount: sellableAmt,
        pendingAmount: pendingAmt,
        finalAmount,
        lossRate,
        segments,
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
    const hasPending = pendingSegments.some(s => s.reviewStatus === 'pending');
    if (hasPending) {
      Modal.confirm({
        title: '存在未完成复核',
        icon: <ExclamationCircleOutlined />,
        content: `${pendingSegments.filter(s => s.reviewStatus === 'pending').length} 条待复核记录尚未审批，确认结算将无法确认。请先完成复核。`,
        okText: '去复核',
        cancelText: '我知道了',
        onOk: () => {},
      });
      return;
    }
    setConfirming(true);
    try {
      await settlementApi.confirm(id);
      message.success('结算已确认，损耗金额已锁定，批次追溯已锁定');
      initData();
    } catch (err: any) {
      message.error(err.message || '确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const openReview = (seg: SettleSegment) => {
    setReviewingSegment(seg);
    setReviewApproved(null);
    setReviewConvertTo('sellable');
    setReviewRemark('');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!id || !reviewingSegment) return;
    if (reviewApproved === null) {
      message.warning('请选择审批结果');
      return;
    }
    const segId = reviewingSegment.id;
    setReviewing(true);
    try {
      await settlementApi.reviewSegment(id, {
        segmentId: segId,
        approved: reviewApproved,
        convertTo: reviewApproved ? reviewConvertTo : undefined,
        remark: reviewRemark,
      });
      message.success('审批完成');
      setReviewModalOpen(false);
      initData();
    } catch (err: any) {
      message.error(err.message || '审批失败');
    } finally {
      setReviewing(false);
    }
  };

  if (!detail) return null;

  const allocation = detail.allocation;
  const sourceStore = detail.sourceStore || stores.find(s => s.id === allocation?.sourceStoreId);
  const targetStore = detail.targetStore || stores.find(s => s.id === allocation?.targetStoreId);

  const commonSegColumns = [
    { title: '商品名称', dataIndex: 'productName', width: 180 },
    { title: '批次号', dataIndex: 'batchNo', width: 140 },
    { title: '数量', dataIndex: 'quantity', width: 80 },
    {
      title: '金额',
      dataIndex: 'segmentAmount',
      width: 120,
      render: (v: number, r: SettleSegment) => <strong>¥{(v ?? r.amount ?? 0).toFixed(2)}</strong>,
    },
    { title: '备注', dataIndex: 'reviewRemark', width: 200, render: (v: string) => v || '-' },
  ];

  const lossSegColumns = [
    ...commonSegColumns,
    {
      title: '报损责任方',
      dataIndex: 'responsibleParty',
      width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { store: '门店', warehouse: '区域仓', transport: '运输方', other: '其他' };
        return map[v] || v || '-';
      },
    },
  ];

  const pendingSegColumns = [
    ...commonSegColumns,
    {
      title: '审批状态', width: 110, render: (_: any, r: SettleSegment) => {
        const map: Record<ReviewStatus, { color: string; text: string }> = {
          pending: { color: 'orange', text: '待审批' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已驳回' },
          converted: { color: 'blue', text: '已转段' },
        };
        const s = map[r.reviewStatus || 'pending'];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '操作', width: 180, render: (_: any, r: SettleSegment) => {
        if (isConfirmed || r.reviewStatus !== 'pending') return '-';
        return (
          <Space>
            <Button size="small" type="primary" icon={<CheckCircleTwoTone />} onClick={() => openReview(r)}>
              审批
            </Button>
          </Space>
        );
      },
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
      title: '锁定',
      dataIndex: 'locked',
      width: 70,
      render: (v: number) => v === 1 ? <Tag color="green" icon={<LockOutlined />}>是</Tag> : '否',
    },
    { title: '追踪时间', dataIndex: 'traceTime', width: 170 },
  ];

  const pendingCount = pendingSegments.filter(s => s.reviewStatus === 'pending').length;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/settlements')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>结算单详情</Title>
        {isConfirmed && lossLocked && <Tag color="green" icon={<LockOutlined />}>已确认（损耗已锁定）</Tag>}
        {pendingCount > 0 && !isConfirmed && <Tag color="orange" icon={<ExclamationCircleOutlined />}>{pendingCount} 条待复核</Tag>}
      </Space>

      <Card loading={loading}>
        {isConfirmed && (
          <Alert
            type="info"
            showIcon
            icon={<LockOutlined />}
            message="结算已确认，损耗已锁定"
            description="财务数据已锁定，不可修改。区域仓仍可在「批次追溯」Tab 中查看每批货物的去向和签收差异。"
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

        <Divider orientation="left">财务概览</Divider>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={5}>
            <Card size="small">
              <Statistic title="总成本" value={detail.totalCost} precision={2} prefix="¥" />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
              <Statistic
                title="可售金额" value={sellableAmt} precision={2} prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderLeft: `4px solid ${lossLocked ? '#52c41a' : '#ff4d4f'}` }}>
              <Statistic
                title="损耗金额" value={lossAmt} precision={2} prefix={lossLocked ? <LockOutlined style={{ color: '#52c41a', marginRight: 4 }} /> : undefined}
                suffix={lossLocked ? <Tag color="green" style={{ marginLeft: 8 }}>已锁定</Tag> : undefined}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderLeft: '4px solid #fa8c16' }}>
              <Statistic
                title="待复核金额" value={pendingAmt} precision={2} prefix="¥"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="最终结算" value={detail.finalAmount} precision={2} prefix="¥"
                valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">分段明细</Divider>
        <Tabs
          type="card"
          defaultActiveKey="sellable"
          items={[
            {
              key: 'sellable',
              label: <Space><PlusCircleOutlined style={{ color: '#52c41a' }} />可售商品 ({sellableSegments.length})</Space>,
              children: (
                <Table
                  rowKey="id"
                  dataSource={sellableSegments}
                  columns={commonSegColumns}
                  scroll={{ x: 800 }}
                  pagination={{ pageSize: 8 }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={2}>
                          <strong>可售合计</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <strong>{sellableSegments.reduce((s, i) => s + i.quantity, 0)}</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <strong style={{ color: '#52c41a' }}>¥{sellableAmt.toFixed(2)}</strong>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              ),
            },
            {
              key: 'loss',
              label: <Space><MinusCircleOutlined style={{ color: '#ff4d4f' }} />报损商品 ({lossSegments.length})</Space>,
              children: (
                <Table
                  rowKey="id"
                  dataSource={lossSegments}
                  columns={lossSegColumns}
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 8 }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={2}>
                          <strong>报损合计</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <strong>{lossSegments.reduce((s, i) => s + i.quantity, 0)}</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <strong style={{ color: '#ff4d4f' }}>¥{lossAmt.toFixed(2)}</strong>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              ),
            },
            {
              key: 'pending',
              label: (
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />待复核 ({pendingSegments.length})
                  {pendingCount > 0 && <span style={{ color: '#ff4d4f' }}>{pendingCount}未审</span>}
                </Space>
              ),
              children: (
                <>
                  {pendingCount > 0 && !isConfirmed && (
                    <Alert
                      type="warning"
                      showIcon
                      message="需完成全部待复核审批后，方可确认结算"
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  <Table
                    rowKey="id"
                    dataSource={pendingSegments}
                    columns={pendingSegColumns}
                    scroll={{ x: 1100 }}
                    pagination={{ pageSize: 8 }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={2}>
                            <strong>待复核合计</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>
                            <strong>{pendingSegments.reduce((s, i) => s + i.quantity, 0)}</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3}>
                            <strong style={{ color: '#fa8c16' }}>¥{pendingAmt.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                </>
              ),
            },
            {
              key: 'trace',
              label: <Space>📦 批次追溯 ({traces.length})</Space>,
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message="区域仓视角"
                    description="此处展示每批货物的去向、签收差异和损耗明细。结算完成后数据锁定但仍可见，便于区域仓追责查询。"
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
              ),
            },
          ]}
        />

        <Divider orientation="left">财务核算</Divider>
        <Form form={form} layout="vertical" disabled={isConfirmed}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="商品总成本" name="totalCost" rules={[{ required: true, message: '请输入' }]}>
                <InputNumber
                  style={{ width: '100%' }} min={0} step={0.01} precision={2} prefix="¥"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="折扣金额" name="discountAmount">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2} prefix="¥"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label={
                  <Space>
                    损耗金额
                    {lossLocked && <LockOutlined style={{ color: '#52c41a' }} />}
                  </Space>
                }
                name="lossAmount"
              >
                <InputNumber
                  style={{ width: '100%' }} min={0} step={0.01} precision={2} prefix="¥"
                  disabled={lossLocked}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="最终结算金额" name="finalAmount">
                <InputNumber
                  style={{ width: '100%' }} min={0} step={0.01} precision={2} prefix="¥"
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
                  value={detail.totalCost > 0 ? (lossAmt / detail.totalCost) * 100 : 0}
                  precision={2}
                  suffix="%"
                  valueStyle={{
                    color: detail.totalCost > 0 && (lossAmt / detail.totalCost) > 0.1 ? '#ff4d4f' : '#fa8c16',
                  }}
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
                title={
                  pendingCount > 0
                    ? `存在 ${pendingCount} 条待复核未审批，请先处理`
                    : '确认结算完成？'
                }
                description={
                  pendingCount > 0
                    ? '待复核记录全部审批通过后，方可确认结算。'
                    : '确认后损耗金额和批次追溯将锁定，不可修改。'
                }
                disabled={pendingCount > 0}
                onConfirm={handleConfirm}
                okButtonProps={{ loading: confirming }}
              >
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={pendingCount > 0}
                >
                  确认结算
                </Button>
              </Popconfirm>
            </>
          )}
          {isConfirmed && traces.length > 0 && (
            <Tag color="green" icon={<LockOutlined />}>
              本结算已确认，损耗已锁定。批次追溯数据已封存，供区域仓查询
            </Tag>
          )}
        </Space>
      </Card>

      <Modal
        open={reviewModalOpen}
        title="待复核审批"
        width={560}
        onCancel={() => setReviewModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setReviewModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={reviewing}
            onClick={handleSubmitReview}
          >
            提交审批
          </Button>,
        ]}
      >
        {reviewingSegment && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="商品名称">{reviewingSegment.productName}</Descriptions.Item>
              <Descriptions.Item label="批次号">{reviewingSegment.batchNo}</Descriptions.Item>
              <Descriptions.Item label="数量">{reviewingSegment.quantity}</Descriptions.Item>
              <Descriptions.Item label="金额">¥{(reviewingSegment.segmentAmount ?? reviewingSegment.amount ?? 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="原备注">{reviewingSegment.reviewRemark || reviewingSegment.remark || '-'}</Descriptions.Item>
            </Descriptions>

            <Form layout="vertical">
              <Form.Item label="审批结果" required>
                <Radio.Group
                  value={reviewApproved}
                  onChange={(e) => setReviewApproved(e.target.value)}
                >
                  <Radio value={true}>
                    <Space><CheckCircleTwoTone twoToneColor="#52c41a" />通过</Space>
                  </Radio>
                  <Radio value={false}>
                    <Space><CloseCircleTwoTone twoToneColor="#ff4d4f" />驳回（一律转报损）</Space>
                  </Radio>
                </Radio.Group>
              </Form.Item>

              {reviewApproved === true && (
                <Form.Item label="通过后转为哪一段？" required>
                  <Radio.Group
                    value={reviewConvertTo}
                    onChange={(e) => setReviewConvertTo(e.target.value)}
                  >
                    <Radio value="sellable">转为可售（正常结算给门店）</Radio>
                    <Radio value="loss">转为报损（走损耗流程）</Radio>
                  </Radio.Group>
                </Form.Item>
              )}

              <Form.Item label="审批备注">
                <TextArea
                  rows={3}
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                  placeholder="请填写审批备注（说明原因、责任人等）"
                />
              </Form.Item>
            </Form>

            {reviewApproved === false && (
              <Alert
                type="warning"
                showIcon
                message="驳回后，本笔待复核将自动转为报损"
                style={{ marginTop: 8 }}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
