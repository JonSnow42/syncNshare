import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  recipientId: z.string().min(1, 'Recipient user ID is required'),
});

export const respondFriendRequestSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export const searchUsersQuerySchema = z.object({
  q: z.string().min(1, 'Search query must have at least 1 character').max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type RespondFriendRequestInput = z.infer<typeof respondFriendRequestSchema>;
export type SearchUsersQueryInput = z.infer<typeof searchUsersQuerySchema>;
