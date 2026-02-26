import { Router } from 'express';

export const perdiemRouter = Router();

// GET /api/perdiem/rates — placeholder for Day 3
perdiemRouter.get('/rates', (_req, res) => {
  res.json({
    success: true,
    data: { message: 'Per diem rate lookup coming Day 3' },
  });
});
