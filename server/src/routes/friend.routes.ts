import { Router } from 'express';
import * as friendController from '../controllers/friend.controller';
import { requireAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { sendFriendRequestSchema, respondFriendRequestSchema } from '@syncnshare/shared';

const router = Router();

router.use(requireAuth);

router.get('/', friendController.listFriends);
router.get('/requests', friendController.listPending);
router.post('/requests', validateBody(sendFriendRequestSchema), friendController.sendRequest);
router.post('/requests/:id/respond', validateBody(respondFriendRequestSchema), friendController.respondRequest);
router.delete('/:friendId', friendController.removeFriend);

export default router;
