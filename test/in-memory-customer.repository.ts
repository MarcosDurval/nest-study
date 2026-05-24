import { randomUUID } from "crypto";
import { Customer } from "../src/customers/domain/entities/customer.entity";
import { SortDirection } from "../src/shared/application/pagination";
import {
  CustomerListOrderBy,
  CustomerPagination,
  CustomerRepository,
  CustomerUniqueConflict,
  CustomerUniqueConflictLookup,
  PaginatedCustomers,
} from "../src/customers/application/ports/customer.repository";

export class InMemoryCustomerRepository implements CustomerRepository {
  readonly customers = new Map<string, Customer>();

  async create(customer: Customer): Promise<Customer> {
    const plain = customer.toPlain();
    const created = Customer.reconstitute({
      ...plain,
      id: plain.id ?? randomUUID(),
      address: plain.address
        ? {
            ...plain.address,
            id: plain.address.id ?? randomUUID(),
          }
        : null,
    });

    this.customers.set(created.id, created);
    return created;
  }

  async save(customer: Customer): Promise<Customer> {
    this.customers.set(customer.id, customer);
    return customer;
  }

  async findAll(pagination: CustomerPagination): Promise<PaginatedCustomers> {
    const sortedCustomers = [...this.customers.values()].sort((left, right) =>
      this.compareCustomers(left, right, pagination),
    );
    const items = sortedCustomers.slice(
      pagination.offset,
      pagination.offset + pagination.limit,
    );

    return {
      items,
      total: this.customers.size,
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: pagination.orderBy,
      orderDirection: pagination.orderDirection,
    };
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customers.get(id) ?? null;
  }

  async findUniqueConflict(
    lookup: CustomerUniqueConflictLookup,
  ): Promise<CustomerUniqueConflict | null> {
    const customers = [...this.customers.values()].filter(
      (customer) =>
        customer.id !== lookup.excludeCustomerId &&
        (customer.email === lookup.email || customer.cpf === lookup.cpf),
    );

    const customerWithEmail = customers.find(
      (customer) => customer.email === lookup.email,
    );

    if (customerWithEmail) {
      return { field: "email", customerId: customerWithEmail.id };
    }

    const customerWithCpf = customers.find(
      (customer) => customer.cpf === lookup.cpf,
    );

    if (customerWithCpf) {
      return { field: "cpf", customerId: customerWithCpf.id };
    }

    return null;
  }

  async delete(id: string): Promise<void> {
    this.customers.delete(id);
  }

  private compareCustomers(
    left: Customer,
    right: Customer,
    pagination: CustomerPagination,
  ): number {
    const direction = pagination.orderDirection === SortDirection.Asc ? 1 : -1;
    const primaryComparison =
      this.getComparableValue(left, pagination.orderBy) >
      this.getComparableValue(right, pagination.orderBy)
        ? 1
        : this.getComparableValue(left, pagination.orderBy) <
            this.getComparableValue(right, pagination.orderBy)
          ? -1
          : 0;

    if (primaryComparison !== 0) {
      return primaryComparison * direction;
    }

    return left.id.localeCompare(right.id) * direction;
  }

  private getComparableValue(
    customer: Customer,
    orderBy: CustomerListOrderBy,
  ): string | number {
    if (orderBy === CustomerListOrderBy.CreatedAt) {
      return customer.createdAt.getTime();
    }

    if (orderBy === CustomerListOrderBy.Email) {
      return customer.email;
    }

    return customer.name;
  }
}
