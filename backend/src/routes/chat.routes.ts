import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, ChatController.handleChat);

export default router;
