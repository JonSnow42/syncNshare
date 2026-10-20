import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';
import { registerSchema, loginSchema } from '@syncnshare/shared';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), authController.register);
router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
