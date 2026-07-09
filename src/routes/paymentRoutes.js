import express from 'express';
import { createCheckoutSession, getSessionDetails } from '../controllers/paymentController.js';

const router = express.Router();

/**
 * POST /api/payment/checkout
 * Create a new Stripe checkout session
 */
router.post('/checkout', createCheckoutSession);

/**
 * GET /api/payment/session/:sessionId
 * Retrieve details of a specific payment session
 */
router.get('/session/:sessionId', getSessionDetails);

export default router;
