"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diskController = void 0;
const disk_1 = require("../services/disk");
let settings = {
    excludePaths: '/tmp,/proc,/sys',
    showHiddenFiles: false,
    autoRefresh: true,
    refreshInterval: 5,
    darkMode: false,
};
exports.diskController = {
    getMounts: async (req, res) => {
        try {
            const mounts = await disk_1.diskService.getMountPoints();
            res.json(mounts);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to get mount points' });
        }
    },
    analyzePath: async (req, res) => {
        try {
            const { path } = req.params;
            const analysis = await disk_1.diskService.analyzePath(path, settings.showHiddenFiles);
            res.json(analysis);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to analyze path' });
        }
    },
    updateSettings: (req, res) => {
        try {
            settings = { ...settings, ...req.body };
            res.json(settings);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update settings' });
        }
    },
    getSettings: (req, res) => {
        res.json(settings);
    }
};
