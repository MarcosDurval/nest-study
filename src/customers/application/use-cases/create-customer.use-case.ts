import { Inject, Injectable } from "@nestjs/common";
import { Customer } from "../../domain/entities/customer.entity";
import { CreateCustomerUseCaseInput } from "../dtos/customer-use-case.dto";
import { CustomerConflictError } from "../errors/customer-conflict.error";
import {
  CUSTOMER_REPOSITORY,
  CustomerRepository,
} from "../ports/customer.repository";

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
  ) {}

  async execute(input: CreateCustomerUseCaseInput): Promise<Customer> {
    const customer = Customer.create(input);

    await this.ensureCustomerIsUnique(customer);

    return this.customers.create(customer);
  }

  private async ensureCustomerIsUnique(customer: Customer): Promise<void> {
    const conflict = await this.customers.findUniqueConflict({
      email: customer.email,
      cpf: customer.cpf,
    });

    if (conflict) {
      throw new CustomerConflictError(conflict.field);
    }
  }
}
