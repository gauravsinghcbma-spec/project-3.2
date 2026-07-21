# Razorpay Payment Integration Setup Guide

## ✅ What's Added:
1. **Razorpay Payment Gateway** - Secure online payments
2. **Payment Verification** - Backend verification for security
3. **Order Management** - Automatic order creation & quantity updates
4. **Payment Success Modal** - Shows payment confirmation & reference ID

---

## 🔧 Setup Steps:

### Step 1: Get Razorpay Credentials
1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Sign up/Login with your account
3. Go to **Settings → API Keys**
4. Copy your **Key ID** and **Key Secret**

### Step 2: Set Environment Variables
Create a `.env` file in your project root:
```
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
DATABASE_URL=your_database_url
PORT=3000
```

### Step 3: Update Configuration Files

**In `server.js` (line ~15):**
Replace placeholder keys if not using .env:
```javascript
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET'
});
```

**In `index.js` (line ~420):**
Replace with your actual Key ID:
```javascript
const options = {
    key: 'rzp_test_YOUR_KEY_ID', // ← Replace this
    ...
};
```

### Step 4: Install Dependencies
```bash
npm install
```

### Step 5: Run the Server
```bash
npm start
```

---

## 🧪 Testing:
- Use **Test Mode** (rzp_test_*) for development
- Use dummy card: `4111 1111 1111 1111` (Exp: any future date, CVV: 123)
- Switch to **Live Mode** (rzp_live_*) for production

---

## 📋 New API Endpoints:

### `/api/create-order` (POST)
Creates a Razorpay order
```json
Request: { "amount": 999, "productName": "Bhagavad Gita", "productId": "123" }
Response: { "id": "order_xxx", "amount": 99900, ... }
```

### `/api/verify-payment` (POST)
Verifies payment signature
```json
Request: { 
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "sig_xxx"
}
Response: { "success": true, "message": "Payment verified" }
```

---

## 🔒 Security Notes:
✓ Payment verification happens on backend (secure)  
✓ Signature validation prevents fraud  
✓ Customer data not stored (PCI compliant)  
✓ Use HTTPS in production

---

## 🚀 After Setup:
1. Test payment flow end-to-end
2. Verify order quantity decreases after payment
3. Check success modal shows payment ID
4. Switch to Live Keys for real transactions

**Support:** Razorpay Dashboard → Help & Support
