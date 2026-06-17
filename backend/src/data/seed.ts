import { initDatabase } from '../database';
import { query, queryOne, run, runNamed, transaction } from '../dbHelper';
import { generateId } from '../utils';
import dayjs from 'dayjs';

const stores = [
  { id: generateId(), code: 'ST001', name: '朝阳门店', type: 'store', region: '华北', address: '北京市朝阳区朝阳门外大街1号' },
  { id: generateId(), code: 'ST002', name: '海淀店', type: 'store', region: '华北', address: '北京市海淀区中关村大街2号' },
  { id: generateId(), code: 'ST003', name: '西城店', type: 'store', region: '华北', address: '北京市西城区金融街3号' },
  { id: generateId(), code: 'WH001', name: '华北区域仓', type: 'warehouse', region: '华北', address: '北京市大兴区亦庄经济开发区物流园' },
];

const products = [
  { id: generateId(), sku: 'SKU001', name: '伊利纯牛奶250ml', category: '乳制品', isRefrigerated: 1, unit: '盒', basePrice: 3.5 },
  { id: generateId(), sku: 'SKU002', name: '蒙牛酸奶100g', category: '乳制品', isRefrigerated: 1, unit: '杯', basePrice: 4.0 },
  { id: generateId(), sku: 'SKU003', name: '双汇火腿肠30g', category: '肉制品', isRefrigerated: 0, unit: '根', basePrice: 2.0 },
  { id: generateId(), sku: 'SKU004', name: '康师傅红烧牛肉面', category: '方便食品', isRefrigerated: 0, unit: '桶', basePrice: 4.5 },
  { id: generateId(), sku: 'SKU005', name: '三元鲜牛奶500ml', category: '乳制品', isRefrigerated: 1, unit: '瓶', basePrice: 8.0 },
  { id: generateId(), sku: 'SKU006', name: '洽洽香瓜子200g', category: '休闲食品', isRefrigerated: 0, unit: '袋', basePrice: 6.5 },
  { id: generateId(), sku: 'SKU007', name: '和路雪冰淇淋100g', category: '冷冻食品', isRefrigerated: 1, unit: '支', basePrice: 5.0 },
  { id: generateId(), sku: 'SKU008', name: '农夫山泉550ml', category: '饮料', isRefrigerated: 0, unit: '瓶', basePrice: 2.0 },
];

const vehicles = [
  { id: generateId(), plateNo: '京A12345', name: '冷链车01', isColdChain: 1, capacity: 2000, driverName: '张师傅', driverPhone: '13800138001', status: 'available' },
  { id: generateId(), plateNo: '京A67890', name: '冷链车02', isColdChain: 1, capacity: 3000, driverName: '李师傅', driverPhone: '13800138002', status: 'available' },
  { id: generateId(), plateNo: '京B11111', name: '普通货车01', isColdChain: 0, capacity: 5000, driverName: '王师傅', driverPhone: '13800138003', status: 'available' },
  { id: generateId(), plateNo: '京B22222', name: '普通货车02', isColdChain: 0, capacity: 4000, driverName: '赵师傅', driverPhone: '13800138004', status: 'available' },
];

const users = [
  { id: generateId(), username: 'manager01', name: '刘店长', role: 'store_manager', storeId: stores[0].id, storeName: stores[0].name },
  { id: generateId(), username: 'manager02', name: '陈店长', role: 'store_manager', storeId: stores[1].id, storeName: stores[1].name },
  { id: generateId(), username: 'warehouse01', name: '王仓管', role: 'warehouse', storeId: stores[3].id, storeName: stores[3].name },
  { id: generateId(), username: 'finance01', name: '李会计', role: 'finance', storeId: stores[3].id, storeName: stores[3].name },
];

function createInventoryBatch(productId: string, storeId: string, daysToExpiry: number, quantity: number): any {
  const id = generateId();
  const productionDate = dayjs().subtract(60 - daysToExpiry + 30, 'day').format('YYYY-MM-DD');
  const expiryDate = dayjs().add(daysToExpiry, 'day').format('YYYY-MM-DD');
  const inboundDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const status = daysToExpiry < 0 ? 'expired' : daysToExpiry <= 30 ? 'expiring' : 'normal';
  const product = products.find(p => p.id === productId)!;
  return {
    id,
    productId,
    storeId,
    batchNo: `B${dayjs().format('YYYYMMDD')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    quantity,
    productionDate,
    expiryDate,
    inboundDate,
    status,
    unitCost: Number((product.basePrice * 0.6).toFixed(2)),
  };
}

export async function seed() {
  await initDatabase();

  const existingStores = await queryOne<any>('SELECT COUNT(*) as count FROM stores');
  if (existingStores && existingStores.count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  await transaction(async () => {
    for (const s of stores) {
      await run('INSERT INTO stores (id, code, name, type, region, address) VALUES (?, ?, ?, ?, ?, ?)', [s.id, s.code, s.name, s.type, s.region, s.address]);
    }
    for (const p of products) {
      await run('INSERT INTO products (id, sku, name, category, isRefrigerated, unit, basePrice) VALUES (?, ?, ?, ?, ?, ?, ?)', [p.id, p.sku, p.name, p.category, p.isRefrigerated, p.unit, p.basePrice]);
    }
    for (const v of vehicles) {
      await run('INSERT INTO vehicles (id, plateNo, name, isColdChain, capacity, driverName, driverPhone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [v.id, v.plateNo, v.name, v.isColdChain, v.capacity, v.driverName, v.driverPhone, v.status]);
    }
    for (const u of users) {
      await run('INSERT INTO users (id, username, name, role, storeId, storeName) VALUES (?, ?, ?, ?, ?, ?)', [u.id, u.username, u.name, u.role, u.storeId, u.storeName]);
    }

    const batches = [
      createInventoryBatch(products[0].id, stores[0].id, 5, 120),
      createInventoryBatch(products[1].id, stores[0].id, 3, 80),
      createInventoryBatch(products[2].id, stores[0].id, 15, 300),
      createInventoryBatch(products[3].id, stores[0].id, -2, 200),
      createInventoryBatch(products[4].id, stores[0].id, 7, 60),
      createInventoryBatch(products[6].id, stores[0].id, 10, 150),
      createInventoryBatch(products[7].id, stores[0].id, 45, 500),

      createInventoryBatch(products[0].id, stores[1].id, 8, 90),
      createInventoryBatch(products[5].id, stores[1].id, 20, 200),
      createInventoryBatch(products[3].id, stores[1].id, -5, 150),
      createInventoryBatch(products[6].id, stores[1].id, 12, 80),

      createInventoryBatch(products[0].id, stores[2].id, 25, 100),
      createInventoryBatch(products[2].id, stores[2].id, 18, 250),
      createInventoryBatch(products[4].id, stores[2].id, 40, 120),
    ];
    for (const b of batches) {
      await run('INSERT INTO inventory_batches (id, productId, storeId, batchNo, quantity, productionDate, expiryDate, inboundDate, status, unitCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [b.id, b.productId, b.storeId, b.batchNo, b.quantity, b.productionDate, b.expiryDate, b.inboundDate, b.status, b.unitCost]);
    }
  });

  console.log('演示数据初始化完成！');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
