import { Router, Request, Response } from 'express';
import { query, queryOne, run } from '../dbHelper';

const router = Router();

router.get('/stores', async (req: Request, res: Response) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM stores';
  const params: any[] = [];
  if (type) {
    sql += ' WHERE type = ?';
    params.push(type);
  }
  const stores = await query(sql, params);
  res.json({ code: 0, data: stores });
});

router.get('/users', async (req: Request, res: Response) => {
  const users = await query('SELECT id, username, name, role, storeId, storeName FROM users');
  res.json({ code: 0, data: users });
});

router.get('/products', async (req: Request, res: Response) => {
  const products = await query('SELECT * FROM products');
  res.json({ code: 0, data: products });
});

router.get('/vehicles', async (req: Request, res: Response) => {
  const { isColdChain, status } = req.query;
  let sql = 'SELECT * FROM vehicles WHERE 1=1';
  const params: any[] = [];
  if (isColdChain !== undefined) {
    sql += ' AND isColdChain = ?';
    params.push(isColdChain);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  const vehicles = await query(sql, params);
  res.json({ code: 0, data: vehicles });
});

router.get('/inventory', async (req: Request, res: Response) => {
  const { storeId, status, isExpiringOnly } = req.query;
  let sql = `
    SELECT b.*, p.name as productName, p.sku, p.category, p.isRefrigerated, p.unit, p.basePrice
    FROM inventory_batches b
    JOIN products p ON b.productId = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (storeId) {
    sql += ' AND b.storeId = ?';
    params.push(storeId);
  }
  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }
  if (isExpiringOnly === 'true') {
    sql += " AND b.status IN ('expiring', 'normal') AND julianday(b.expiryDate) - julianday('now') <= 30 AND julianday(b.expiryDate) - julianday('now') >= 0";
  }
  sql += ' ORDER BY b.expiryDate ASC';
  const batches = await query(sql, params);
  res.json({ code: 0, data: batches });
});

router.get('/inventory/:id', async (req: Request, res: Response) => {
  const batch = await queryOne(`
    SELECT b.*, p.name as productName, p.sku, p.category, p.isRefrigerated, p.unit, p.basePrice
    FROM inventory_batches b
    JOIN products p ON b.productId = p.id
    WHERE b.id = ?
  `, [req.params.id]);
  if (!batch) {
    return res.json({ code: 404, message: '批次不存在' });
  }
  res.json({ code: 0, data: batch });
});

export default router;
