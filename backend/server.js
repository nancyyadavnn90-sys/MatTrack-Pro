const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
require('./config/db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Global Request and Response Logger Middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  const originalJson = res.json;
  res.json = function(data) {
    console.log(`[RESPONSE] ${res.statusCode} for ${req.url}:`, JSON.stringify(data).substring(0, 150));
    return originalJson.apply(this, arguments);
  };
  next();
});

// Bind Socket.io instance to request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
const gatePassRoutes = require('./routes/gatePassRoutes');
app.use('/api/gate-passes', gatePassRoutes);
const wipRoutes = require('./routes/wipRoutes');
app.use('/api/wip', wipRoutes);
const grnRoutes = require('./routes/grnRoutes');
app.use('/api/grn', grnRoutes);
const inventoryRoutes = require('./routes/inventoryRoutes');
app.use('/api/inventory', inventoryRoutes);
const qcRoutes = require('./routes/qcRoutes');
app.use('/api/qc', qcRoutes);
const productionRoutes = require('./routes/productionRoutes');
app.use('/api/production', productionRoutes);
const mixingRoutes = require('./routes/mixingRoutes');
app.use('/api/mixing', mixingRoutes);
const mouldingRoutes = require('./routes/mouldingRoutes');
app.use('/api/moulding', mouldingRoutes);
const finalQcRoutes = require('./routes/finalQcRoutes');
app.use('/api/final-qc', finalQcRoutes);
const fgReceiptRoutes = require('./routes/fgReceiptRoutes');
app.use('/api/fg-receipts', fgReceiptRoutes);
const dispatchRoutes = require('./routes/dispatchRoutes');
app.use('/api/dispatch', dispatchRoutes);
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);
app.get('/', (req, res) => {
  res.json({ message: '✅ WIP OEE Server Running!' });
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  try {
    const { initializeAlertsJob } = require('./controllers/wipController');
    initializeAlertsJob();
    console.log('⏰ WIP Auto-Alerts background job initialized');
  } catch (e) {
    console.error('Failed to initialize auto-alerts job:', e);
  }
});