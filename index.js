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
    const { status, customerName } = req.query;
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (customerName) {
      where.customerName = {
        contains: customerName,
        mode: 'insensitive'
      };
    }
    
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

// Update device name
app.patch('/api/palm/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location } = req.body;
    
    const device = await prisma.palmDevice.update({
      where: { id },
      data: { name, location }
    });
    
    res.json({ device });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// Get next pending order
app.get('/api/palm/next-order', async (req, res) => {
  try {
    // Any device can get any pending order (first-come-first-served)
    const order = await prisma.order.findFirst({
      where: { status: 'pending' },
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
    const { status, customerName } = req.body;
    
    // Only update status, completedAt, and customerName
    // Don't update customerId as it causes foreign key constraint errors
    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        completedAt: new Date(),
        ...(customerName && { customerName })
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

// ============ ACCESS CONTROL ENDPOINTS ============

// Get all users (for access control dashboard)
app.get('/api/v1/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true
      },
      orderBy: { displayName: 'asc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user authentication logs
app.get('/api/v1/users/:userId/auth-logs', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const logs = await prisma.authenticationLog.findMany({
      where: { userId },
      orderBy: { authenticatedAt: 'desc' },
      take: limit,
      skip: offset
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching auth logs:', error);
    res.status(500).json({ error: 'Failed to fetch authentication logs' });
  }
});

// Get all device authentication logs
app.get('/api/v1/palm/device-logs', async (req, res) => {
  try {
    const logs = await prisma.deviceAuthenticationLog.findMany({
      include: {
        palmDevice: {
          select: {
            name: true,
            location: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 1000
    });
    
    const formattedLogs = logs.map(log => ({
      id: log.id,
      deviceType: log.deviceType,
      location: log.palmDevice?.location || log.location,
      success: log.success,
      reason: log.reason,
      timestamp: log.timestamp,
      palmDeviceId: log.palmDeviceId,
      deviceName: log.palmDevice?.name
    }));
    
    res.json(formattedLogs);
  } catch (error) {
    console.error('Error fetching device logs:', error);
    res.status(500).json({ error: 'Failed to fetch device logs' });
  }
});

// Log authentication attempt from palm device
app.post('/api/palm-devices/auth-log', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const apiToken = authHeader.substring(7);
    const device = await prisma.palmDevice.findUnique({ 
      where: { apiToken } 
    });
    
    if (!device) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { deviceType, location, success, reason } = req.body;
    
    const authLog = await prisma.deviceAuthenticationLog.create({
      data: {
        palmDeviceId: device.id,
        deviceType: deviceType || 'palm',
        location: location || 'Unknown',
        success: success || false,
        reason: reason || 'Authentication failed',
        timestamp: new Date()
      }
    });

    res.json({ success: true, log: authLog });
  } catch (error) {
    console.error('Error logging auth attempt:', error);
    res.status(500).json({ error: 'Failed to log authentication attempt' });
  }
});

// ============ iOS APP ENDPOINTS ============

// Get single user by ID
app.get('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cards: true,
        palmTemplates: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Search user by displayName
app.get('/api/v1/users/search/by-name', async (req, res) => {
  try {
    const { displayName } = req.query;
    
    if (!displayName) {
      return res.status(400).json({ error: 'displayName is required' });
    }
    
    const user = await prisma.user.findFirst({
      where: { 
        displayName: {
          equals: displayName,
          mode: 'insensitive'
        }
      },
      include: {
        cards: true,
        palmTemplates: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Error searching user:', error);
    res.status(500).json({ error: 'Failed to search user' });
  }
});

// Get palm template for user
app.get('/api/v1/palm/template/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const template = await prisma.palmTemplate.findFirst({
      where: { userId }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Palm template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching palm template:', error);
    res.status(500).json({ error: 'Failed to fetch palm template' });
  }
});

// Verify palm - returns all templates for client-side matching
app.post('/api/v1/palm/verify', async (req, res) => {
  try {
    const { sdkVendor, featureVersion, palmFeatures } = req.body;
    
    // Get all active templates
    const templates = await prisma.palmTemplate.findMany({
      where: {
        active: true,
        sdkVendor: sdkVendor || 'veinshine',
        featureVersion: featureVersion || '1.0'
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      templateCount: templates.length,
      templates: templates.map(t => ({
        id: t.id,
        userId: t.userId,
        user: t.user,
        leftRgbFeature: t.leftRgbFeature,
        leftIrFeature: t.leftIrFeature,
        rightRgbFeature: t.rightRgbFeature,
        rightIrFeature: t.rightIrFeature
      }))
    });
  } catch (error) {
    console.error('Palm verification error:', error);
    res.status(500).json({ success: false, error: 'Palm verification failed' });
  }
});

// In-memory storage for enrollment tokens (use Redis in production)
const enrollmentTokens = new Map();

// Generate enrollment QR code for unrecognized palm
app.post('/api/v1/palm/generate-enrollment-qr', async (req, res) => {
  try {
    const { palmFeatures } = req.body;
    
    // Create temporary enrollment token
    const enrollmentToken = require('crypto').randomBytes(16).toString('hex');
    
    // Store palm features temporarily (10 minute expiry)
    enrollmentTokens.set(enrollmentToken, {
      palmFeatures,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });
    
    // Clean up expired tokens
    setTimeout(() => {
      enrollmentTokens.delete(enrollmentToken);
    }, 10 * 60 * 1000);
    
    // Return QR code data
    res.json({
      success: true,
      enrollmentToken,
      expiresIn: 600 // seconds
    });
  } catch (error) {
    console.error('Error generating enrollment QR:', error);
    res.status(500).json({ success: false, error: 'Failed to generate enrollment QR' });
  }
});

// Get enrollment data by token
app.get('/api/v1/palm/enrollment/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const enrollment = enrollmentTokens.get(token);
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment token not found or expired' });
    }
    
    // Check expiry
    if (Date.now() > enrollment.expiresAt) {
      enrollmentTokens.delete(token);
      return res.status(410).json({ error: 'Enrollment token expired' });
    }
    
    res.json({
      success: true,
      palmFeatures: enrollment.palmFeatures,
      createdAt: enrollment.createdAt
    });
  } catch (error) {
    console.error('Error fetching enrollment data:', error);
    res.status(500).json({ error: 'Failed to fetch enrollment data' });
  }
});

// Get user cards
app.get('/api/v1/users/:userId/cards', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const cards = await prisma.card.findMany({
      where: { userId }
    });
    
    res.json({ cards });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Delete user and all related data
app.delete('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Delete in order: cards, palm templates, auth logs, then user
    await prisma.card.deleteMany({ where: { userId } });
    await prisma.palmTemplate.deleteMany({ where: { userId } });
    await prisma.authenticationLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user authentication history (scans)
app.get('/api/v1/users/:userId/auth-history', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const logs = await prisma.authenticationLog.findMany({
      where: { userId },
      orderBy: { authenticatedAt: 'desc' },
      take: limit,
      skip: offset
    });
    
    res.json({ logs, total: logs.length, limit, offset });
  } catch (error) {
    console.error('Error fetching auth history:', error);
    res.status(500).json({ error: 'Failed to fetch authentication history' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Palm Payment API running on port ${PORT}`);
});
