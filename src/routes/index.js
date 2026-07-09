/**
 * API Routes Index
 * Central route aggregator for all API endpoints
 */

import express from 'express';
import paymentRoutes from './paymentRoutes.js';
import menuRoutes from './menuRoutes.js';

const router = express.Router();

/**
 * Mount all route modules
 */
router.use('/payment', paymentRoutes);
router.use('/menu', menuRoutes);

/**
 * API welcome endpoint
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Restaurant API',
    version: '1.0.0',
    endpoints: {
      payment: '/api/payment',
      menu: '/api/menu'
    }
  });
});

export default router;
