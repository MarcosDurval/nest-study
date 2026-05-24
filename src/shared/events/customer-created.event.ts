import { z } from "zod";

export const CUSTOMER_CREATED_EVENT_TYPE = "customer.created";

export const customerCreatedEventSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export type CustomerCreatedEvent = z.infer<typeof customerCreatedEventSchema>;
