import { Module } from "@nestjs/common";
import { CUSTOMER_CREATED_PUBLISHER } from "./application/ports/customer-created-publisher";
import { CUSTOMER_REPOSITORY } from "./application/ports/customer.repository";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from "./application/use-cases";
import { RabbitMqCustomerCreatedPublisher } from "./infrastructure/messaging/rabbitmq-customer-created.publisher";
import { CustomerCreatedOutboxPublisher } from "./infrastructure/outbox/customer-created-outbox.publisher";
import { PrismaCustomerRepository } from "./infrastructure/prisma/prisma-customer.repository";
import { CustomersResolver } from "./presentation/graphql/customers.resolver";

@Module({
  providers: [
    CustomersResolver,
    CreateCustomerUseCase,
    ListCustomersUseCase,
    GetCustomerUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    CustomerCreatedOutboxPublisher,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },
    {
      provide: CUSTOMER_CREATED_PUBLISHER,
      useClass: RabbitMqCustomerCreatedPublisher,
    },
  ],
})
export class CustomersModule {}
