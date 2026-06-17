import { Router, Request, Response } from 'express';
import { query, queryOne, run, transaction } from '../dbHelper';
import { generateId, generateNo } from '../utils';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { allocationId, status } = req.query;
  let sql = 'SELECT * FROM settlements WHERE 1=1';
  const params: any[] = [];
  if (allocationId) {
    sql += ' AND allocationId = ?';
    params.push(allocationId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY settleTime DESC';
  const settlements = await query(sql, params);
  res.json({ code: 0, data: settlements });
});

router.get('/:id', async (req: Request, res: Response) => {
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  const allocation = await queryOne('SELECT * FROM allocations WHERE id = ?', [settlement.allocationId]);
  const allocItems = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [settlement.allocationId]);
  let sourceStore = null;
  let targetStore = null;
  if (allocation) {
    sourceStore = await queryOne('SELECT * FROM stores WHERE id = ?', [(allocation as any).sourceStoreId]);
    targetStore = await queryOne('SELECT * FROM stores WHERE id = ?', [(allocation as any).targetStoreId]);
  }
  res.json({ code: 0, data: { ...settlement, allocation, allocItems, sourceStore, targetStore } });
});

router.post('/', async (req: Request, res: Response) => {
  const { allocationId, totalCost, discountAmount, lossAmount, finalAmount, lossRate, accountantId, accountantName, remark } = req.body;

  if (!allocationId) {
    return res.json({ code: 400, message: '参数不完整' });
  }

  const existing = await queryOne('SELECT * FROM settlements WHERE allocationId = ?', [allocationId]);
  if (existing) {
    return res.json({ code: 400, message: '该调拨单已存在结算单' });
  }

  const allocation = await queryOne('SELECT * FROM allocations WHERE id = ?', [allocationId]) as any;
  if (!allocation) {
    return res.json({ code: 404, message: '调拨单不存在' });
  }

  const id = generateId();
  const settleNo = generateNo('ST');

  await run(
    'INSERT INTO settlements (id, settleNo, allocationId, totalCost, discountAmount, lossAmount, finalAmount, lossRate, accountantId, accountantName, settleTime, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, settleNo, allocationId, totalCost || 0, discountAmount || 0, lossAmount || 0, finalAmount || 0, lossRate || 0, accountantId, accountantName, dayjs().format('YYYY-MM-DD HH:mm:ss'), 'draft', remark]
  );

  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [id]);
  res.json({ code: 0, data: settlement });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { totalCost, discountAmount, lossAmount, finalAmount, lossRate, remark } = req.body;
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  if (settlement.status === 'confirmed') {
    return res.json({ code: 400, message: '结算已确认，损耗金额不可修改' });
  }

  await run(
    'UPDATE settlements SET totalCost = ?, discountAmount = ?, lossAmount = ?, finalAmount = ?, lossRate = ?, remark = ? WHERE id = ?',
    [
      totalCost ?? settlement.totalCost,
      discountAmount ?? settlement.discountAmount,
      lossAmount ?? settlement.lossAmount,
      finalAmount ?? settlement.finalAmount,
      lossRate ?? settlement.lossRate,
      remark ?? settlement.remark,
      req.params.id
    ]
  );

  const updated = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: updated });
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  if (settlement.status === 'confirmed') {
    return res.json({ code: 400, message: '结算已确认' });
  }

  await transaction(async () => {
    await run('UPDATE settlements SET status = ?, settleTime = ? WHERE id = ?', [
      'confirmed',
      dayjs().format('YYYY-MM-DD HH:mm:ss'),
      req.params.id
    ]);
    await run('UPDATE allocations SET status = ? WHERE id = ?', ['settled', settlement.allocationId]);
  });

  const updated = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: updated });
});

export default router;
