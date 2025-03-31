import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Cache for disk analysis data
interface DiskDataCache {
  mountPoints: MountPoint[];
  largeDirectories: Record<string, LargeDirectory[]>;
  lastUpdated: number;
}

interface LargeDirectory {
  path: string;
  size: number;
  name: string;
}

// In-memory cache object
let diskCache: DiskDataCache = {
  mountPoints: [],
  largeDirectories: {},
  lastUpdated: 0
};

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
  'DumpStack.log.tmp',
  'bootnxt',
  'bootmgr',
  'boot',
  'config.sys',
  'Recovery',
  'ProgramData',
  'Documents and Settings',
  'desktop.ini',
  '.DocumentRevisions-V100',
  '.fseventsd',
  '.Spotlight-V100',
  '.TemporaryItems',
  '.Trashes',
  '.vol',
  'WindowsApps',
  'WpSystem',
  'MSOCache',
  '\\$GetCurrent',
  '\\$SysReset',
  '\\$Windows.~WS',
  '\\$WinREAgent',
  'NTUSER.DAT'
];

function shouldSkipPath(itemPath: string): boolean {
  // Skip any path that includes any of the system paths
  if (SYSTEM_PATHS.some(systemPath => itemPath.toLowerCase().includes(systemPath.toLowerCase()))) {
    return true;
  }
  
  // Skip paths starting with $ or .
  const basename = path.basename(itemPath);
  if (basename.startsWith('$') || basename.startsWith('.')) {
    return true;
  }
  
  // Skip Windows system folders
  if (itemPath.toLowerCase().includes('windows') || 
      itemPath.toLowerCase().includes('program files')) {
    return true;
  }
  
  return false;
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
              const child = await this.analyzeItem(childPath);
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
  },

  async analyzePath(targetPath: string): Promise<FileNode> {
    // Handle special case for root drives
    if (targetPath.endsWith(':')) {
      const driveLetter = targetPath;
      const rootPath = `${driveLetter}\\`;
      
      try {
        // Instead of scanning the entire drive, check specific user directories first
        const userFolders = [
          `${rootPath}Users`,
          `${rootPath}Documents and Settings`
        ];
        
        const children: FileNode[] = [];
        
        // Analyze the user folders first (this is what most people care about)
        for (const folder of userFolders) {
          try {
            if (await fs.stat(folder).then(() => true).catch(() => false)) {
              const folderNode = await this.analyzeItem(folder);
              children.push(folderNode);
            }
          } catch (error) {
            console.error(`Error analyzing ${folder}:`, error);
          }
        }
        
        // Add a placeholder for system files
        children.push({
          name: 'System Files (skipped)',
          size: 0,
          type: 'directory'
        });
        
        // Return a node for the drive with these children
        return {
          name: path.basename(rootPath) || rootPath,
          size: children.reduce((acc, child) => acc + child.size, 0),
          type: 'directory',
          children: children.sort((a, b) => b.size - a.size)
        };
      } catch (error) {
        console.error(`Error analyzing drive ${rootPath}:`, error);
        return {
          name: path.basename(rootPath) || rootPath,
          size: 0,
          type: 'directory',
          children: []
        };
      }
    }
    
    // For non-drive paths, use the regular analysis
    return this.analyzeItem(path.resolve(targetPath));
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
  async getMounts(forceRefresh = false): Promise<{ mountPoints: MountPoint[], lastUpdated: number }> {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && diskCache.mountPoints.length > 0) {
      return { 
        mountPoints: diskCache.mountPoints,
        lastUpdated: diskCache.lastUpdated
      };
    }

    try {
      // Get drive information using wmic - make sure we include all drives
      const { stdout } = await execAsync('wmic logicaldisk get caption,size,freespace,volumename /format:csv');
      
      // Parse CSV output (skip first empty line)
      const lines = stdout.trim().split('\n').slice(1);
      const mounts: MountPoint[] = [];
      
      for (const line of lines) {
        const parts = line.trim().split(',');
        if (parts.length < 3) continue;
        
        const caption = parts[1];  // Drive letter
        const freeSpace = parts[2]; // Free space
        const size = parts[3];     // Total size
        const volumeName = parts.length > 4 ? parts[4] : ''; // Volume name (if available)
        
        if (!caption || !size) continue;
        
        const total = parseInt(size) || 0;
        const available = parseInt(freeSpace) || 0;
        const used = total - available;
        
        if (total > 0) {
          const name = volumeName ? `${volumeName} (${caption})` : caption;
          mounts.push({
            name: name,
            path: caption,
            total,
            used,
            available
          });
        }
      }
      
      console.log(`Found ${mounts.length} drives:`, mounts.map(m => m.path).join(', '));
      
      // Update cache
      diskCache.mountPoints = mounts;
      diskCache.lastUpdated = Date.now();
      
      // Save cache to file
      this.saveCacheToFile();
      
      return { 
        mountPoints: mounts,
        lastUpdated: diskCache.lastUpdated
      };
    } catch (error) {
      console.error('Failed to get mount points:', error);
      
      // As a fallback, create entries for C: and D: drives
      if (diskCache.mountPoints.length === 0) {
        const fallbackMounts: MountPoint[] = [
          {
            name: 'C:',
            path: 'C:',
            total: 250000000000, // 250GB example
            used: 150000000000,  // 150GB example
            available: 100000000000, // 100GB example
          }
        ];
        
        // Check if D: is accessible
        try {
          await fs.stat('D:\\');
          fallbackMounts.push({
            name: 'D:',
            path: 'D:',
            total: 250000000000, // 250GB example
            used: 150000000000,  // 150GB example
            available: 100000000000, // 100GB example
          });
        } catch (e) {
          // D: doesn't exist or isn't accessible
        }
        
        diskCache.mountPoints = fallbackMounts;
        diskCache.lastUpdated = Date.now();
      }
      
      return { 
        mountPoints: diskCache.mountPoints,
        lastUpdated: diskCache.lastUpdated
      };
    }
  },
  
  // Add a backwards compatibility alias
  async getMountPoints(forceRefresh = false): Promise<{ mountPoints: MountPoint[], lastUpdated: number }> {
    return this.getMounts(forceRefresh);
  },

  async analyzePath(targetPath: string, forceRefresh = false): Promise<{ result: FileNode, lastUpdated: number }> {
    // Return cached large directories if available and not forcing refresh
    if (!forceRefresh && diskCache.largeDirectories[targetPath]) {
      // Convert the cached large directories to a FileNode structure
      const children = diskCache.largeDirectories[targetPath].map(dir => ({
        name: dir.name,
        size: dir.size,
        type: 'directory' as const
      }));
      
      return {
        result: {
          name: targetPath,
          size: children.reduce((sum, dir) => sum + dir.size, 0),
          type: 'directory',
          children
        },
        lastUpdated: diskCache.lastUpdated
      };
    }
    
    // Handle special case for root drives
    if (targetPath.endsWith(':')) {
      const driveLetter = targetPath;
      const rootPath = `${driveLetter}\\`;
      
      try {
        console.log(`Analyzing root directory: ${rootPath}`);
        
        // Get all items in the root directory
        const rootItems = await fs.readdir(rootPath);
        console.log(`Found ${rootItems.length} items in root`);
        
        const children: FileNode[] = [];
        
        // Process each item in the root directory
        for (const item of rootItems) {
          const itemPath = path.join(rootPath, item);
          
          // Skip locked system files but not all system files
          if (itemPath.includes('$Recycle.Bin') || 
              itemPath.includes('System Volume Information') ||
              item === 'pagefile.sys' ||
              item === 'hiberfil.sys' ||
              item === 'swapfile.sys' ||
              item === 'DumpStack.log.tmp') {
            continue;
          }
          
          try {
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
              console.log(`Processing directory: ${item}`);
              
              // Calculate directory size recursively (with depth limit)
              const dirSize = await calculateDirectorySize(itemPath, 2);
              
              // Add the directory with its calculated size
              children.push({
                name: item,
                size: dirSize,
                type: 'directory'
              });
              
              console.log(`Added directory ${item} with size ${dirSize}`);
            } 
            else if (stats.isFile() && stats.size > 1024 * 1024 * 10) { // Only include large files (>10MB)
              console.log(`Adding large file: ${item} (${stats.size} bytes)`);
              children.push({
                name: item,
                size: stats.size,
                type: 'file'
              });
            }
          } catch (error) {
            console.error(`Error processing ${itemPath}:`, error);
          }
        }
        
        // Sort by size (largest first)
        const sortedChildren = children
          .filter(item => item.size > 0) // Remove zero-sized items
          .sort((a, b) => b.size - a.size);
        
        console.log(`Final result: ${sortedChildren.length} items with content`);
        
        // If no content found, try looking in hidden folders like Users
        if (sortedChildren.length === 0) {
          // Try looking in some specific paths that might exist even when hidden
          const fallbackPaths = [
            `${rootPath}Users`,
            `${rootPath}Documents and Settings`,
            `${rootPath}Program Files`,
            `${rootPath}Program Files (x86)`
          ];
          
          for (const fbPath of fallbackPaths) {
            try {
              if (await fs.stat(fbPath).then(() => true).catch(() => false)) {
                console.log(`Trying fallback path: ${fbPath}`);
                const dirSize = await calculateDirectorySize(fbPath, 1);
                if (dirSize > 0) {
                  sortedChildren.push({
                    name: path.basename(fbPath),
                    size: dirSize,
                    type: 'directory'
                  });
                  console.log(`Added fallback directory ${path.basename(fbPath)} with size ${dirSize}`);
                }
              }
            } catch (error) {
              console.error(`Error analyzing fallback path ${fbPath}:`, error);
            }
          }
        }
        
        // Add a placeholder for system files that were skipped
        if (sortedChildren.length === 0) {
          sortedChildren.push({
            name: 'No accessible directories found',
            size: 0,
            type: 'directory'
          });
        }
        
        // Save to cache
        diskCache.largeDirectories[targetPath] = sortedChildren
          .filter(node => node.type === 'directory')
          .map(node => ({
            path: `${targetPath}\\${node.name}`,
            size: node.size,
            name: node.name
          }));
        
        diskCache.lastUpdated = Date.now();
        
        // Save cache to file
        this.saveCacheToFile();
        
        return {
          result: {
            name: path.basename(rootPath) || rootPath,
            size: sortedChildren.reduce((acc, child) => acc + child.size, 0),
            type: 'directory',
            children: sortedChildren
          },
          lastUpdated: diskCache.lastUpdated
        };
      } catch (error) {
        console.error(`Error analyzing drive ${rootPath}:`, error);
        return {
          result: {
            name: path.basename(rootPath) || rootPath,
            size: 0,
            type: 'directory',
            children: [{
              name: 'Error analyzing drive',
              size: 0,
              type: 'directory'
            }]
          },
          lastUpdated: diskCache.lastUpdated
        };
      }
    }
    
    // For non-drive paths, use a different approach
    try {
      // Make sure we're using absolute paths when the path is not a drive letter
      // This fixes issues with paths like "Windows" that need to be fully qualified
      const fullPath = targetPath.includes(':') ? targetPath : path.resolve(targetPath);
      
      console.log(`Analyzing non-drive path: ${fullPath}`);
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile()) {
        return {
          result: {
            name: path.basename(fullPath),
            size: stats.size,
            type: 'file'
          },
          lastUpdated: Date.now()
        };
      }
      
      if (stats.isDirectory()) {
        const items = await fs.readdir(fullPath);
        const children: FileNode[] = [];
        
        for (const item of items) {
          const itemPath = path.join(fullPath, item);
          
          try {
            const itemStats = await fs.stat(itemPath);
            
            if (itemStats.isFile()) {
              children.push({
                name: item,
                size: itemStats.size,
                type: 'file'
              });
            } else if (itemStats.isDirectory()) {
              // Calculate subdirectory size recursively
              const dirSize = await calculateDirectorySize(itemPath, 1);
              
              children.push({
                name: item,
                size: dirSize,
                type: 'directory'
              });
            }
          } catch (error) {
            console.error(`Error processing ${itemPath}:`, error);
          }
        }
        
        const sortedChildren = children
          .sort((a, b) => b.size - a.size);
        
        return {
          result: {
            name: path.basename(fullPath),
            size: sortedChildren.reduce((acc, child) => acc + child.size, 0),
            type: 'directory',
            children: sortedChildren
          },
          lastUpdated: Date.now()
        };
      }
    } catch (error) {
      console.error(`Error analyzing ${targetPath}:`, error);
    }
    
    return {
      result: {
        name: path.basename(targetPath) || targetPath,
        size: 0,
        type: 'directory',
        children: []
      },
      lastUpdated: Date.now()
    };
  },
  
  // Method to save cache to file
  async saveCacheToFile(): Promise<void> {
    try {
      const cachePath = path.join(process.cwd(), 'disk-cache.json');
      await fs.writeFile(cachePath, JSON.stringify(diskCache), 'utf8');
    } catch (error) {
      console.error('Failed to save disk cache to file:', error);
    }
  },
  
  // Method to load cache from file
  async loadCacheFromFile(): Promise<void> {
    try {
      const cachePath = path.join(process.cwd(), 'disk-cache.json');
      const data = await fs.readFile(cachePath, 'utf8');
      diskCache = JSON.parse(data);
    } catch (error) {
      // If the file doesn't exist or has invalid JSON, initialize an empty cache
      diskCache = {
        mountPoints: [],
        largeDirectories: {},
        lastUpdated: 0
      };
    }
  },

  // Initialize cache from file when the server starts
  async initializeCache(): Promise<void> {
    await this.loadCacheFromFile();
  },

  async deletePath(targetPath: string): Promise<{ success: boolean, message: string }> {
    try {
      console.log(`Attempting to delete path: ${targetPath}`);
      
      // Check if path exists
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        // For directories, use recursive deletion
        console.log(`Deleting directory: ${targetPath}`);
        await fs.rm(targetPath, { recursive: true, force: true });
      } else {
        // For files, use unlink
        console.log(`Deleting file: ${targetPath}`);
        await fs.unlink(targetPath);
      }
      
      // Remove from cache if exists
      if (diskCache.largeDirectories[targetPath]) {
        delete diskCache.largeDirectories[targetPath];
        this.saveCacheToFile();
      }
      
      return {
        success: true,
        message: `Successfully deleted ${stats.isDirectory() ? 'directory' : 'file'}: ${targetPath}`
      };
    } catch (error) {
      console.error(`Error deleting path: ${error}`);
      
      // Get more specific error messages for common issues
      let errorMessage = 'Failed to delete path';
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        errorMessage = 'Permission denied. Try running with administrator privileges or check file permissions.';
      } else if (error.code === 'EBUSY') {
        errorMessage = 'File or directory is in use by another process. Close any applications using this path and try again.';
      } else if (error.code === 'ENOENT') {
        errorMessage = 'File or directory not found.';
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },

  // Add a method to calculate directory size with limited depth
  async getDirectorySize(dirPath: string, maxDepth = 2, currentDepth = 0): Promise<number> {
    if (currentDepth >= maxDepth || shouldSkipPath(dirPath)) {
      return 0;
    }
    
    try {
      let totalSize = 0;
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        try {
          const itemPath = path.join(dirPath, item);
          
          if (shouldSkipPath(itemPath)) {
            continue;
          }
          
          const stats = await fs.stat(itemPath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
          } else if (stats.isDirectory()) {
            totalSize += await this.getDirectorySize(itemPath, maxDepth, currentDepth + 1);
          }
        } catch (error) {
          // Ignore permission errors for individual files
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0; // Return 0 for directories we can't access
    }
  }
};

// Helper function to calculate directory size recursively with a depth limit
async function calculateDirectorySize(dirPath: string, maxDepth = 1): Promise<number> {
  if (maxDepth < 0) return 0;
  
  try {
    let totalSize = 0;
    let items: string[] = [];
    
    try {
      items = await fs.readdir(dirPath);
    } catch (error) {
      // If we can't read the directory, try to get the size of the directory itself
      try {
        const stats = await fs.stat(dirPath);
        return stats.size; // Return at least the directory entry size
      } catch (e) {
        // If we can't even stat the directory, return 0
        return 0;
      }
    }
    
    // Process each item in the directory
    for (const item of items) {
      // Skip obvious system files that are likely to cause permission issues
      if (item.startsWith('$') || 
          item === 'hiberfil.sys' || 
          item === 'pagefile.sys' || 
          item === 'swapfile.sys' ||
          item === 'DumpStack.log.tmp') {
        continue;
      }
      
      const itemPath = path.join(dirPath, item);
      
      try {
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory() && maxDepth > 0) {
          // For system directories with known permission issues, just estimate
          if (item === 'Windows' || 
              item === 'Program Files' || 
              item === 'Program Files (x86)' ||
              item === 'ProgramData') {
            // Add a reasonable estimate for system folders instead of scanning
            totalSize += 1024 * 1024 * 1024; // 1 GB estimate
            continue;
          }
          
          // Recursively calculate size with reduced depth
          const dirSize = await calculateDirectorySize(itemPath, maxDepth - 1);
          totalSize += dirSize;
        }
      } catch (error) {
        // Skip inaccessible files/directories
        // Don't log every skipped item to reduce console spam
        if (maxDepth > 0) {
          console.log(`Skipping inaccessible item: ${itemPath}`);
        }
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error(`Error calculating size for ${dirPath}:`, error);
    return 0;
  }
} 