import { Router } from 'express';
import authRoutes from './auth.routes';
import chatRoutes from './chat.routes';
import analyzeRoutes from './analyze.routes';
import wellnessPlanRoutes from './wellness-plan.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/analyze', analyzeRoutes);
router.use('/wellness-plan', wellnessPlanRoutes);
router.use('/health', healthRoutes);

export default router;
