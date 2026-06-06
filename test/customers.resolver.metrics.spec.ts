import { BadRequestException, ConflictException } from "@nestjs/common";
import { CustomerConflictError } from "../src/customers/application/errors/customer-conflict.error";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from "../src/customers/application/use-cases";
import { Customer } from "../src/customers/domain/entities/customer.entity";
import { DomainValidationError } from "../src/customers/domain/errors/domain-validation.error";
import { CustomersResolver } from "../src/customers/presentation/graphql/customers.resolver";
import { CreateCustomerInput } from "../src/customers/presentation/graphql/inputs/create-customer.input";
import { CustomerMetrics } from "../src/observability/customer.metrics";
import { makeCustomerProps } from "./customer-test.factory";

describe("CustomersResolver Customer Creation metrics", () => {
  let createCustomerUseCase: jest.Mocked<CreateCustomerUseCase>;
  let customerMetrics: jest.Mocked<CustomerMetrics>;
  let resolver: CustomersResolver;

  beforeEach(() => {
    createCustomerUseCase = {
      execute: jest.fn().mockResolvedValue(makePersistedCustomer()),
    } as unknown as jest.Mocked<CreateCustomerUseCase>;

    customerMetrics = {
      recordCreation: jest.fn(),
      observeCreationDuration: jest.fn(),
    } as unknown as jest.Mocked<CustomerMetrics>;

    resolver = new (CustomersResolver as unknown as new (
      createCustomerUseCase: CreateCustomerUseCase,
      listCustomersUseCase: ListCustomersUseCase,
      getCustomerUseCase: GetCustomerUseCase,
      updateCustomerUseCase: UpdateCustomerUseCase,
      deleteCustomerUseCase: DeleteCustomerUseCase,
      customerMetrics: CustomerMetrics,
    ) => CustomersResolver)(
      createCustomerUseCase,
      {} as ListCustomersUseCase,
      {} as GetCustomerUseCase,
      {} as UpdateCustomerUseCase,
      {} as DeleteCustomerUseCase,
      customerMetrics,
    );
  });

  it("records successful Customer Creation", async () => {
    await resolver.createCustomer(validInput());

    expect(customerMetrics.recordCreation).toHaveBeenCalledWith(
      "success",
      "none",
    );
    expect(customerMetrics.observeCreationDuration).toHaveBeenCalledWith(
      "success",
      expect.any(Number),
    );
  });

  it("records validation failures", async () => {
    await expect(
      resolver.createCustomer({ ...validInput(), email: "invalid" }),
    ).rejects.toThrow(BadRequestException);

    expect(customerMetrics.recordCreation).toHaveBeenCalledWith(
      "failure",
      "validation_error",
    );
    expect(customerMetrics.observeCreationDuration).toHaveBeenCalledWith(
      "failure",
      expect.any(Number),
    );
  });

  it("records conflict failures", async () => {
    createCustomerUseCase.execute.mockRejectedValueOnce(
      new CustomerConflictError("email"),
    );

    await expect(resolver.createCustomer(validInput())).rejects.toThrow(
      ConflictException,
    );

    expect(customerMetrics.recordCreation).toHaveBeenCalledWith(
      "failure",
      "conflict",
    );
    expect(customerMetrics.observeCreationDuration).toHaveBeenCalledWith(
      "failure",
      expect.any(Number),
    );
  });

  it("records domain failures", async () => {
    createCustomerUseCase.execute.mockRejectedValueOnce(
      new DomainValidationError("CPF is invalid"),
    );

    await expect(resolver.createCustomer(validInput())).rejects.toThrow(
      BadRequestException,
    );

    expect(customerMetrics.recordCreation).toHaveBeenCalledWith(
      "failure",
      "domain_error",
    );
    expect(customerMetrics.observeCreationDuration).toHaveBeenCalledWith(
      "failure",
      expect.any(Number),
    );
  });

  it("records unexpected failures", async () => {
    createCustomerUseCase.execute.mockRejectedValueOnce(new Error("boom"));

    await expect(resolver.createCustomer(validInput())).rejects.toThrow("boom");

    expect(customerMetrics.recordCreation).toHaveBeenCalledWith(
      "failure",
      "unexpected_error",
    );
    expect(customerMetrics.observeCreationDuration).toHaveBeenCalledWith(
      "failure",
      expect.any(Number),
    );
  });

  function validInput(): CreateCustomerInput {
    return makeCustomerProps() as CreateCustomerInput;
  }

  function makePersistedCustomer(): Customer {
    const now = new Date("2026-05-18T12:00:00.000Z");

    return Customer.reconstitute({
      id: "customer-id",
      name: "Ana Silva",
      email: "ana@example.com",
      phone: "+55 81 99999-9999",
      cpf: "52998224725",
      address: {
        id: "address-id",
        street: "Rua das Flores",
        number: "123",
        complement: "Apt 401",
        neighborhood: "Boa Viagem",
        city: "Recife",
        state: "PE",
        zipCode: "51020-000",
        createdAt: now,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });
  }
});
