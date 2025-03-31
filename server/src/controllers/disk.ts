import { Request, Response } from 'express';
import { execFile } from 'child_process';
import { join } from 'path';
import { diskService } from '../services/disk';
import path from 'path';

let settings = {
  excludePaths: '/tmp,/proc,/sys',
  showHiddenFiles: false,
  autoRefresh: true,
  refreshInterval: 5,
  darkMode: false,
};

// Initialize cache when the server starts
diskService.initializeCache().catch(error => {
  console.error('Failed to initialize disk cache:', error);
});

// Get mount points (disk drives)
export async function getMounts(req: Request, res: Response) {
  try {
    const forceRefresh = req.query.forceRefresh === 'true';
    const result = await diskService.getMounts(forceRefresh);
    res.json(result);
  } catch (error) {
    console.error('Error getting mounts:', error);
    res.status(500).json({ error: 'Failed to get mount points' });
  }
}

// Analyze a specific path
export async function analyzePath(req: Request, res: Response) {
  try {
    const { path: targetPath } = req.params;
    const forceRefresh = req.query.forceRefresh === 'true';
    
    // Make sure paths are properly formatted for Windows
    let formattedPath = decodeURIComponent(targetPath);
    
    // For drive letters, make sure they have a colon
    if (formattedPath.length === 1 && /[a-zA-Z]/.test(formattedPath)) {
      formattedPath = `${formattedPath}:`;
    }
    
    // Make sure the path is an absolute path if it's not a drive letter
    if (!formattedPath.includes(':')) {
      console.log(`Converting relative path ${formattedPath} to absolute path`);
      formattedPath = path.resolve(formattedPath);
    }
    
    console.log(`Analyzing path: ${formattedPath} (force refresh: ${forceRefresh})`);
    
    const result = await diskService.analyzePath(formattedPath, forceRefresh);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing path:', error);
    res.status(500).json({ error: 'Failed to analyze path' });
  }
}

// Delete a path
export async function deletePath(req: Request, res: Response) {
  try {
    const { path: targetPath } = req.params;
    
    // Decode the path and ensure it's properly formatted
    const formattedPath = decodeURIComponent(targetPath);
    
    const result = await diskService.deletePath(formattedPath);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error deleting path:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete path',
      error: error.message
    });
  }
}

// Get settings
export async function getSettings(req: Request, res: Response) {
  try {
    const settings = await diskService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
}

// Update settings
export async function updateSettings(req: Request, res: Response) {
  try {
    const settings = req.body;
    const result = await diskService.updateSettings(settings);
    res.json(result);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

export const diskController = {
  getMountPoints: getMounts,
  analyzePath: analyzePath,
  deletePath: deletePath,
  updateSettings: updateSettings,
  getSettings: getSettings
}; 