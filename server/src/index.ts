import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { setupWebSocketHandlers } from './controllers/websocket';
import { diskController } from './controllers/disk';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// REST endpoints
app.get('/api/mounts', diskController.getMounts);
app.get('/api/analyze/:path', diskController.analyzePath);
app.post('/api/settings', diskController.updateSettings);
app.get('/api/settings', diskController.getSettings);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });
setupWebSocketHandlers(wss);

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 