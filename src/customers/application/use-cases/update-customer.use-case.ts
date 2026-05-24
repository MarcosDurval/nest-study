import { Inject, Injectable } from "@nestjs/common";
import { Customer } from "../../domain/entities/customer.entity";
import { UpdateCustomerUseCaseInput } from "../dtos/customer-use-case.dto";
import { CustomerConflictError } from "../errors/customer-conflict.error";
import { CustomerNotFoundError } from "../errors/customer-not-found.error";
import {
  CUSTOMER_REPOSITORY,
  CustomerRepository,
} from "../ports/customer.repository";

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
  ) {}

  async execute(
    id: string,
    input: UpdateCustomerUseCaseInput,
  ): Promise<Customer> {
    const customer = await this.customers.findById(id);

    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    customer.update(input);
    await this.ensureCustomerIsUnique(customer, id);

    return this.customers.save(customer);
  }

  private async ensureCustomerIsUnique(
    customer: Customer,
    currentCustomerId: string,
  ): Promise<void> {
    const conflict = await this.customers.findUniqueConflict({
      email: customer.email,
      cpf: customer.cpf,
      excludeCustomerId: currentCustomerId,
    });

    if (conflict) {
      throw new CustomerConflictError(conflict.field);
    }
  }
}
