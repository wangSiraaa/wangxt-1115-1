import { Router, Request, Response } from 'express';
import { query, queryOne, run, transaction } from '../dbHelper';
import { generateId, generateNo } from '../utils';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { listId, status, sourceStoreId, targetStoreId } = req.query;
  let sql = 'SELECT * FROM allocations WHERE 1=1';
  const params: any[] = [];
  if (listId) {
    sql += ' AND listId = ?';
    params.push(listId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (sourceStoreId) {
    sql += ' AND sourceStoreId = ?';
    params.push(sourceStoreId);
  }
  if (targetStoreId) {
    sql += ' AND targetStoreId = ?';
    params.push(targetStoreId);
  }
  sql += ' ORDER BY planDate DESC';
  const allocs = await query(sql, params);
  res.json({ code: 0, data: allocs });
});

router.get('/:id', async (req: Request, res: Response) => {
  const alloc = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]) as any;
  if (!alloc) {
    return res.json({ code: 404, message: '调拨单不存在' });
  }
  const items = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [req.params.id]);
  const sourceStore = await queryOne('SELECT * FROM stores WHERE id = ?', [alloc.sourceStoreId]);
  const targetStore = await queryOne('SELECT * FROM stores WHERE id = ?', [alloc.targetStoreId]);
  res.json({ code: 0, data: { ...alloc, items, sourceStore, targetStore } });
});

router.post('/', async (req: Request, res: Response) => {
  const {
    listId, sourceStoreId, targetStoreId, vehicleId,
    operatorId, operatorName, planDate, remark, itemIds
  } = req.body;

  if (!listId || !sourceStoreId || !targetStoreId || !vehicleId || !itemIds || itemIds.length === 0) {
    return res.json({ code: 400, message: '参数不完整' });
  }

  const list = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [listId]) as any;
  if (!list) {
    return res.json({ code: 404, message: '临期清单不存在' });
  }

  const vehicle = await queryOne('SELECT * FROM vehicles WHERE id = ?', [vehicleId]) as any;
  if (!vehicle) {
    return res.json({ code: 404, message: '车辆不存在' });
  }

  const placeholders = itemIds.map(() => '?').join(',');
  const listItems = await query('SELECT * FROM expiry_list_items WHERE id IN (' + placeholders + ')', itemIds) as any[];
  if (listItems.length === 0) {
    return res.json({ code: 400, message: '没有有效的商品' });
  }

  const hasRefrigerated = listItems.some(item => item.isRefrigerated === 1);
  if (hasRefrigerated && vehicle.isColdChain !== 1) {
    return res.json({ code: 400, message: '清单包含冷藏商品，必须选择冷链车辆' });
  }

  const id = generateId();
  const allocNo = generateNo('AL');

  await transaction(async () => {
    await run(
      'INSERT INTO allocations (id, allocNo, listId, sourceStoreId, targetStoreId, vehicleId, vehicleName, plateNo, isColdChain, operatorId, operatorName, planDate, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, allocNo, listId, sourceStoreId, targetStoreId, vehicleId, vehicle.name, vehicle.plateNo, vehicle.isColdChain, operatorId, operatorName, planDate || dayjs().format('YYYY-MM-DD'), 'pending', remark]
    );

    for (const item of listItems) {
      await run(
        'INSERT INTO allocation_items (id, allocationId, listItemId, productId, productName, sku, batchNo, quantity, isRefrigerated, unitCost, basePrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), id, item.id, item.productId, item.productName, item.sku, item.batchNo, item.quantity, item.isRefrigerated, item.unitCost, item.basePrice]
      );
      await run('UPDATE inventory_batches SET status = ? WHERE id = ?', ['allocated', item.batchId]);
    }

    const allListItems = await query('SELECT * FROM expiry_list_items WHERE listId = ?', [listId]);
    const allocatedItemIds = new Set(listItems.map((i: any) => i.id));
    const unallocatedExists = allListItems.some((i: any) => !allocatedItemIds.has(i.id));
    if (!unallocatedExists) {
      await run('UPDATE expiry_lists SET status = ? WHERE id = ?', ['allocated', listId]);
    }
  });

  const alloc = await queryOne('SELECT * FROM allocations WHERE id = ?', [id]);
  res.json({ code: 0, data: alloc });
});

router.put('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'shipped', 'received', 'settled'];
  if (!validStatuses.includes(status)) {
    return res.json({ code: 400, message: '无效状态' });
  }
  const alloc = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]) as any;
  if (!alloc) {
    return res.json({ code: 404, message: '调拨单不存在' });
  }
  await run('UPDATE allocations SET status = ? WHERE id = ?', [status, req.params.id]);

  if (status === 'received') {
    const items = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [req.params.id]) as any[];
    await transaction(async () => {
      for (const item of items) {
        const listItem = await queryOne('SELECT * FROM expiry_list_items WHERE id = ?', [item.listItemId]) as any;
        const originalBatch = await queryOne('SELECT * FROM inventory_batches WHERE id = ?', [listItem.batchId]) as any;
        const newBatchId = generateId();
        await run(
          'INSERT INTO inventory_batches (id, productId, storeId, batchNo, quantity, productionDate, expiryDate, inboundDate, status, unitCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [newBatchId, item.productId, alloc.targetStoreId, item.batchNo + '-T', item.quantity, originalBatch.productionDate, originalBatch.expiryDate, dayjs().format('YYYY-MM-DD'), 'normal', item.unitCost]
        );
      }
    });
  }

  const updated = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: updated });
});

export default router;
