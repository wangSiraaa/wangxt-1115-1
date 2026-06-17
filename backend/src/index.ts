import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import { seed } from './data/seed';
import baseRoutes from './routes/base';
import expiryListRoutes from './routes/expiryList';
import allocationRoutes from './routes/allocation';
import settlementRoutes from './routes/settlement';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.use('/api/base', baseRoutes);
app.use('/api/expiry-lists', expiryListRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/settlements', settlementRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ code: 500, message: '服务器内部错误', error: err.message });
});

async function start() {
  await initDatabase();
  await seed();
  app.listen(PORT, () => {
    console.log(`临期商品调拨系统后端服务已启动: http://localhost:${PORT}`);
  });
}

start().catch(err => console.error('启动失败:', err));
