import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Table, Tag, Space, Button, Typography, message, Divider, Card, Steps, Popconfirm } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, SendOutlined, InboxOutlined } from '@ant-design/icons';
import { allocationApi, storeApi, settlementApi } from '../services/api';
import type { Allocation, Store, Settlement } from '../types';

const { Title } = Typography;

export default function AllocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Allocation | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  useEffect(() => {
    initData();
  }, [id]);

  const initData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        allocationApi.getDetail(id),
        storeApi.getList(),
      ]);
      setDetail(d);
      setStores(s);
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
    { title: '标准售价', dataIndex: 'basePrice', width: 100, render: (v: number) => `¥${v}` },
    {
      title: '金额小计',
      width: 120,
      render: (_: any, r: any) => `¥${(r.quantity * r.unitCost).toFixed(2)}`,
    },
  ];

  const totalCost = (detail.items || []).reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const sourceStore = detail.sourceStore || stores.find(s => s.id === detail.sourceStoreId);
  const targetStore = detail.targetStore || stores.find(s => s.id === detail.targetStoreId);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/allocations')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>调拨单详情</Title>
      </Space>

      <Card loading={loading}>
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
            {detail.vehicleName || '-'} {detail.isColdChain === 1 ? <Tag color="blue">冷链</Tag> : ''}
          </Descriptions.Item>
          <Descriptions.Item label="车牌号">{detail.plateNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="操作人">{detail.operatorName || '-'}</Descriptions.Item>
          <Descriptions.Item label="计划日期">{detail.planDate || '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{detail.remark || '-'}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">商品明细</Divider>
        <Table
          rowKey="id"
          dataSource={detail.items || []}
          columns={itemColumns}
          scroll={{ x: 1000 }}
          pagination={false}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <strong>{(detail.items || []).reduce((s, i) => s + i.quantity, 0)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={3}>
                  <strong>总成本：¥{totalCost.toFixed(2)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        {settlement && (
          <>
            <Divider orientation="left">结算信息</Divider>
            <Descriptions column={3} bordered size="middle">
              <Descriptions.Item label="结算单号">{settlement.settleNo}</Descriptions.Item>
              <Descriptions.Item label="总成本">¥{settlement.totalCost?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="折扣金额">¥{settlement.discountAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="损耗金额">¥{settlement.lossAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="损耗率">{(settlement.lossRate || 0) * 100}%</Descriptions.Item>
              <Descriptions.Item label="最终结算">¥{settlement.finalAmount?.toFixed(2) || '-'}</Descriptions.Item>
              <Descriptions.Item label="会计">{settlement.accountantName || '-'}</Descriptions.Item>
              <Descriptions.Item label="结算时间">{settlement.settleTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
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
            <Popconfirm title="确认商品已送达？" onConfirm={() => handleStatusChange('received', '收货确认成功')}>
              <Button type="primary" icon={<InboxOutlined />}>
                确认收货
              </Button>
            </Popconfirm>
          )}
          {detail.status === 'received' && !settlement && (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => navigate(`/settlements`)}>
              去财务结算
            </Button>
          )}
          {settlement && (
            <Button onClick={() => navigate(`/settlements/${settlement.id}`)}>
              查看结算单
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
