import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as friendService from '../services/friend.service';

export async function listFriends(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const friends = await friendService.listFriends(req.userId!);
    res.status(200).json({ friends });
  } catch (err) {
    next(err);
  }
}

export async function listPending(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pending = await friendService.listPendingRequests(req.userId!);
    res.status(200).json(pending);
  } catch (err) {
    next(err);
  }
}

export async function sendRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { recipientId } = req.body;
    const request = await friendService.sendFriendRequest(req.userId!, recipientId);
    res.status(201).json({ request, message: 'Friend request sent.' });
  } catch (err) {
    next(err);
  }
}

export async function respondRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const result = await friendService.respondFriendRequest(req.userId!, id, action);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeFriend(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { friendId } = req.params;
    await friendService.removeFriend(req.userId!, friendId);
    res.status(200).json({ ok: true, message: 'Friend removed.' });
  } catch (err) {
    next(err);
  }
}
