import { Inject, Injectable } from "@nestjs/common";
import { Customer } from "../../domain/entities/customer.entity";
import { CustomerNotFoundError } from "../errors/customer-not-found.error";
import {
  CUSTOMER_REPOSITORY,
  CustomerRepository,
} from "../ports/customer.repository";

@Injectable()
export class GetCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
  ) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);

    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    return customer;
  }
}
