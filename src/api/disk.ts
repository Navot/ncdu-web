const API_URL = 'http://localhost:3001/api';

export interface MountPoint {
  name: string;
  path: string;
  total: number;
  used: number;
  available: number;
}

export interface FileNode {
  name: string;
  size: number;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface Settings {
  autoRefresh: boolean;
  refreshInterval: number;
  excludePaths: string;
  showHiddenFiles: boolean;
  darkMode: boolean;
}

interface MountPointsResponse {
  mountPoints: MountPoint[];
  lastUpdated: number;
}

interface FileNodeResponse {
  result: FileNode;
  lastUpdated: number;
}

class DiskAPI {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  async getMounts(forceRefresh = false): Promise<MountPointsResponse> {
    const response = await fetch(`${API_URL}/mounts?forceRefresh=${forceRefresh}`);
    if (!response.ok) {
      throw new Error('Failed to get mount points');
    }
    
    return await response.json();
  }

  async analyzePath(path: string, forceRefresh = false): Promise<FileNodeResponse> {
    const encodedPath = encodeURIComponent(path);
    const response = await fetch(`${API_URL}/analyze/${encodedPath}?forceRefresh=${forceRefresh}`);
    
    if (!response.ok) {
      throw new Error(`Failed to analyze path: ${path}`);
    }
    
    return await response.json();
  }

  async getSettings(): Promise<Settings> {
    const response = await fetch(`${API_URL}/settings`);
    return response.json();
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    return response.json();
  }

  connectWebSocket(onMessage: (data: any) => void) {
    if (this.ws) return;

    this.ws = new WebSocket('ws://localhost:3001');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
      
      const handler = this.messageHandlers.get(data.type);
      if (handler) {
        handler(data);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(onMessage), 5000);
    };
  }

  onWSMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  sendWSMessage(type: string, data: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }
}

export const diskAPI = new DiskAPI(); 