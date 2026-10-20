import { RegisterInput, LoginInput, UserDTO } from '@syncnshare/shared';
import { User, IUser } from '../models/User';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError } from '../utils/errors';

export interface AuthResult {
  user: UserDTO;
  token: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError('An account with this email address already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const avatarSeed = encodeURIComponent(input.displayName);
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

  const user = await User.create({
    email,
    passwordHash,
    displayName: input.displayName.trim(),
    avatar,
  });

  const token = signToken({ userId: user._id.toString() });

  return {
    user: user.toDTO(),
    token,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const isValid = await verifyPassword(user.passwordHash, input.password);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const token = signToken({ userId: user._id.toString() });

  return {
    user: user.toDTO(),
    token,
  };
}

export async function getCurrentUser(userId: string): Promise<UserDTO> {
  const user = await User.findById(userId);
  if (!user) {
    throw new UnauthorizedError('User session expired or user not found.');
  }
  return user.toDTO();
}
