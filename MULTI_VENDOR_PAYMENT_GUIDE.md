/**
 * Multi-Vendor SaaS Payment Integration Guide
 * =============================================
 * 
 * This document explains how the refactored payment system works
 * in a multi-vendor SaaS architecture.
 */

## Architecture Overview

### Previous (Single-Vendor) Setup
```
Single Stripe Account (process.env.STRIPE_SECRET_KEY)
          ↓
    All Orders → One Stripe Account
```

### New (Multi-Vendor SaaS) Setup
```
Owner/Vendor 1 → Stripe Account 1
Owner/Vendor 2 → Stripe Account 2
Owner/Vendor 3 → Stripe Account 3
          ↓
Each Order → Correct Vendor's Stripe Account
```

---

## Database Schema

### Owners Table
```sql
CREATE TABLE owners (
  id VARCHAR(36) PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  stripe_secret_key VARCHAR(255) UNIQUE,
  stripe_public_key VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key Changes

### 1. **Extract `owner_id` from Request**
- `owner_id` is now **required** in the request body
- Used to identify which vendor's Stripe account to use

### 2. **Database Query**
- Function: `getOwnerStripeConfig(owner_id)`
- Fetches owner's `stripe_secret_key` from database
- Validates owner exists and has Stripe configured

### 3. **Dynamic Stripe Initialization**
```javascript
const stripe = new Stripe(owner.stripe_secret_key);
```
- Instead of using global instance
- Each request gets owner's specific Stripe instance

### 4. **Error Handling**
- **400 Error**: Owner not found
- **400 Error**: "Payment is not set up by this vendor"
- **500 Error**: Database/Stripe connection issues

---

## API Usage Examples

### Example 1: Create Checkout Session (Multi-Vendor)

**Request:**
```bash
POST /api/payment/checkout
Content-Type: application/json

{
  "cartItems": [
    {
      "id": "item_1",
      "name": "Margherita Pizza",
      "price": 300,
      "quantity": 2,
      "description": "Classic pizza",
      "image": "https://..."
    }
  ],
  "branchId": "branch_xyz",
  "owner_id": "vendor_123"  ← NEW: Owner's Stripe Account
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Checkout session created successfully",
  "sessionUrl": "https://checkout.stripe.com/pay/cs_...",
  "sessionId": "cs_test_...",
  "ownerId": "vendor_123"
}
```

**Response (Payment Not Set Up):**
```json
{
  "success": false,
  "message": "Payment is not set up by this vendor"
}
```

---

### Example 2: Get Session Details (Multi-Vendor)

**Request:**
```bash
POST /api/payment/session/cs_test_abc123
Content-Type: application/json

{
  "owner_id": "vendor_123"  ← Required to access correct Stripe account
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "cs_test_abc123",
    "paymentStatus": "paid",
    "customerEmail": "customer@example.com",
    "branchId": "branch_xyz",
    "ownerId": "vendor_123",
    "totalAmount": 600
  }
}
```

---

## Frontend Integration

### Update apiService.js for Multi-Vendor

```javascript
// Add ownerId to checkout function
export const initiateCheckout = async (cartItems, branchId, ownerId) => {
  const response = await fetch('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems,
      branchId,
      owner_id: ownerId  ← Include owner_id
    })
  });
  // ... rest of code
};

// Usage:
await initiateCheckout(cart, 'branch_001', 'vendor_123');
```

---

## Database Setup

### 1. Create Owners Table
```sql
CREATE TABLE owners (
  id VARCHAR(36) PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  stripe_secret_key VARCHAR(255) UNIQUE NOT NULL,
  stripe_public_key VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  country VARCHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stripe_key (stripe_secret_key)
);
```

### 2. Insert Sample Owner
```sql
INSERT INTO owners (id, business_name, stripe_secret_key, stripe_public_key, email)
VALUES (
  'vendor_123',
  'Pizza Palace',
  'sk_test_4eC39HqLyjWDarhu5mpg5',
  'pk_test_4eC39HqLyjWDarhu5mpg',
  'owner@pizzapalace.com'
);
```

### 3. Update Branch Table (Link to Owner)
```sql
ALTER TABLE branches ADD COLUMN owner_id VARCHAR(36);
ALTER TABLE branches ADD FOREIGN KEY (owner_id) REFERENCES owners(id);
```

---

## Security Considerations

### ✅ Best Practices Implemented

1. **Stripe Secret Keys Stored in Database**
   - Never expose in code
   - Retrieved only when needed
   - Access controlled per vendor

2. **Owner Validation**
   - Verify owner exists before using Stripe key
   - Prevent unauthorized access to other vendors' accounts

3. **Metadata Isolation**
   - Each session stores `ownerId` in metadata
   - Prevents cross-vendor session access

### 🔒 Additional Security (Recommended)

```javascript
// Add authentication middleware
const authMiddleware = (req, res, next) => {
  const userId = req.user?.id;
  const requestedOwnerId = req.body.owner_id;
  
  // Verify user owns this vendor account
  if (userId !== requestedOwnerId) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access to this vendor account'
    });
  }
  
  next();
};

// Use in routes
router.post('/checkout', authMiddleware, createCheckoutSession);
```

---

## Error Scenarios

| Scenario | Status | Message |
|----------|--------|---------|
| Owner not found | 400 | "Vendor not found" |
| No Stripe key configured | 400 | "Payment is not set up by this vendor" |
| Invalid cart items | 400 | "Cart items are required..." |
| Missing owner_id | 400 | "Owner ID is required" |
| Stripe API error | 500 | "Failed to create checkout session" |

---

## Migration Checklist

- [ ] Create `owners` table in database
- [ ] Migrate existing Stripe key to owner record
- [ ] Update all payment routes to require `owner_id`
- [ ] Update frontend API service with `ownerId` parameter
- [ ] Test with multiple owner accounts
- [ ] Add authentication middleware for security
- [ ] Update database config import in paymentController
- [ ] Test error scenarios (missing owner, no Stripe key)

---

## Code Example: Full Request Flow

```javascript
// Frontend - React
const handleCheckout = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/payment/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartItems: [
          { id: '1', name: 'Pizza', price: 300, quantity: 1 }
        ],
        branchId: 'branch_001',
        owner_id: 'vendor_123'  // Multi-vendor key
      })
    });
    
    const data = await response.json();
    if (data.success) {
      window.location.href = data.sessionUrl;
    }
  } catch (error) {
    console.error('Checkout failed:', error);
  }
};
```

```javascript
// Backend - paymentController.js
export const createCheckoutSession = async (req, res) => {
  const { owner_id, cartItems, branchId } = req.body;
  
  // 1. Get owner's Stripe key from database
  const ownerData = await getOwnerStripeConfig(owner_id);
  
  // 2. Initialize Stripe with owner's key
  const stripe = new Stripe(ownerData.stripe_secret_key);
  
  // 3. Create session on owner's Stripe account
  const session = await stripe.checkout.sessions.create({
    // ... session config
  });
  
  // 4. Return checkout URL
  return res.json({ sessionUrl: session.url });
};
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** "Payment is not set up by this vendor"
- **Solution:** Ensure owner has `stripe_secret_key` in database

**Issue:** Different sessions creating on different Stripe accounts
- **Solution:** Verify each request includes correct `owner_id`

**Issue:** 500 error when creating checkout
- **Solution:** Check database connection and owner record exists

---

## Next Steps

1. Update database with owner table
2. Refactor frontend API service
3. Add authentication middleware
4. Test with multiple vendor accounts
5. Document in team wiki
6. Deploy to staging environment

