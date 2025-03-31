import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface FileNode {
  name: string;
  size: number;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface MountPoint {
  name: string;
  path: string;
  total: number;
  used: number;
  available: number;
}

export interface Settings {
  autoRefresh: boolean;
  refreshInterval: number;
  excludePaths: string[];
  showHiddenFiles: boolean;
  darkMode: boolean;
}

const defaultSettings: Settings = {
  autoRefresh: false,
  refreshInterval: 60,
  excludePaths: [],
  showHiddenFiles: false,
  darkMode: false,
};

// Paths that should be skipped during analysis
const SYSTEM_PATHS = [
  'System Volume Information',
  'pagefile.sys',
  'swapfile.sys',
  'hiberfil.sys',
  'DumpStack.log',
  '$Recycle.Bin',
  '$WINDOWS.~BT',
  '$Windows.~WS',
  'Windows.old',
  'DumpStack.log.tmp'
];

function shouldSkipPath(itemPath: string): boolean {
  return SYSTEM_PATHS.some(systemPath => itemPath.includes(systemPath));
}

export const diskAPI = {
  async getMounts(): Promise<MountPoint[]> {
    // For Windows, we'll return the C: drive as an example
    return [{
      name: 'C:',
      path: 'C:',
      total: 250000000000, // 250GB example
      used: 150000000000,  // 150GB example
      available: 100000000000, // 100GB example
    }];
  },

  async analyzeItem(itemPath: string): Promise<FileNode> {
    try {
      const fullPath = path.resolve(process.cwd(), itemPath);
      const stats = await fs.stat(fullPath);
      const name = path.basename(fullPath);

      if (stats.isFile()) {
        return {
          name,
          size: stats.size,
          type: 'file'
        };
      }

      if (stats.isDirectory()) {
        const children: FileNode[] = [];
        const items = await fs.readdir(fullPath);

        for (const item of items) {
          try {
            const childPath = path.join(itemPath, item);
            const child = await this.analyzeItem(childPath);
            children.push(child);
          } catch (error) {
            console.error(`Error analyzing ${item}:`, error);
          }
        }

        return {
          name,
          size: children.reduce((acc, child) => acc + child.size, 0),
          type: 'directory',
          children
        };
      }

      throw new Error(`Unsupported file type for ${itemPath}`);
    } catch (error) {
      console.error(`Error analyzing ${itemPath}:`, error);
      throw error;
    }
  },

  async analyzePath(targetPath: string = '.'): Promise<FileNode> {
    return this.analyzeItem(targetPath);
  },

  async getSettings(): Promise<Settings> {
    try {
      const settingsPath = path.join(process.cwd(), 'settings.json');
      const data = await fs.readFile(settingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return defaultSettings;
    }
  },

  async updateSettings(settings: Settings): Promise<void> {
    const settingsPath = path.join(process.cwd(), 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  }
};

export const diskService = {
  async getMountPoints(): Promise<MountPoint[]> {
    try {
      // Get drive information using wmic
      const { stdout } = await execAsync('wmic logicaldisk get caption,size,freespace /format:csv');
      
      // Parse CSV output (skip first empty line)
      const lines = stdout.trim().split('\n').slice(1);
      const mounts: MountPoint[] = [];
      
      for (const line of lines) {
        const [_, caption, freeSpace, size] = line.trim().split(',');
        if (!caption || !size) continue;
        
        const total = parseInt(size) || 0;
        const available = parseInt(freeSpace) || 0;
        const used = total - available;
        
        if (total > 0) {
          mounts.push({
            name: `Drive ${caption}`,
            path: caption,
            total,
            used,
            available
          });
        }
      }
      
      return mounts;
    } catch (error) {
      console.error('Failed to get mount points:', error);
      return [];
    }
  },

  async analyzePath(targetPath: string): Promise<FileNode> {
    // Make sure we're working with absolute path for root drives
    // This ensures we analyze C:\ or D:\ not the working directory
    const rootPath = targetPath.endsWith(':') 
      ? `${targetPath}\\` 
      : path.resolve(targetPath);
    
    const name = path.basename(rootPath) || rootPath;

    async function analyzeItem(itemPath: string): Promise<FileNode> {
      try {
        // Skip Windows system files and directories
        if (shouldSkipPath(itemPath)) {
          return {
            name: path.basename(itemPath) || itemPath,
            size: 0,
            type: 'file'
          };
        }

        const stats = await fs.stat(itemPath);
        const itemName = path.basename(itemPath) || itemPath;

        if (stats.isFile()) {
          return {
            name: itemName,
            size: stats.size,
            type: 'file'
          };
        }

        if (stats.isDirectory()) {
          let children: FileNode[] = [];
          try {
            const items = await fs.readdir(itemPath);
            
            for (const item of items) {
              try {
                const childPath = path.join(itemPath, item);
                const child = await analyzeItem(childPath);
                children.push(child);
              } catch (error) {
                console.error(`Error analyzing ${item}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error reading directory ${itemPath}:`, error);
          }

          return {
            name: itemName,
            size: children.reduce((acc, child) => acc + child.size, 0),
            type: 'directory',
            children: children.sort((a, b) => b.size - a.size)
          };
        }

        return {
          name: itemName,
          size: 0,
          type: 'file'
        };
      } catch (error) {
        console.error(`Error analyzing ${itemPath}:`, error);
        // Return empty node for errors
        return {
          name: path.basename(itemPath) || itemPath,
          size: 0,
          type: 'file'
        };
      }
    }

    return analyzeItem(rootPath);
  },

  async deletePath(path: string): Promise<void> {
    await unlink(path);
  }
}; 