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

router.get('/trace/:allocationId', async (req: Request, res: Response) => {
  const traces = await query('SELECT * FROM batch_traces WHERE allocationId = ? ORDER BY traceTime DESC', [req.params.allocationId]);
  const allocation = await queryOne('SELECT * FROM allocations WHERE id = ?', [req.params.allocationId]);
  res.json({ code: 0, data: { traces, allocation } });
});

router.get('/:id', async (req: Request, res: Response) => {
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  const allocation = await queryOne('SELECT * FROM allocations WHERE id = ?', [settlement.allocationId]);
  const allocItems = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [settlement.allocationId]);
  const segments = await query('SELECT * FROM settle_segments WHERE settlementId = ? ORDER BY segmentType, productName', [req.params.id]);
  const traces = await query('SELECT * FROM batch_traces WHERE allocationId = ? ORDER BY traceTime DESC', [settlement.allocationId]);
  let sourceStore = null;
  let targetStore = null;
  if (allocation) {
    sourceStore = await queryOne('SELECT * FROM stores WHERE id = ?', [(allocation as any).sourceStoreId]);
    targetStore = await queryOne('SELECT * FROM stores WHERE id = ?', [(allocation as any).targetStoreId]);
  }
  res.json({ code: 0, data: { ...settlement, allocation, allocItems, segments, traces, sourceStore, targetStore } });
});

router.post('/', async (req: Request, res: Response) => {
  const { allocationId, accountantId, accountantName, remark, manualSegments, discountAmount } = req.body;

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
  if (allocation.status !== 'received') {
    return res.json({ code: 400, message: '调拨单尚未完成签收，无法结算' });
  }

  const allocItems = await query('SELECT * FROM allocation_items WHERE allocationId = ?', [allocationId]) as any[];

  let totalCost = 0;
  let sellableAmount = 0;
  let lossAmount = 0;
  let pendingAmount = 0;
  const segments: any[] = [];

  if (manualSegments && Array.isArray(manualSegments) && manualSegments.length > 0) {
    for (const seg of manualSegments) {
      const item = allocItems.find((i: any) => i.id === seg.allocationItemId);
      if (!item) continue;
      const unitCost = item.unitCost;
      const unitPrice = seg.unitPrice ?? item.basePrice;
      const qty = Number(seg.quantity ?? 0);
      const amount = seg.amount ?? Number((qty * unitPrice).toFixed(2));
      totalCost += qty * unitCost;
      if (seg.segmentType === 'sellable') sellableAmount += amount;
      else if (seg.segmentType === 'loss') lossAmount += amount;
      else if (seg.segmentType === 'pending_review') pendingAmount += amount;
      segments.push({
        ...seg,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        batchNo: item.batchNo,
        unitCost,
        unitPrice,
        amount,
        segmentAmount: amount,
        reviewStatus: seg.segmentType === 'pending_review' ? (seg.reviewStatus || 'pending') : 'approved',
      });
    }
  } else {
    for (const item of allocItems) {
      const shippedQty = item.quantity;
      const receivedQty = item.receivedQty;
      const lossQty = item.lossQty;
      const pendingQty = item.pendingQty;
      const diffQty = item.diffQty;

      if (receivedQty > 0) {
        const qty = receivedQty;
        const unitCost = item.unitCost;
        const unitPrice = item.basePrice;
        const amount = Number((qty * unitPrice).toFixed(2));
        sellableAmount += amount;
        totalCost += qty * unitCost;
        segments.push({
          allocationItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          batchNo: item.batchNo,
          segmentType: 'sellable',
          quantity: qty,
          unitCost,
          unitPrice,
          amount,
          reviewStatus: 'approved',
        });
      }

      if (lossQty > 0) {
        const qty = lossQty;
        const unitCost = item.unitCost;
        const unitPrice = 0;
        const amount = Number((qty * unitCost).toFixed(2));
        lossAmount += amount;
        totalCost += qty * unitCost;
        segments.push({
          allocationItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          batchNo: item.batchNo,
          segmentType: 'loss',
          quantity: qty,
          unitCost,
          unitPrice,
          amount,
          reviewStatus: 'approved',
        });
      }

      if (pendingQty > 0 || diffQty > 0) {
        const qty = pendingQty + Math.max(0, diffQty);
        const unitCost = item.unitCost;
        const unitPrice = item.basePrice;
        const amount = Number((qty * unitCost).toFixed(2));
        pendingAmount += amount;
        totalCost += qty * unitCost;
        segments.push({
          allocationItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          batchNo: item.batchNo,
          segmentType: 'pending_review',
          quantity: qty,
          unitCost,
          unitPrice,
          amount,
          reviewStatus: 'pending',
        });
      }
    }
  }

  totalCost = Number(totalCost.toFixed(2));
  sellableAmount = Number(sellableAmount.toFixed(2));
  lossAmount = Number(lossAmount.toFixed(2));
  pendingAmount = Number(pendingAmount.toFixed(2));
  const actualDiscount = Number(discountAmount ?? 0);
  const finalAmount = Number((sellableAmount - actualDiscount + pendingAmount).toFixed(2));
  const lossRate = totalCost > 0 ? Number(((lossAmount / totalCost) * 100).toFixed(2)) : 0;

  const id = generateId();
  const settleNo = generateNo('ST');

  await transaction(async () => {
    await run(
      'INSERT INTO settlements (id, settleNo, allocationId, totalCost, discountAmount, lossAmount, finalAmount, lossRate, sellableAmount, pendingAmount, lossLocked, accountantId, accountantName, settleTime, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, settleNo, allocationId, totalCost, actualDiscount, lossAmount, finalAmount, lossRate, sellableAmount, pendingAmount, 0, accountantId, accountantName, dayjs().format('YYYY-MM-DD HH:mm:ss'), 'draft', remark || '']
    );

    for (const seg of segments) {
      await run(
        'INSERT INTO settle_segments (id, settlementId, allocationItemId, productId, productName, sku, batchNo, segmentType, quantity, unitCost, amount, segmentAmount, unitPrice, reviewStatus, reviewerId, reviewerName, reviewTime, reviewRemark, remark, responsibleParty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          generateId(), id, seg.allocationItemId, seg.productId, seg.productName, seg.sku, seg.batchNo,
          seg.segmentType, seg.quantity, seg.unitCost, seg.amount, seg.segmentAmount ?? seg.amount, seg.unitPrice,
          seg.reviewStatus, seg.reviewerId || null, seg.reviewerName || null, seg.reviewTime || null, seg.reviewRemark || '',
          seg.remark || '', seg.responsibleParty || ''
        ]
      );
    }
  });

  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [id]);
  const createdSegments = await query('SELECT * FROM settle_segments WHERE settlementId = ?', [id]);
  res.json({ code: 0, data: { ...settlement, segments: createdSegments } });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { segments, remark, discountAmount } = req.body;
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  if (settlement.status === 'confirmed') {
    return res.json({ code: 400, message: '结算已确认，损耗金额已锁定不可修改' });
  }

  await transaction(async () => {
    if (segments && Array.isArray(segments)) {
      await run('DELETE FROM settle_segments WHERE settlementId = ?', [req.params.id]);

      let sellableAmount = 0;
      let lossAmount = 0;
      let pendingAmount = 0;
      let totalCost = 0;

      for (const seg of segments) {
        const qty = Number(seg.quantity ?? 0);
        const unitCost = Number(seg.unitCost ?? 0);
        const amount = Number(seg.amount ?? (qty * Number(seg.unitPrice ?? 0)).toFixed(2));
        totalCost += qty * unitCost;
        if (seg.segmentType === 'sellable') sellableAmount += amount;
        else if (seg.segmentType === 'loss') lossAmount += amount;
        else if (seg.segmentType === 'pending_review') pendingAmount += amount;

        await run(
          'INSERT INTO settle_segments (id, settlementId, allocationItemId, productId, productName, sku, batchNo, segmentType, quantity, unitCost, amount, segmentAmount, unitPrice, reviewStatus, reviewerId, reviewerName, reviewTime, reviewRemark, remark, responsibleParty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            generateId(), req.params.id, seg.allocationItemId, seg.productId, seg.productName, seg.sku, seg.batchNo,
            seg.segmentType, qty, unitCost, amount, seg.segmentAmount ?? amount, seg.unitPrice ?? 0,
            seg.reviewStatus || (seg.segmentType === 'pending_review' ? 'pending' : 'approved'),
            seg.reviewerId || null, seg.reviewerName || null, seg.reviewTime || null, seg.reviewRemark || '',
            seg.remark || '', seg.responsibleParty || ''
          ]
        );
      }

      totalCost = Number(totalCost.toFixed(2));
      sellableAmount = Number(sellableAmount.toFixed(2));
      lossAmount = Number(lossAmount.toFixed(2));
      pendingAmount = Number(pendingAmount.toFixed(2));
      const actualDiscount = Number(discountAmount ?? settlement.discountAmount ?? 0);
      const finalAmount = Number((sellableAmount - actualDiscount + pendingAmount).toFixed(2));
      const lossRate = totalCost > 0 ? Number(((lossAmount / totalCost) * 100).toFixed(2)) : 0;

      await run(
        'UPDATE settlements SET totalCost = ?, discountAmount = ?, lossAmount = ?, finalAmount = ?, lossRate = ?, sellableAmount = ?, pendingAmount = ?, remark = ? WHERE id = ?',
        [totalCost, actualDiscount, lossAmount, finalAmount, lossRate, sellableAmount, pendingAmount, remark ?? settlement.remark, req.params.id]
      );
    } else {
      if (discountAmount !== undefined && discountAmount !== null) {
        const finalAmount = Number(((settlement.sellableAmount ?? 0) - Number(discountAmount) + (settlement.pendingAmount ?? 0)).toFixed(2));
        await run(
          'UPDATE settlements SET discountAmount = ?, finalAmount = ?, remark = ? WHERE id = ?',
          [Number(discountAmount), finalAmount, remark ?? settlement.remark, req.params.id]
        );
      } else if (remark !== undefined) {
        await run('UPDATE settlements SET remark = ? WHERE id = ?', [remark, req.params.id]);
      }
    }
  });

  const updated = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]);
  const updatedSegments = await query('SELECT * FROM settle_segments WHERE settlementId = ?', [req.params.id]);
  res.json({ code: 0, data: { ...updated, segments: updatedSegments } });
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  if (settlement.status === 'confirmed') {
    return res.json({ code: 400, message: '结算已确认' });
  }

  const pendingSegments = await query('SELECT * FROM settle_segments WHERE settlementId = ? AND segmentType = ? AND reviewStatus = ?', [req.params.id, 'pending_review', 'pending']);
  if (pendingSegments.length > 0) {
    return res.json({ code: 400, message: `存在${pendingSegments.length}条待复核记录未审批，请先完成复核` });
  }

  await transaction(async () => {
    await run('UPDATE settlements SET status = ?, settleTime = ?, lossLocked = ? WHERE id = ?', [
      'confirmed',
      dayjs().format('YYYY-MM-DD HH:mm:ss'),
      1,
      req.params.id
    ]);
    await run('UPDATE allocations SET status = ? WHERE id = ?', ['settled', settlement.allocationId]);
    await run('UPDATE batch_traces SET locked = ? WHERE allocationId = ?', [1, settlement.allocationId]);
  });

  const updated = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]);
  const segments = await query('SELECT * FROM settle_segments WHERE settlementId = ?', [req.params.id]);
  res.json({ code: 0, data: { ...updated, segments } });
});

router.post('/:id/review-segment', async (req: Request, res: Response) => {
  const { segmentId, reviewStatus, reviewerId, reviewerName, reviewRemark, convertTo } = req.body;
  const settlement = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]) as any;
  if (!settlement) {
    return res.json({ code: 404, message: '结算单不存在' });
  }
  if (settlement.status === 'confirmed') {
    return res.json({ code: 400, message: '结算已确认，不可再修改分段' });
  }
  const segment = await queryOne('SELECT * FROM settle_segments WHERE id = ? AND settlementId = ?', [segmentId, req.params.id]) as any;
  if (!segment) {
    return res.json({ code: 404, message: '分段记录不存在' });
  }
  if (segment.segmentType !== 'pending_review') {
    return res.json({ code: 400, message: '仅待复核分段可审批' });
  }
  if (!['approved', 'rejected'].includes(reviewStatus)) {
    return res.json({ code: 400, message: '无效的审批状态' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  await transaction(async () => {
    let newType = segment.segmentType;
    if (reviewStatus === 'approved' && convertTo) {
      newType = convertTo;
    } else if (reviewStatus === 'rejected') {
      newType = 'loss';
    }

    await run(
      'UPDATE settle_segments SET segmentType = ?, reviewStatus = ?, reviewerId = ?, reviewerName = ?, reviewTime = ?, reviewRemark = ? WHERE id = ?',
      [newType, reviewStatus, reviewerId || null, reviewerName || null, now, reviewRemark || '', segmentId]
    );

    const segs = await query('SELECT * FROM settle_segments WHERE settlementId = ?', [req.params.id]) as any[];
    let sellableAmount = 0;
    let lossAmount = 0;
    let pendingAmount = 0;
    let totalCost = 0;
    for (const s of segs) {
      totalCost += Number(s.quantity) * Number(s.unitCost);
      if (s.segmentType === 'sellable') sellableAmount += Number(s.amount);
      else if (s.segmentType === 'loss') lossAmount += Number(s.amount);
      else if (s.segmentType === 'pending_review') pendingAmount += Number(s.amount);
    }
    totalCost = Number(totalCost.toFixed(2));
    sellableAmount = Number(sellableAmount.toFixed(2));
    lossAmount = Number(lossAmount.toFixed(2));
    pendingAmount = Number(pendingAmount.toFixed(2));
    const finalAmount = Number((sellableAmount - Number(settlement.discountAmount || 0) + pendingAmount).toFixed(2));
    const lossRate = totalCost > 0 ? Number(((lossAmount / totalCost) * 100).toFixed(2)) : 0;

    await run(
      'UPDATE settlements SET totalCost = ?, lossAmount = ?, finalAmount = ?, lossRate = ?, sellableAmount = ?, pendingAmount = ? WHERE id = ?',
      [totalCost, lossAmount, finalAmount, lossRate, sellableAmount, pendingAmount, req.params.id]
    );
  });

  const updated = await queryOne('SELECT * FROM settlements WHERE id = ?', [req.params.id]);
  const segments = await query('SELECT * FROM settle_segments WHERE settlementId = ?', [req.params.id]);
  res.json({ code: 0, data: { ...updated, segments } });
});

export default router;
