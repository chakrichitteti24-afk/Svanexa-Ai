import { Router } from 'express';
import { AnalyzeController } from '../controllers/analyze.controller';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, AnalyzeController.analyzeWellness);

export default router;
