import Stripe from 'stripe';
import db from '../config/database.js'; // Assuming you have a database connection module

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Fetches owner's Stripe configuration from database
 * @param {String} ownerId - Owner/Vendor ID
 * @returns {Promise<Object>} Owner's stripe configuration
 * @throws {Error} If owner not found or stripe not configured
 */
const getOwnerStripeConfig = async (ownerId) => {
  try {
    // Fetch owner from database
    const owner = await db.query(
      'SELECT id, stripe_secret_key, stripe_public_key, business_name FROM owners WHERE id = ?',
      [ownerId]
    );

    // Check if owner exists
    if (!owner || owner.length === 0) {
      throw new Error('Vendor not found');
    }

    const ownerData = owner[0];

    // Check if stripe_secret_key is configured
    if (!ownerData.stripe_secret_key) {
      throw new Error('Payment is not set up by this vendor');
    }

    return ownerData;
  } catch (error) {
    console.error('Error fetching owner stripe config:', error.message);
    throw error;
  }
};

/**
 * Creates a dynamic Stripe instance for the specific owner
 * @param {String} stripeSecretKey - Owner's Stripe secret key
 * @returns {Stripe} Stripe instance
 */
const initializeStripeForOwner = (stripeSecretKey) => {
  return new Stripe(stripeSecretKey);
};

/**
 * Creates a Stripe checkout session for restaurant orders
 * Multi-vendor SaaS compatible - dynamically uses owner's Stripe account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { cartItems, branchId, owner_id } = req.body;

    // Validation: owner_id is required
    if (!owner_id) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID is required'
      });
    }

    // Validation: cart items
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart items are required and must be a non-empty array'
      });
    }

    // Validation: branch ID
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }

    // Fetch owner's Stripe configuration from database
    let ownerData;
    try {
      ownerData = await getOwnerStripeConfig(owner_id);
    } catch (error) {
      // Return 400 if owner not found or payment not set up
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Dynamically initialize Stripe instance with owner's secret key
    const stripe = initializeStripeForOwner(ownerData.stripe_secret_key);

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
              branchId: branchId.toString(),
              ownerId: owner_id.toString()
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
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&owner_id=${owner_id}`,
      cancel_url: `${FRONTEND_URL}/payment/cancelled?owner_id=${owner_id}`,
      metadata: {
        branchId: branchId.toString(),
        ownerId: owner_id.toString(),
        businessName: ownerData.business_name || 'Restaurant',
        orderTimestamp: new Date().toISOString()
      },
      customer_email_collection: 'required',
      locale: 'auto'
    });

    return res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      sessionUrl: session.url,
      sessionId: session.id,
      ownerId: owner_id
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

    if (error.message.includes('Payment is not set up')) {
      return res.status(400).json({
        success: false,
        message: error.message
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
 * Multi-vendor SaaS compatible - uses owner's Stripe instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { owner_id } = req.body;

    // Validation
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    if (!owner_id) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID is required'
      });
    }

    // Fetch owner's Stripe configuration from database
    let ownerData;
    try {
      ownerData = await getOwnerStripeConfig(owner_id);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Dynamically initialize Stripe instance with owner's secret key
    const stripe = initializeStripeForOwner(ownerData.stripe_secret_key);

    // Retrieve session from owner's Stripe account
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email,
        branchId: session.metadata.branchId,
        ownerId: session.metadata.ownerId,
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
