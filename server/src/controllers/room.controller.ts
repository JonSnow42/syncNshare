import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as roomService from '../services/room.service';

export async function createRoom(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const room = await roomService.createRoom(req.userId!, req.body);
    res.status(201).json({ room, message: 'Room created successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function listRooms(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const rooms = await roomService.listPublicRooms(search);
    res.status(200).json({ rooms });
  } catch (err) {
    next(err);
  }
}

export async function getRoom(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const roomDetail = await roomService.getRoomDetail(id, req.userId);
    res.status(200).json(roomDetail);
  } catch (err) {
    next(err);
  }
}

export async function joinRoom(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { inviteCode } = req.body || {};
    const result = await roomService.joinRoom(id, req.userId!, inviteCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function leaveRoom(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    await roomService.leaveRoom(id, req.userId!);
    res.status(200).json({ ok: true, message: 'Left room successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function inviteFriend(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { friendUserId } = req.body;
    const invitation = await roomService.inviteFriendToRoom(id, req.userId!, friendUserId);
    res.status(201).json({ invitation, message: 'Friend invited to room.' });
  } catch (err) {
    next(err);
  }
}

export async function listInvitations(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const invitations = await roomService.listPendingInvitations(req.userId!);
    res.status(200).json({ invitations });
  } catch (err) {
    next(err);
  }
}

export async function respondInvitation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const result = await roomService.respondToInvitation(id, req.userId!, action);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
