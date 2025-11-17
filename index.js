require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ PRODUCTS ============

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });
    res.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, imageUrl, stock } = req.body;
    const product = await prisma.product.create({
      data: { name, description, price, imageUrl, stock }
    });
    res.json({ product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ============ CUSTOMERS ============

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, palmId } = req.body;
    const customer = await prisma.customer.create({
      data: { name, email, phone, palmId }
    });
    res.json({ customer });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ============ ORDERS ============

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerId, customerName, items, palmDeviceId } = req.body;
    
    if (!palmDeviceId) {
      return res.status(400).json({ error: 'Device selection required' });
    }
    
    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    
    const order = await prisma.order.create({
      data: {
        customerId,
        customerName,
        totalAmount,
        palmDeviceId,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }))
        }
      },
      include: {
        items: { include: { product: true } },
        palmDevice: true
      }
    });
    res.json({ order });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ============ PALM DEVICE ENDPOINTS ============

// Get all palm devices
app.get('/api/palm/devices', async (req, res) => {
  try {
    const devices = await prisma.palmDevice.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        active: true,
        lastSeenAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get next pending order
app.get('/api/palm/next-order', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const device = await prisma.palmDevice.findUnique({
      where: { apiToken: token }
    });

    if (!device) {
      return res.status(401).json({ error: 'Invalid device token' });
    }

    // Get next pending order for THIS device
    const order = await prisma.order.findFirst({
      where: { 
        status: 'pending',
        palmDeviceId: device.id
      },
      include: {
        items: { include: { product: true } },
        customer: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ order: order || null });
  } catch (error) {
    console.error('Error fetching next order:', error);
    res.status(500).json({ error: 'Failed to fetch next order' });
  }
});

// Complete order
app.post('/api/palm/complete-order/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, customerId, customerName } = req.body;
    
    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        completedAt: new Date(),
        customerId,
        customerName
      }
    });
    res.json({ order, message: 'Order completed' });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

// Register palm device
app.post('/api/palm/register', async (req, res) => {
  try {
    const { name, location } = req.body;
    const apiToken = require('crypto').randomBytes(32).toString('hex');
    
    const device = await prisma.palmDevice.create({
      data: { name, location, apiToken }
    });
    res.json({ device });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Get all devices
app.get('/api/palm-devices', async (req, res) => {
  try {
    const devices = await prisma.palmDevice.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// iOS: Get customer transactions
app.get('/api/transactions/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const orders = await prisma.order.findMany({
      where: { customerId, status: 'completed' },
      include: {
        items: { include: { product: true } }
      },
      orderBy: { completedAt: 'desc' }
    });
    res.json({ transactions: orders });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Palm Payment API running on port ${PORT}`);
});
