import { Router, Request, Response } from 'express';
import { query, queryOne, run, transaction } from '../dbHelper';
import { generateId, generateNo, calcExpiryDays, isExpired } from '../utils';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { storeId, status } = req.query;
  let sql = 'SELECT * FROM expiry_lists WHERE 1=1';
  const params: any[] = [];
  if (storeId) {
    sql += ' AND storeId = ?';
    params.push(storeId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY submitTime DESC';
  const lists = await query(sql, params);
  res.json({ code: 0, data: lists });
});

router.get('/:id', async (req: Request, res: Response) => {
  const list = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [req.params.id]);
  if (!list) {
    return res.json({ code: 404, message: '清单不存在' });
  }
  const items = await query('SELECT * FROM expiry_list_items WHERE listId = ?', [req.params.id]);
  res.json({ code: 0, data: { ...list, items } });
});

router.post('/', async (req: Request, res: Response) => {
  const { storeId, submitterId, submitterName, remark, items } = req.body;

  if (!storeId || !items || items.length === 0) {
    return res.json({ code: 400, message: '参数不完整' });
  }

  const validItems: any[] = [];
  for (const item of items) {
    const batch = await queryOne('SELECT * FROM inventory_batches WHERE id = ?', [item.batchId]) as any;
    if (!batch) continue;
    if (isExpired(batch.expiryDate)) continue;
    const product = await queryOne('SELECT * FROM products WHERE id = ?', [batch.productId]) as any;
    validItems.push({
      batchId: item.batchId,
      productId: batch.productId,
      productName: product?.name,
      sku: product?.sku,
      batchNo: batch.batchNo,
      quantity: Math.min(item.quantity, batch.quantity),
      productionDate: batch.productionDate,
      expiryDate: batch.expiryDate,
      expiryDays: calcExpiryDays(batch.expiryDate),
      isRefrigerated: product?.isRefrigerated || 0,
      unitCost: batch.unitCost,
      basePrice: product?.basePrice || 0,
    });
  }

  if (validItems.length === 0) {
    return res.json({ code: 400, message: '没有有效的商品（已过滤过期商品）' });
  }

  const id = generateId();
  const listNo = generateNo('EL');
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  await transaction(async () => {
    await run(
      'INSERT INTO expiry_lists (id, listNo, storeId, submitterId, submitterName, submitTime, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, listNo, storeId, submitterId, submitterName, now, 'draft', remark]
    );
    for (const item of validItems) {
      await run(
        'INSERT INTO expiry_list_items (id, listId, batchId, productId, productName, sku, batchNo, quantity, productionDate, expiryDate, expiryDays, isRefrigerated, unitCost, basePrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), id, item.batchId, item.productId, item.productName, item.sku, item.batchNo, item.quantity, item.productionDate, item.expiryDate, item.expiryDays, item.isRefrigerated, item.unitCost, item.basePrice]
      );
    }
  });

  const list = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [id]);
  res.json({ code: 0, data: list });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { items, remark } = req.body;
  const list = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [req.params.id]) as any;
  if (!list) {
    return res.json({ code: 404, message: '清单不存在' });
  }
  if (list.status !== 'draft') {
    return res.json({ code: 400, message: '只能编辑草稿状态的清单' });
  }

  if (items) {
    const validItems: any[] = [];
    for (const item of items) {
      const batch = await queryOne('SELECT * FROM inventory_batches WHERE id = ?', [item.batchId]) as any;
      if (!batch) continue;
      if (isExpired(batch.expiryDate)) continue;
      const product = await queryOne('SELECT * FROM products WHERE id = ?', [batch.productId]) as any;
      validItems.push({
        batchId: item.batchId,
        productId: batch.productId,
        productName: product?.name,
        sku: product?.sku,
        batchNo: batch.batchNo,
        quantity: Math.min(item.quantity, batch.quantity),
        productionDate: batch.productionDate,
        expiryDate: batch.expiryDate,
        expiryDays: calcExpiryDays(batch.expiryDate),
        isRefrigerated: product?.isRefrigerated || 0,
        unitCost: batch.unitCost,
        basePrice: product?.basePrice || 0,
      });
    }

    await transaction(async () => {
      await run('DELETE FROM expiry_list_items WHERE listId = ?', [req.params.id]);
      for (const item of validItems) {
        await run(
          'INSERT INTO expiry_list_items (id, listId, batchId, productId, productName, sku, batchNo, quantity, productionDate, expiryDate, expiryDays, isRefrigerated, unitCost, basePrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [generateId(), req.params.id, item.batchId, item.productId, item.productName, item.sku, item.batchNo, item.quantity, item.productionDate, item.expiryDate, item.expiryDays, item.isRefrigerated, item.unitCost, item.basePrice]
        );
      }
      if (remark !== undefined) {
        await run('UPDATE expiry_lists SET remark = ? WHERE id = ?', [remark, req.params.id]);
      }
    });
  }

  const updated = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: updated });
});

router.post('/:id/submit', async (req: Request, res: Response) => {
  const list = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [req.params.id]) as any;
  if (!list) {
    return res.json({ code: 404, message: '清单不存在' });
  }
  if (list.status !== 'draft') {
    return res.json({ code: 400, message: '只能提交草稿状态的清单' });
  }
  const items = await query('SELECT * FROM expiry_list_items WHERE listId = ?', [req.params.id]);
  if (items.length === 0) {
    return res.json({ code: 400, message: '清单没有商品' });
  }
  await run('UPDATE expiry_lists SET status = ? WHERE id = ?', ['submitted', req.params.id]);
  const updated = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: updated });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const list = await queryOne('SELECT * FROM expiry_lists WHERE id = ?', [req.params.id]) as any;
  if (!list) {
    return res.json({ code: 404, message: '清单不存在' });
  }
  if (list.status !== 'draft') {
    return res.json({ code: 400, message: '只能删除草稿状态的清单' });
  }
  await transaction(async () => {
    await run('DELETE FROM expiry_list_items WHERE listId = ?', [req.params.id]);
    await run('DELETE FROM expiry_lists WHERE id = ?', [req.params.id]);
  });
  res.json({ code: 0, message: '删除成功' });
});

export default router;
