import { Router } from 'express';
import { diskController } from '../controllers/disk';

const router = Router();

// Mount points and drive info
router.get('/mounts', diskController.getMountPoints);

// Analyze a path
router.get('/analyze/:path', diskController.analyzePath);

// Delete a path
router.delete('/delete/:path', diskController.deletePath);

// Settings
router.get('/settings', diskController.getSettings);
router.post('/settings', diskController.updateSettings);

export default router; 