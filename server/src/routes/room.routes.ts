import { Router } from 'express';
import * as roomController from '../controllers/room.controller';
import * as queueController from '../controllers/queue.controller';
import * as chatController from '../controllers/chat.controller';
import { requireAuth, optionalAuth } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  createRoomSchema,
  joinRoomSchema,
  inviteFriendSchema,
  addQueueItemSchema,
  reorderQueueSchema,
  sendMessageSchema,
} from '@syncnshare/shared';

const router = Router();

// Room listings & creation
router.get('/', roomController.listRooms);
router.post('/', requireAuth, validateBody(createRoomSchema), roomController.createRoom);

// Invitations for current user
router.get('/invitations/pending', requireAuth, roomController.listInvitations);
router.post('/invitations/:id/respond', requireAuth, roomController.respondInvitation);

// Single room operations
router.get('/:id', optionalAuth, roomController.getRoom);
router.post('/:id/join', requireAuth, validateBody(joinRoomSchema), roomController.joinRoom);
router.post('/:id/leave', requireAuth, roomController.leaveRoom);
router.post('/:id/invite', requireAuth, validateBody(inviteFriendSchema), roomController.inviteFriend);

// Queue endpoints
router.get('/:id/queue', optionalAuth, queueController.getQueue);
router.post('/:id/queue', requireAuth, validateBody(addQueueItemSchema), queueController.addItem);
router.delete('/:id/queue/:itemId', requireAuth, queueController.removeItem);
router.put('/:id/queue/reorder', requireAuth, validateBody(reorderQueueSchema), queueController.reorderQueue);

// Chat endpoints
router.get('/:id/messages', optionalAuth, chatController.getMessages);
router.post('/:id/messages', requireAuth, validateBody(sendMessageSchema), chatController.sendMessage);

export default router;
