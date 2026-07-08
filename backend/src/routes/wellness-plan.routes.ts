import { Router } from 'express';
import { WellnessPlanController } from '../controllers/wellness-plan.controller';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/', protect, WellnessPlanController.getOrCreate);
router.post('/', protect, WellnessPlanController.generatePlan);
router.patch('/toggle/:planId/:taskId', protect, WellnessPlanController.toggleTask);

export default router;
