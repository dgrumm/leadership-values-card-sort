import { z } from 'zod';

/** Server-issued opaque participant identifier. Never derived from a display name. */
export const UuidSchema = z.uuid();
export type Uuid = z.infer<typeof UuidSchema>;
