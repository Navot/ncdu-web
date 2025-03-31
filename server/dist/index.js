"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const websocket_1 = require("./controllers/websocket");
const disk_1 = require("./controllers/disk");
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// REST endpoints
app.get('/api/mounts', disk_1.diskController.getMounts);
app.get('/api/analyze/:path', disk_1.diskController.analyzePath);
app.post('/api/settings', disk_1.diskController.updateSettings);
app.get('/api/settings', disk_1.diskController.getSettings);
// Create HTTP server
const server = http_1.default.createServer(app);
// Create WebSocket server
const wss = new ws_1.WebSocketServer({ server });
(0, websocket_1.setupWebSocketHandlers)(wss);
// Start server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
