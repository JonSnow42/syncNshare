import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as queueService from '../services/queue.service';

export async function getQueue(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const queue = await queueService.getRoomQueue(id);
    res.status(200).json({ queue });
  } catch (err) {
    next(err);
  }
}

export async function addItem(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { url } = req.body;
    const item = await queueService.addQueueItem(id, req.userId!, url);
    res.status(201).json({ item, message: 'Track added to queue.' });
  } catch (err) {
    next(err);
  }
}

export async function removeItem(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, itemId } = req.params;
    const result = await queueService.removeQueueItem(id, req.userId!, itemId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderQueue(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { itemIds } = req.body;
    const queue = await queueService.reorderQueue(id, req.userId!, itemIds);
    res.status(200).json({ queue });
  } catch (err) {
    next(err);
  }
}
