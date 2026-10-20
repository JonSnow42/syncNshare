import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth';
import { validateQuery } from '../middlewares/validate';
import { searchUsersQuerySchema } from '@syncnshare/shared';

const router = Router();

router.get('/search', requireAuth, validateQuery(searchUsersQuerySchema), userController.searchUsers);

export default router;
