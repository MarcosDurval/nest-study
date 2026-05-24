import { Inject, Injectable } from "@nestjs/common";
import { CustomerNotFoundError } from "../errors/customer-not-found.error";
import {
  CUSTOMER_REPOSITORY,
  CustomerRepository,
} from "../ports/customer.repository";

@Injectable()
export class DeleteCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const customer = await this.customers.findById(id);

    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    await this.customers.delete(id);
  }
}
