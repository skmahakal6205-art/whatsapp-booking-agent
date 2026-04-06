/**
 * ============================================
 * WhatsApp Salon Automation System
 * ============================================
 * Main Entry Point
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');
const { startScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Request Logging ----
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ---- API Routes ----
app.use('/api', apiRoutes);

// Auth routes are defined in api.js but need to be accessible at root
app.use('/', apiRoutes);

// ---- Dashboard ----
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Health Check ----
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    salon: process.env.SALON_NAME,
  });
});

// ---- Error Handler ----
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  WhatsApp Salon Automation System        ║');
  console.log('║  ─────────────────────────────────────   ║');
  console.log(`║  🚀 Server running on port ${PORT}          ║`);
  console.log(`║  📊 Dashboard: http://localhost:${PORT}     ║`);
  console.log(`║  🔗 Webhook:   /api/webhook              ║`);
  console.log('║  ─────────────────────────────────────   ║');
  console.log(`║  💈 ${(process.env.SALON_NAME || 'Salon').padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Start scheduled tasks
  startScheduler();
});

module.exports = app;
