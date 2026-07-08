import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { signUpSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/auth.validation';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/signup', validate(signUpSchema), AuthController.signUp);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', protect, validate(resetPasswordSchema), AuthController.resetPassword); // Need protect to ensure user is verified before resetting via update
router.get('/me', protect, AuthController.me);

export default router;
