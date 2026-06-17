import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Select } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  ReloadOutlined,
  ShopOutlined,
  CalculatorOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAppStore, mockUserList } from '../store/app';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems: MenuProps['items'] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/inventory', icon: <ShopOutlined />, label: '库存批次' },
  { key: '/expiry-lists', icon: <UnorderedListOutlined />, label: '临期清单' },
  { key: '/allocations', icon: <ReloadOutlined />, label: '调拨管理' },
  { key: '/settlements', icon: <CalculatorOutlined />, label: '财务结算' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setCurrentUser } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const userMenuItems: MenuProps['items'] = mockUserList.map((u) => ({
    key: u.id,
    label: `${u.name}（${u.role === 'store_manager' ? '店长' : u.role === 'warehouse' ? '区域仓' : '财务'}）`,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#002140' }}>
          {!collapsed && (
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              临期调拨系统
            </Title>
          )}
          {collapsed && <Title level={4} style={{ color: '#fff', margin: 0 }}>LT</Title>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname.split('/').slice(0, 2).join('/')]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <Title level={4} style={{ margin: 0 }}>连锁门店临期商品调拨系统</Title>
          <Space size={16}>
            <span>切换角色：</span>
            <Select
              style={{ width: 240 }}
              value={currentUser?.id}
              onChange={(val) => {
                const u = mockUserList.find(x => x.id === val);
                if (u) setCurrentUser(u);
              }}
              options={mockUserList.map(u => ({
                label: `${u.name}（${u.role === 'store_manager' ? '店长' : u.role === 'warehouse' ? '区域仓' : '财务'}）`,
                value: u.id,
              }))}
            />
            <Space>
              <Avatar icon={<UserOutlined />} />
              <span>{currentUser?.name}</span>
            </Space>
          </Space>
        </Header>
        <Content style={{ margin: '24px' }}>
          <div style={{ background: '#fff', padding: 24, minHeight: 'calc(100vh - 112px)' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
