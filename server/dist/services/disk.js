"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diskService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
exports.diskService = {
    async getMountPoints() {
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
        }
        catch (error) {
            console.error('Failed to get mount points:', error);
            return [];
        }
    },
    async analyzePath(path, showHidden) {
        async function analyzeItem(itemPath) {
            const stats = await (0, promises_1.stat)(itemPath);
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
            const children = [];
            let totalSize = 0;
            try {
                const items = await (0, promises_1.readdir)(itemPath);
                for (const item of items) {
                    try {
                        const child = await analyzeItem((0, path_1.join)(itemPath, item));
                        totalSize += child.size;
                        children.push(child);
                    }
                    catch (error) {
                        console.error(`Error analyzing ${item}:`, error);
                    }
                }
            }
            catch (error) {
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
    async deletePath(path) {
        await (0, promises_1.unlink)(path);
    }
};
