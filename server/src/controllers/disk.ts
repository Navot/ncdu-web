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

export const diskController = {
  getMounts: async (req: Request, res: Response) => {
    try {
      const mounts = await diskService.getMountPoints();
      res.json(mounts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get mount points' });
    }
  },

  analyzePath: async (req: Request, res: Response) => {
    try {
      const { path } = req.params;
      const analysis = await diskService.analyzePath(path, settings.showHiddenFiles);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: 'Failed to analyze path' });
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