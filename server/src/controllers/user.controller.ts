import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as friendService from '../services/friend.service';

export async function searchUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = String(req.query.q || '');
    const limit = Number(req.query.limit) || 10;
    const users = await friendService.searchUsers(req.userId!, q, limit);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}
