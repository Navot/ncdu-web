"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocketHandlers = void 0;
const disk_1 = require("../services/disk");
function setupWebSocketHandlers(wss) {
    wss.on('connection', (ws) => {
        console.log('Client connected');
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                switch (data.type) {
                    case 'analyze':
                        if (data.path) {
                            const analysis = await disk_1.diskService.analyzePath(data.path, false);
                            ws.send(JSON.stringify({
                                type: 'analysis',
                                data: analysis
                            }));
                        }
                        break;
                    case 'refresh':
                        if (data.path) {
                            const analysis = await disk_1.diskService.analyzePath(data.path, false);
                            ws.send(JSON.stringify({
                                type: 'refresh',
                                data: analysis
                            }));
                        }
                        break;
                    case 'delete':
                        if (data.path) {
                            await disk_1.diskService.deletePath(data.path);
                            ws.send(JSON.stringify({
                                type: 'deleted',
                                path: data.path
                            }));
                        }
                        break;
                }
            }
            catch (error) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to process request'
                }));
            }
        });
        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
}
exports.setupWebSocketHandlers = setupWebSocketHandlers;
