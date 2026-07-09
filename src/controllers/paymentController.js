import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Creates a Stripe checkout session for restaurant orders
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { cartItems, branchId } = req.body;

    // Validation
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart items are required and must be a non-empty array'
      });
    }

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Map cart items to Stripe line_items format
    const line_items = cartItems.map((item) => {
      if (!item.name || !item.price || !item.quantity) {
        throw new Error('Each cart item must have name, price, and quantity');
      }

      return {
        price_data: {
          currency: 'inr',
          product_data: {
            name: item.name,
            description: item.description || '',
            images: item.image ? [item.image] : [],
            metadata: {
              itemId: item.id || '',
              branchId: branchId.toString()
            }
          },
          unit_amount: Math.round(item.price * 100) // Convert to paise
        },
        quantity: item.quantity
      };
    });

    // Create checkout session with metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/payment/cancelled`,
      metadata: {
        branchId: branchId.toString(),
        orderTimestamp: new Date().toISOString()
      },
      customer_email_collection: 'required',
      locale: 'auto'
    });

    return res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      sessionUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Stripe checkout session creation error:', error.message);

    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return res.status(402).json({
        success: false,
        message: 'Card error: ' + error.message
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request to Stripe: ' + error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Retrieves session details from Stripe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email,
        branchId: session.metadata.branchId,
        totalAmount: session.amount_total / 100 // Convert back to INR
      }
    });
  } catch (error) {
    console.error('Error retrieving session details:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve session details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export default {
  createCheckoutSession,
  getSessionDetails
};
