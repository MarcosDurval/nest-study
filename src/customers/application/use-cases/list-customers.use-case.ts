import { Inject, Injectable } from "@nestjs/common";
import {
  normalizePagination,
  PaginationInput,
} from "../../../shared/application/pagination";
import {
  CUSTOMER_REPOSITORY,
  CustomerListOrderBy,
  CustomerRepository,
  PaginatedCustomers,
} from "../ports/customer.repository";

export type ListCustomersUseCaseInput = PaginationInput<CustomerListOrderBy>;

@Injectable()
export class ListCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customers: CustomerRepository,
  ) {}

  async execute(
    input: ListCustomersUseCaseInput = {},
  ): Promise<PaginatedCustomers> {
    const pagination = normalizePagination({
      input,
      allowedOrderBy: Object.values(CustomerListOrderBy),
      defaultOrderBy: CustomerListOrderBy.CreatedAt,
    });

    return this.customers.findAll(pagination);
  }
}
