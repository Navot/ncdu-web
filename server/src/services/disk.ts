import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import os from 'os';

const execAsync = promisify(exec);

interface DiskUsage {
  name: string;
  size: number;
  type: 'file' | 'directory';
  children?: DiskUsage[];
}

interface MountPoint {
  path: string;
  total: number;
  used: number;
  name: string;
  alert: boolean;
}

export const diskService = {
  async getMountPoints(): Promise<MountPoint[]> {
    try {
      const { stdout } = await execAsync('wmic logicaldisk get caption,size,freespace');
      const lines = stdout.trim().split('\n').slice(1);
      
      return lines.map(line => {
        const [caption, size, freeSpace] = line.trim().split(/\s+/);
        const total = parseInt(size) || 0;
        const free = parseInt(freeSpace) || 0;
        const used = total - free;
        
        return {
          path: caption,
          total,
          used,
          name: `Drive ${caption}`,
          alert: (used / total) > 0.9
        };
      }).filter(mount => mount.total > 0);
    } catch (error) {
      console.error('Failed to get mount points:', error);
      return [];
    }
  },

  async analyzePath(path: string, showHidden: boolean): Promise<DiskUsage> {
    async function analyzeItem(itemPath: string): Promise<DiskUsage> {
      const stats = await stat(itemPath);
      const name = itemPath.split('\\').pop() || itemPath;

      if (!showHidden && name.startsWith('.')) {
        return {
          name,
          size: 0,
          type: 'file'
        };
      }

      if (stats.isFile()) {
        return {
          name,
          size: stats.size,
          type: 'file'
        };
      }

      const children: DiskUsage[] = [];
      let totalSize = 0;

      try {
        const items = await readdir(itemPath);
        for (const item of items) {
          try {
            const child = await analyzeItem(join(itemPath, item));
            totalSize += child.size;
            children.push(child);
          } catch (error) {
            console.error(`Error analyzing ${item}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${itemPath}:`, error);
      }

      return {
        name,
        size: totalSize,
        type: 'directory',
        children: children.sort((a, b) => b.size - a.size)
      };
    }

    return await analyzeItem(path);
  },

  async deletePath(path: string): Promise<void> {
    await unlink(path);
  }
}; 