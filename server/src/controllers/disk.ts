import { Request, Response } from 'express';
import { execFile } from 'child_process';
import { join } from 'path';
import { diskService } from '../services/disk';

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

export const diskController = {
  async getMountPoints(req: Request, res: Response): Promise<void> {
    try {
      const forceRefresh = req.query.forceRefresh === 'true';
      const result = await diskService.getMountPoints(forceRefresh);
      res.json(result);
    } catch (error) {
      console.error('Error getting mount points:', error);
      res.status(500).json({ error: 'Failed to get mount points' });
    }
  },

  async analyzePath(req: Request, res: Response): Promise<void> {
    try {
      const { path } = req.params;
      const forceRefresh = req.query.forceRefresh === 'true';
      
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const result = await diskService.analyzePath(path, forceRefresh);
      res.json(result);
    } catch (error) {
      console.error('Error analyzing path:', error);
      res.status(500).json({ error: 'Failed to analyze path' });
    }
  },

  async deletePath(req: Request, res: Response): Promise<void> {
    try {
      const { path } = req.params;
      
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      await diskService.deletePath(path);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting path:', error);
      res.status(500).json({ error: 'Failed to delete path' });
    }
  },

  updateSettings: (req: Request, res: Response) => {
    try {
      settings = { ...settings, ...req.body };
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  },

  getSettings: (req: Request, res: Response) => {
    res.json(settings);
  }
}; 