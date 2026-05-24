import { CustomerCreatedEvent } from "../../../shared/events/customer-created.event";

export const CUSTOMER_CREATED_PUBLISHER = Symbol("CUSTOMER_CREATED_PUBLISHER");

export type CustomerCreatedPublishOptions = {
  messageId?: string;
};

export interface CustomerCreatedPublisher {
  publish(
    event: CustomerCreatedEvent,
    options?: CustomerCreatedPublishOptions,
  ): Promise<void>;
}
