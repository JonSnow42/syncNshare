import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message cannot exceed 500 characters')
    .trim(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
