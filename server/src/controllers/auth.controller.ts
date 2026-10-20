import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { setAuthCookie, clearAuthCookie } from '../utils/jwt';
import { AuthenticatedRequest } from '../middlewares/auth';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.register(req.body);
    setAuthCookie(res, token);
    res.status(201).json({ user, token, message: 'Account registered successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.login(req.body);
    setAuthCookie(res, token);
    res.status(200).json({ user, token, message: 'Logged in successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    clearAuthCookie(res);
    res.status(200).json({ ok: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userDTO = req.user!.toDTO();
    res.status(200).json({ user: userDTO });
  } catch (err) {
    next(err);
  }
}
