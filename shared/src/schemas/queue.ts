import { z } from 'zod';

export const addQueueItemSchema = z.object({
  url: z
    .string()
    .url('Please provide a valid URL')
    .max(500, 'URL is too long')
    .trim(),
});

export const reorderQueueSchema = z.object({
  itemIds: z
    .array(z.string().min(1))
    .min(1, 'Item IDs list cannot be empty'),
});

export type AddQueueItemInput = z.infer<typeof addQueueItemSchema>;
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;
