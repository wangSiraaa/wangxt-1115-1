import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Typography, Divider, Space } from 'antd';
import {
  ShopOutlined,
  UnorderedListOutlined,
  ReloadOutlined,
  CalculatorOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { inventoryApi, expiryListApi, allocationApi, settlementApi } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function Dashboard() {
  const [stats, setStats] = useState({
    expiringCount: 0,
    expiredCount: 0,
    listCount: 0,
    allocCount: 0,
    settleCount: 0,
  });
  const [recentLists, setRecentLists] = useState<any[]>([]);
  const [recentAllocs, setRecentAllocs] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [inv, lists, allocs, settles] = await Promise.all([
        inventoryApi.getList(),
        expiryListApi.getList(),
        allocationApi.getList(),
        settlementApi.getList(),
      ]);
      const expiring = inv.filter(b => {
        const days = dayjs(b.expiryDate).diff(dayjs(), 'day');
        return days >= 0 && days <= 30;
      }).length;
      const expired = inv.filter(b => dayjs(b.expiryDate).diff(dayjs(), 'day') < 0).length;

      setStats({
        expiringCount: expiring,
        expiredCount: expired,
        listCount: lists.length,
        allocCount: allocs.length,
        settleCount: settles.length,
      });
      setRecentLists(lists.slice(0, 5));
      setRecentAllocs(allocs.slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      submitted: { color: 'blue', text: '已提交' },
      allocated: { color: 'cyan', text: '已调拨' },
      settled: { color: 'green', text: '已结算' },
      pending: { color: 'orange', text: '待发货' },
      shipped: { color: 'blue', text: '运输中' },
      received: { color: 'cyan', text: '已收货' },
      confirmed: { color: 'green', text: '已确认' },
    };
    const s = map[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>工作台</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="临期商品批次"
              value={stats.expiringCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已过期批次"
              value={stats.expiredCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="临期清单"
              value={stats.listCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<UnorderedListOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="调拨单"
              value={stats.allocCount}
              valueStyle={{ color: '#13c2c2' }}
              prefix={<ReloadOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="结算单"
              value={stats.settleCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="门店/仓库"
              value={3}
              valueStyle={{ color: '#722ed1' }}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="最近临期清单">
            <List
              dataSource={recentLists}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={<Text strong>{item.listNo}</Text>}
                    description={
                      <Space size={8} wrap>
                        <span>提交：{item.submitterName || '-'}</span>
                        <span>时间：{item.submitTime}</span>
                        {getStatusTag(item.status)}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近调拨单">
            <List
              dataSource={recentAllocs}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={<Text strong>{item.allocNo}</Text>}
                    description={
                      <Space size={8} wrap>
                        <span>车辆：{item.vehicleName || '-'}</span>
                        <span>计划：{item.planDate}</span>
                        {getStatusTag(item.status)}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Divider />
      <Card title="业务流程说明">
        <Row gutter={16}>
          <Col span={8}>
            <Title level={5}>
              <UnorderedListOutlined style={{ color: '#1890ff' }} /> 店长提交临期清单
            </Title>
            <Text type="secondary">
              查看门店库存，将30天内到期的商品加入临期清单。系统自动过滤已过期商品。
            </Text>
          </Col>
          <Col span={8}>
            <Title level={5}>
              <ReloadOutlined style={{ color: '#13c2c2' }} /> 区域仓安排调拨
            </Title>
            <Text type="secondary">
              接收清单后安排调拨去向和车辆。包含冷藏商品的调拨必须选择冷链车辆。
            </Text>
          </Col>
          <Col span={8}>
            <Title level={5}>
              <CalculatorOutlined style={{ color: '#52c41a' }} /> 财务核算结算
            </Title>
            <Text type="secondary">
              核算调拨商品的折扣与损耗金额，完成结算后损耗金额锁定不可修改。
            </Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
