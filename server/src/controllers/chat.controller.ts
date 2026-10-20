import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as chatService from '../services/chat.service';

export async function getMessages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 50;
    const messages = await chatService.getRoomMessages(id, limit);
    res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const message = await chatService.sendMessage(id, req.userId!, content);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}
