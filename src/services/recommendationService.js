/**
 * AI Recommendation Service
 * Handles smart cross-selling and personalized menu items
 */

/**
 * Generates smart recommendations based on current items in the cart
 * @param {Array} currentCartItems - Items currently in user's cart
 * @param {String} branchId - The active branch ID
 */
export const getMenuRecommendations = async (currentCartItems = [], branchId) => {
  try {
    // Agar cart khali hai, toh us branch ke standard best-sellers recommend karo
    if (currentCartItems.length === 0) {
      return {
        success: true,
        recommendationType: 'Popular Items',
        items: [
          { id: 'p1', name: 'Premium Cold Coffee', price: 120, category: 'Beverages' },
          { id: 'p2', name: 'Cheese Garlic Bread', price: 140, category: 'Sides' }
        ]
      };
    }

    // Check karo agar cart me heavy items (Pizza/Burger) hain
    const hasMainCourse = currentCartItems.some(item => 
      item.category?.toLowerCase() === 'pizza' || item.category?.toLowerCase() === 'burger'
    );

    if (hasMainCourse) {
      return {
        success: true,
        recommendationType: 'Pairs Well With',
        items: [
          { id: 's1', name: 'Peri Peri French Fries', price: 90, category: 'Sides' },
          { id: 's2', name: 'Mint Mojito', price: 110, category: 'Beverages' }
        ]
      };
    }

    // Default fallback: sweet cross-sell (Desserts)
    return {
      success: true,
      recommendationType: 'Chefs Special Dessert',
      items: [
        { id: 'd1', name: 'Chocolate Brownies with Ice Cream', price: 160, category: 'Desserts' }
      ]
    };

  } catch (error) {
    console.error('Error in getMenuRecommendations:', error.message);
    return {
      success: false,
      message: 'Failed to generate cart recommendations',
      error: error.message
    };
  }
};

/**
 * Generates personalized recommendations based on past customer history
 * @param {String} customerId - Unique customer ID
 * @param {String} branchId - The active branch ID
 */
export const getPersonalizedRecommendations = async (customerId, branchId) => {
  try {
    // Abhi ke liye temporary static personalized data (Baad me isme database fetch lagega)
    return {
      success: true,
      recommendationType: 'Based on Your Past Orders',
      items: [
        { id: 'rec1', name: 'Your Favorite Veg Cheese Burger', price: 150, category: 'Burger' },
        { id: 'rec2', name: 'Extra Cheese Slice Add-on', price: 30, category: 'Add-on' }
      ]
    };
  } catch (error) {
    console.error('Error in getPersonalizedRecommendations:', error.message);
    return {
      success: false,
      message: 'Failed to generate personalized recommendations',
      error: error.message
    };
  }
};

export default {
  getMenuRecommendations,
  getPersonalizedRecommendations
};
