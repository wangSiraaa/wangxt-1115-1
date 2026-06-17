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

router.get('/:id/trace', async (req: Request, res: Response) => {
  const traces = await query('SELECT * FROM batch_traces WHERE allocationId = ? ORDER BY traceTime DESC', [req.params.id]);
  res.json({ code: 0, data: traces });
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
  if (vehicle.status !== 'available') {
    return res.json({ code: 400, message: `车辆当前状态为「${vehicle.status}」，不可使用` });
  }

  const placeholders = itemIds.map(() => '?').join(',');
  const listItems = await query('SELECT * FROM expiry_list_items WHERE id IN (' + placeholders + ')', itemIds) as any[];
  if (listItems.length === 0) {
    return res.json({ code: 400, message: '没有有效的商品' });
  }

  const hasRefrigerated = listItems.some(item => item.isRefrigerated === 1);
  if (hasRefrigerated && vehicle.isColdChain !== 1) {
    const refNames = listItems.filter(i => i.isRefrigerated === 1).map(i => i.productName).join('、');
    return res.json({ code: 400, message: `清单包含冷藏商品（${refNames}），必须选择冷链车辆` });
  }
  if (!hasRefrigerated && vehicle.isColdChain === 1) {
    console.log('提示：该车辆为冷链车，用于普通商品运输将产生额外成本');
  }

  const promotionItems = listItems.filter(i => i.disposeMethod === 'promotion');
  if (promotionItems.length > 0) {
    const names = promotionItems.map(i => i.productName).join('、');
    return res.json({ code: 400, message: `以下商品系统推荐门店内促销，不可调拨：${names}。如需强制调拨，请先修改处置方式。` });
  }

  const id = generateId();
  const allocNo = generateNo('AL');
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  await transaction(async () => {
    await run(
      'INSERT INTO allocations (id, allocNo, listId, sourceStoreId, targetStoreId, vehicleId, vehicleName, plateNo, isColdChain, operatorId, operatorName, planDate, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, allocNo, listId, sourceStoreId, targetStoreId, vehicleId, vehicle.name, vehicle.plateNo, vehicle.isColdChain, operatorId, operatorName, planDate || dayjs().format('YYYY-MM-DD'), 'pending', remark]
    );

    for (const item of listItems) {
      await run(
        'INSERT INTO allocation_items (id, allocationId, listItemId, productId, productName, sku, batchNo, quantity, isRefrigerated, unitCost, basePrice, receivedQty, lossQty, pendingQty, diffQty, diffRemark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), id, item.id, item.productId, item.productName, item.sku, item.batchNo, item.quantity, item.isRefrigerated, item.unitCost, item.basePrice, 0, 0, 0, 0, '']
      );
      await run('UPDATE inventory_batches SET status = ? WHERE id = ?', ['allocated', item.batchId]);
    }

    await run('UPDATE vehicles SET status = ? WHERE id = ?', ['in_use', vehicleId]);

    const allListItems = await query('SELECT * FROM expiry_list_items WHERE listId = ?', [listId]);
    const allocatedItemIds = new Set(listItems.map((i: any) => i.id));
    const unallocatedExists = allListItems.some((i: any) => !allocatedItemIds.has(i.id));
    if (!unallocatedExists) {
      await run('UPDATE expiry_lists SET status = ? WHERE id = ?', ['allocated', listId]);
    }

    const sourceStore = await queryOne('SELECT * FROM stores WHERE id = ?', [sourceStoreId]) as any;
    const targetStore = await queryOne('SELECT * FROM stores WHERE id = ?', [targetStoreId]) as any;
    for (const item of listItems) {
      await run(
        'INSERT INTO batch_traces (id, batchNo, productId, productName, fromStoreId, fromStoreName, toStoreId, toStoreName, allocationId, allocNo, shippedQty, receivedQty, lossQty, pendingQty, unitCost, lossAmount, locked, traceTime, signDiff, signDiffAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), item.batchNo, item.productId, item.productName, sourceStoreId, sourceStore?.name, targetStoreId, targetStore?.name, id, allocNo, item.quantity, 0, 0, 0, item.unitCost, 0, 0, now, 0, 0]
      );
    }
  });

  const alloc = await queryOne('SELECT * FROM allocations WHERE id = ?', [id]);
  res.json({ code: 0, data: alloc });
});

router.put('/:id/status', async (req: Request, res: Response) => {
  const { status, receiveItems } = req.body;
  const validStatuses = ['pending', 'shipped', 'received', 'settled'];
  if (!validStatuses.includes(status)) {
    return res.json({ code: 400, message: '无效状态' });
  }
  const alloc = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]) as any;
  if (!alloc) {
    return res.json({ code: 404, message: '调拨单不存在' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  if (status === 'received') {
    if (!receiveItems || !Array.isArray(receiveItems)) {
      return res.json({ code: 400, message: '请录入签收明细' });
    }
    const allocItems = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [req.params.id]) as any[];

    await transaction(async () => {
      for (const item of allocItems) {
        const receive = receiveItems.find((r: any) => r.id === item.id) || {};
        const shippedQty = item.quantity;
        const receivedQty = Number(receive.receivedQty ?? shippedQty);
        const lossQty = Number(receive.lossQty ?? 0);
        const pendingQty = Number(receive.pendingQty ?? 0);
        const diffQty = shippedQty - receivedQty - lossQty - pendingQty;
        const diffRemark = receive.diffRemark || '';

        if (receivedQty < 0 || lossQty < 0 || pendingQty < 0) {
          throw new Error(`商品「${item.productName}」数量不能为负数`);
        }
        if (receivedQty + lossQty + pendingQty > shippedQty) {
          throw new Error(`商品「${item.productName}」实收+报损+待复核总量超过发货量`);
        }

        await run(
          'UPDATE allocation_items SET receivedQty = ?, lossQty = ?, pendingQty = ?, diffQty = ?, diffRemark = ? WHERE id = ?',
          [receivedQty, lossQty, pendingQty, diffQty, diffRemark, item.id]
        );

        if (receivedQty > 0) {
          const listItem = await queryOne('SELECT * FROM expiry_list_items WHERE id = ?', [item.listItemId]) as any;
          const originalBatch = await queryOne('SELECT * FROM inventory_batches WHERE id = ?', [listItem.batchId]) as any;
          const newBatchId = generateId();
          await run(
            'INSERT INTO inventory_batches (id, productId, storeId, batchNo, quantity, productionDate, expiryDate, inboundDate, status, unitCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newBatchId, item.productId, alloc.targetStoreId, item.batchNo + '-T', receivedQty, originalBatch.productionDate, originalBatch.expiryDate, dayjs().format('YYYY-MM-DD'), 'normal', item.unitCost]
          );
        }

        const lossAmount = lossQty * item.unitCost;
        const signDiff = diffQty;
        const signDiffAmount = signDiff * item.unitCost;
        await run(
          'UPDATE batch_traces SET receivedQty = ?, lossQty = ?, pendingQty = ?, lossAmount = ?, signDiff = ?, signDiffAmount = ?, traceTime = ? WHERE allocationId = ? AND batchNo = ? AND productId = ?',
          [receivedQty, lossQty, pendingQty, lossAmount, signDiff, signDiffAmount, now, req.params.id, item.batchNo, item.productId]
        );
      }

      await run('UPDATE allocations SET status = ? WHERE id = ?', ['received', req.params.id]);
      await run('UPDATE vehicles SET status = ? WHERE id = ?', ['available', alloc.vehicleId]);
    });
  } else {
    if (status === 'shipped') {
      await run('UPDATE vehicles SET status = ? WHERE id = ?', ['in_use', alloc.vehicleId]);
    }
    await run('UPDATE allocations SET status = ? WHERE id = ?', [status, req.params.id]);
  }

  const updated = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: updated });
});

router.post('/:id/confirm-receive', async (req: Request, res: Response) => {
  const { receiveItems } = req.body;
  const alloc = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]) as any;
  if (!alloc) {
    return res.json({ code: 404, message: '调拨单不存在' });
  }
  if (alloc.status !== 'shipped' && alloc.status !== 'pending') {
    return res.json({ code: 400, message: '当前状态不可签收' });
  }
  if (!receiveItems || !Array.isArray(receiveItems)) {
    return res.json({ code: 400, message: '请录入签收明细' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const allocItems = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [req.params.id]) as any[];

  try {
    await transaction(async () => {
      for (const item of allocItems) {
        const receive = receiveItems.find((r: any) => r.id === item.id) || {};
        const shippedQty = item.quantity;
        const receivedQty = Number(receive.receivedQty ?? shippedQty);
        const lossQty = Number(receive.lossQty ?? 0);
        const pendingQty = Number(receive.pendingQty ?? 0);
        const diffQty = shippedQty - receivedQty - lossQty - pendingQty;
        const diffRemark = receive.diffRemark || '';

        if (receivedQty < 0 || lossQty < 0 || pendingQty < 0) {
          throw new Error(`商品「${item.productName}」数量不能为负数`);
        }
        if (receivedQty + lossQty + pendingQty > shippedQty) {
          throw new Error(`商品「${item.productName}」实收+报损+待复核总量超过发货量`);
        }

        await run(
          'UPDATE allocation_items SET receivedQty = ?, lossQty = ?, pendingQty = ?, diffQty = ?, diffRemark = ? WHERE id = ?',
          [receivedQty, lossQty, pendingQty, diffQty, diffRemark, item.id]
        );

        if (receivedQty > 0) {
          const listItem = await queryOne('SELECT * FROM expiry_list_items WHERE id = ?', [item.listItemId]) as any;
          const originalBatch = await queryOne('SELECT * FROM inventory_batches WHERE id = ?', [listItem.batchId]) as any;
          const newBatchId = generateId();
          await run(
            'INSERT INTO inventory_batches (id, productId, storeId, batchNo, quantity, productionDate, expiryDate, inboundDate, status, unitCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newBatchId, item.productId, alloc.targetStoreId, item.batchNo + '-T', receivedQty, originalBatch.productionDate, originalBatch.expiryDate, dayjs().format('YYYY-MM-DD'), 'normal', item.unitCost]
          );
        }

        const lossAmount = lossQty * item.unitCost;
        const signDiff = diffQty;
        const signDiffAmount = signDiff * item.unitCost;
        await run(
          'UPDATE batch_traces SET receivedQty = ?, lossQty = ?, pendingQty = ?, lossAmount = ?, signDiff = ?, signDiffAmount = ?, traceTime = ? WHERE allocationId = ? AND batchNo = ? AND productId = ?',
          [receivedQty, lossQty, pendingQty, lossAmount, signDiff, signDiffAmount, now, req.params.id, item.batchNo, item.productId]
        );
      }

      await run('UPDATE allocations SET status = ? WHERE id = ?', ['received', req.params.id]);
      await run('UPDATE vehicles SET status = ? WHERE id = ?', ['available', alloc.vehicleId]);
    });

    const updated = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.id]);
    res.json({ code: 0, data: updated });
  } catch (err: any) {
    res.json({ code: 400, message: err.message || '签收失败' });
  }
});

export default router;
