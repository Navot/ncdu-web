import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

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
  excludePaths: string[];
  showHiddenFiles: boolean;
  darkMode: boolean;
}

export interface FileNodeResponse {
  result: FileNode;
  lastUpdated: number;
}

// Helper function to properly encode paths for API calls
function encodePath(path: string): string {
  // Replace backslashes with forward slashes for URL compatibility
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Handle special case for drive letters (e.g., C:)
  if (normalizedPath.length === 2 && normalizedPath.endsWith(':')) {
    return normalizedPath[0];
  }
  
  // For paths like C:\Windows, encode properly
  return encodeURIComponent(normalizedPath);
}

class DiskAPI {
  private ws: WebSocket | null = null;
  private messageHandlers: Record<string, ((data: any) => void)[]> = {};
  
  async getMounts(forceRefresh = false): Promise<{ mountPoints: MountPoint[], lastUpdated: number }> {
    const response = await axios.get(`${API_BASE_URL}/mounts`, {
      params: { forceRefresh }
    });
    return response.data;
  }
  
  async analyzePath(targetPath: string, forceRefresh = false): Promise<FileNodeResponse> {
    try {
      console.log(`API call for path: ${targetPath}, encoded: ${encodePath(targetPath)}`);
      const response = await axios.get(`${API_BASE_URL}/analyze/${encodePath(targetPath)}`, {
        params: { forceRefresh }
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error analyzing path (${targetPath}):`, error);
      throw error;
    }
  }
  
  async deletePath(targetPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/delete/${encodePath(targetPath)}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error deleting path (${targetPath}):`, error);
      
      // Extract error message from response if available
      if (error.response && error.response.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: error.message || 'Failed to delete item'
      };
    }
  }
  
  async getSettings(): Promise<Settings> {
    const response = await axios.get(`${API_BASE_URL}/settings`);
    return response.data;
  }
  
  async updateSettings(settings: Settings): Promise<void> {
    await axios.post(`${API_BASE_URL}/settings`, settings);
  }
  
  // WebSocket methods
  connectWebSocket(): WebSocket {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }
    
    this.ws = new WebSocket(WS_URL);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;
        
        if (this.messageHandlers[type]) {
          this.messageHandlers[type].forEach(handler => handler(data));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 5 seconds...');
      setTimeout(() => this.connectWebSocket(), 5000);
    };
    
    return this.ws;
  }
  
  onWSMessage(type: string, callback: (data: any) => void): void {
    if (!this.messageHandlers[type]) {
      this.messageHandlers[type] = [];
    }
    this.messageHandlers[type].push(callback);
  }
  
  sendWSMessage(type: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.error('WebSocket not connected');
    }
  }
}

export const diskAPI = new DiskAPI(); 