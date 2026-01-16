import { z } from 'zod';

// Pagination
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

// API Response wrappers
export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

// Contact API types
export const createContactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  jobTitle: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  status: z.enum(['available', 'active']).default('available'),
  context: z.string().optional(),
  group: z.enum(['work', 'personal']).optional(),
  cadenceMonths: z.number().int().min(1).max(36).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const promoteContactSchema = z.object({
  context: z.string().min(1),
  group: z.enum(['work', 'personal']).optional(),
  cadenceMonths: z.number().int().min(1).max(36).optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type PromoteContactInput = z.infer<typeof promoteContactSchema>;
