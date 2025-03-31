import os from 'os';
import { exec } from 'child_process';
import util from 'util';

export const execAsync = util.promisify(exec);

export interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux' | 'unknown';
  pathSeparator: string;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
}

// Detect the current platform
export const platform: PlatformInfo = {
  os: os.platform() === 'win32' ? 'windows' 
     : os.platform() === 'darwin' ? 'macos'
     : os.platform() === 'linux' ? 'linux'
     : 'unknown',
  pathSeparator: os.platform() === 'win32' ? '\\' : '/',
  isWindows: os.platform() === 'win32',
  isMac: os.platform() === 'darwin',
  isLinux: os.platform() === 'linux'
};

// Get drives/volumes command based on platform
export function getDrivesCommand(): string {
  if (platform.isWindows) {
    return 'wmic logicaldisk get caption,size,freespace,volumename /format:csv';
  } else if (platform.isMac) {
    return 'df -k | grep -v "map " | grep -v "/dev/loop"';
  } else if (platform.isLinux) {
    return 'df -k --output=source,fstype,size,used,avail,target | grep -v "tmpfs" | grep -v "udev" | grep -v "/dev/loop"';
  }
  return 'echo "Unsupported platform"';
}

// Parse drives output based on platform
export function parseDrivesOutput(output: string): Array<{
  name: string;
  path: string;
  total: number;
  used: number;
  available: number;
}> {
  if (platform.isWindows) {
    // Parse Windows wmic CSV output
    const lines = output.trim().split('\n').slice(1);
    return lines.map(line => {
      const parts = line.trim().split(',');
      if (parts.length < 3) return null;
      
      const caption = parts[1];  // Drive letter
      const freeSpace = parts[2]; // Free space
      const size = parts[3];     // Total size
      const volumeName = parts.length > 4 ? parts[4] : '';
      
      const total = parseInt(size) || 0;
      const available = parseInt(freeSpace) || 0;
      const used = total - available;
      
      return {
        name: volumeName ? `${volumeName} (${caption})` : caption,
        path: caption,
        total,
        used,
        available
      };
    }).filter(item => item !== null);
  } else if (platform.isMac) {
    // Parse macOS df output
    const lines = output.trim().split('\n');
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      
      const device = parts[0];
      const total = parseInt(parts[1]) * 1024; // KB to bytes
      const used = parseInt(parts[2]) * 1024; // KB to bytes
      const available = parseInt(parts[3]) * 1024; // KB to bytes
      const mountPath = parts[8] || parts[5]; // Different position depending on output format
      
      // Skip system volumes we don't want to analyze
      if (mountPath === '/private/var/vm' || mountPath === '/dev' || 
          mountPath.startsWith('/System/Volumes') || mountPath === '/') {
        return null;
      }
      
      return {
        name: mountPath,
        path: mountPath,
        total,
        used,
        available
      };
    }).filter(item => item !== null);
  } else if (platform.isLinux) {
    // Parse Linux df output
    const lines = output.trim().split('\n').slice(1); // Skip header
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      
      const device = parts[0];
      const fsType = parts[1];
      const total = parseInt(parts[2]) * 1024; // KB to bytes
      const used = parseInt(parts[3]) * 1024; // KB to bytes
      const available = parseInt(parts[4]) * 1024; // KB to bytes
      const mountPath = parts[5];
      
      // Skip system paths
      if (mountPath === '/boot' || mountPath === '/dev' || 
          mountPath === '/proc' || mountPath === '/sys') {
        return null;
      }
      
      return {
        name: mountPath,
        path: mountPath,
        total,
        used,
        available
      };
    }).filter(item => item !== null);
  }
  
  return [];
}

// Get home directory path
export function getHomeDir(): string {
  return os.homedir();
}

// Normalize path based on platform
export function normalizePath(path: string): string {
  if (platform.isWindows) {
    // Handle Windows paths
    return path;
  } else {
    // Handle Unix paths
    if (path === 'root') {
      return '/';
    }
    return path;
  }
}

// Get system directories to skip based on platform
export function getSystemDirs(): string[] {
  if (platform.isWindows) {
    return [
      '$Recycle.Bin',
      'System Volume Information',
      'pagefile.sys',
      'hiberfil.sys',
      'swapfile.sys',
    ];
  } else if (platform.isMac) {
    return [
      '.Spotlight-V100',
      '.Trashes',
      '.fseventsd',
      'System',
      'private',
      'dev',
      'cores'
    ];
  } else {
    // Linux
    return [
      'proc',
      'sys',
      'dev',
      'run',
      'boot'
    ];
  }
}

// Is path a system path that should be skipped?
export function isSystemPath(path: string): boolean {
  const systemDirs = getSystemDirs();
  
  for (const dir of systemDirs) {
    if (path.includes(dir)) {
      return true;
    }
  }
  
  // Platform-specific checks
  if (platform.isWindows) {
    // Windows-specific system paths
    if (path.includes('\\Windows\\') && 
        (path.includes('\\System32\\') || 
         path.includes('\\SysWOW64\\') ||
         path.includes('\\Temp\\'))) {
      return true;
    }
  } else if (platform.isMac) {
    // macOS-specific system paths
    if (path.includes('/System/') || 
        path.includes('/Library/') || 
        path.includes('/.') ||
        path.includes('/private/var/')) {
      return true;
    }
  }
  
  return false;
} 