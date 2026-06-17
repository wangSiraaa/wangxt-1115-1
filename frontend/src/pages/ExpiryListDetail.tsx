import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Table, Tag, Space, Button, Typography, message, Divider, Popconfirm, Card } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { expiryListApi, storeApi, allocationApi } from '../services/api';
import type { ExpiryList, Store, Allocation } from '../types';

const { Title } = Typography;

export default function ExpiryListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ExpiryList | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  useEffect(() => {
    initData();
  }, [id]);

  const initData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        expiryListApi.getDetail(id),
        storeApi.getList(),
      ]);
      setDetail(d);
      setStores(s);
      const allocs = await allocationApi.getList({ listId: id });
      setAllocations(allocs);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await expiryListApi.submit(id);
      message.success('提交成功');
      initData();
    } catch (err: any) {
      message.error(err.message || '提交失败');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await expiryListApi.delete(id);
      message.success('删除成功');
      navigate('/expiry-lists');
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  if (!detail) return null;

  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    submitted: { color: 'blue', text: '已提交' },
    allocated: { color: 'cyan', text: '已调拨' },
    settled: { color: 'green', text: '已结算' },
  };

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
    { title: '生产日期', dataIndex: 'productionDate', width: 120 },
    { title: '到期日期', dataIndex: 'expiryDate', width: 120 },
    {
      title: '到期天数',
      dataIndex: 'expiryDays',
      width: 100,
      render: (v: number) => {
        if (v <= 7) return <Tag color="red">{v}天</Tag>;
        if (v <= 15) return <Tag color="orange">{v}天</Tag>;
        return <Tag color="gold">{v}天</Tag>;
      },
    },
    { title: '单位成本', dataIndex: 'unitCost', width: 100, render: (v: number) => `¥${v}` },
  ];

  const allocColumns = [
    { title: '调拨单号', dataIndex: 'allocNo', width: 200 },
    {
      title: '目标门店',
      dataIndex: 'targetStoreId',
      width: 140,
      render: (sid: string) => stores.find(s => s.id === sid)?.name || '-',
    },
    { title: '车辆', dataIndex: 'vehicleName', width: 120 },
    { title: '车牌号', dataIndex: 'plateNo', width: 120 },
    {
      title: '冷链',
      dataIndex: 'isColdChain',
      width: 80,
      render: (v: number) => (v === 1 ? <Tag color="blue">是</Tag> : '否'),
    },
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
      width: 100,
      render: (_: any, r: Allocation) => (
        <Button size="small" onClick={() => navigate(`/allocations/${r.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const storeName = stores.find(s => s.id === detail.storeId)?.name || '-';
  const hasRefrigerated = (detail.items || []).some(i => i.isRefrigerated === 1);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/expiry-lists')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>临期清单详情</Title>
      </Space>

      <Card loading={loading}>
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="清单编号">{detail.listNo}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {(() => {
              const s = statusMap[detail.status] || { color: 'default', text: detail.status };
              return <Tag color={s.color}>{s.text}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="门店">{storeName}</Descriptions.Item>
          <Descriptions.Item label="提交人">{detail.submitterName || '-'}</Descriptions.Item>
          <Descriptions.Item label="提交时间">{detail.submitTime || '-'}</Descriptions.Item>
          <Descriptions.Item label="是否含冷藏商品">
            {hasRefrigerated ? <Tag color="blue">是（需冷链车）</Tag> : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{detail.remark || '-'}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">商品明细</Divider>
        <Table
          rowKey="id"
          dataSource={detail.items || []}
          columns={itemColumns}
          scroll={{ x: 1100 }}
          pagination={false}
        />

        {allocations.length > 0 && (
          <>
            <Divider orientation="left">调拨记录</Divider>
            <Table
              rowKey="id"
              dataSource={allocations}
              columns={allocColumns}
              scroll={{ x: 900 }}
              pagination={false}
            />
          </>
        )}

        <Divider />
        <Space>
          {detail.status === 'draft' && (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleSubmit}>
                提交清单
              </Button>
              <Popconfirm title="确认删除该清单？" onConfirm={handleDelete}>
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          )}
          {detail.status === 'submitted' && (
            <Button type="primary" onClick={() => navigate('/allocations')}>
              去安排调拨
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
