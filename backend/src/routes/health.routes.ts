import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/summary', protect, HealthController.getHealthSummary);
router.post('/summary', protect, HealthController.getHealthSummary); // Maintain POST for legacy compat

router.get('/period-prediction', protect, HealthController.getPeriodPrediction);
router.post('/period-prediction', protect, HealthController.getPeriodPrediction);

export default router;
