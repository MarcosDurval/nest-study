import { Customer } from "../../domain/entities/customer.entity";
import {
  PageRequest,
  PaginatedResult,
} from "../../../shared/application/pagination";

export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");

export enum CustomerListOrderBy {
  CreatedAt = "createdAt",
  Email = "email",
  Name = "name",
}

export type CustomerPagination = PageRequest<CustomerListOrderBy>;
export type PaginatedCustomers = PaginatedResult<Customer, CustomerListOrderBy>;
export type CustomerUniqueConflictField = "email" | "cpf";
export type CustomerUniqueConflict = {
  field: CustomerUniqueConflictField;
  customerId: string;
};
export type CustomerUniqueConflictLookup = {
  email: string;
  cpf: string;
  excludeCustomerId?: string;
};

export interface CustomerRepository {
  create(customer: Customer): Promise<Customer>;
  save(customer: Customer): Promise<Customer>;
  findAll(pagination: CustomerPagination): Promise<PaginatedCustomers>;
  findById(id: string): Promise<Customer | null>;
  findUniqueConflict(
    lookup: CustomerUniqueConflictLookup,
  ): Promise<CustomerUniqueConflict | null>;
  delete(id: string): Promise<void>;
}
