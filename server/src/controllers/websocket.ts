import { WebSocketServer, WebSocket } from 'ws';
import { diskService } from '../services/disk';

interface WSMessage {
  type: 'analyze' | 'delete' | 'refresh';
  path?: string;
}

export function setupWebSocketHandlers(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');

    ws.on('message', async (message: string) => {
      try {
        const data: WSMessage = JSON.parse(message);

        switch (data.type) {
          case 'analyze':
            if (data.path) {
              const analysis = await diskService.analyzePath(data.path, false);
              ws.send(JSON.stringify({
                type: 'analysis',
                data: analysis
              }));
            }
            break;

          case 'refresh':
            if (data.path) {
              const analysis = await diskService.analyzePath(data.path, false);
              ws.send(JSON.stringify({
                type: 'refresh',
                data: analysis
              }));
            }
            break;

          case 'delete':
            if (data.path) {
              await diskService.deletePath(data.path);
              ws.send(JSON.stringify({
                type: 'deleted',
                path: data.path
              }));
            }
            break;
        }
      } catch (error) {
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