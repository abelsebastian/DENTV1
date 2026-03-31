require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { WebSocketServer } = require('ws');
const { setupEventHandler } = require('./events/handler');
const { startReminderJob } = require('./services/reminder.service');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Swagger docs — served via CDN, no extra dependencies
const swaggerSpec = yaml.load(fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8'));
app.get('/api/docs', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Smart DentalOps API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      spec: ${JSON.stringify(swaggerSpec)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/treatments', require('./routes/treatments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/communications', require('./routes/communications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/scheduler', require('./routes/scheduler'));
app.use('/api/sms', require('./routes/sms'));

// WebSocket broadcast helper
const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(data));
  });
};

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Smart DentalOps live' }));
});

setupEventHandler(broadcast);
startReminderJob();

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { broadcast };
