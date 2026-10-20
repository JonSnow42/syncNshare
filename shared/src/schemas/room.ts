import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z
    .string()
    .min(3, 'Room name must be at least 3 characters')
    .max(60, 'Room name cannot exceed 60 characters')
    .trim(),
  description: z
    .string()
    .max(250, 'Description cannot exceed 250 characters')
    .optional()
    .default(''),
  visibility: z.enum(['public', 'private']).default('public'),
  capacity: z
    .number()
    .int()
    .min(2, 'Room capacity must be at least 2')
    .max(100, 'Room capacity cannot exceed 100')
    .default(50),
  coverGradient: z
    .string()
    .optional()
    .default('from-violet-600 to-indigo-900'),
});

export const updateRoomSchema = z.object({
  name: z.string().min(3).max(60).trim().optional(),
  description: z.string().max(250).optional(),
  capacity: z.number().int().min(2).max(100).optional(),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().optional(),
});

export const inviteFriendSchema = z.object({
  friendUserId: z.string().min(1, 'Friend user ID is required'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type InviteFriendInput = z.infer<typeof inviteFriendSchema>;
