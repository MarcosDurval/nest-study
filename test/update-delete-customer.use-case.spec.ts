import { CustomerNotFoundError } from "../src/customers/application/errors/customer-not-found.error";
import { CustomerConflictError } from "../src/customers/application/errors/customer-conflict.error";
import {
  DeleteCustomerUseCase,
  UpdateCustomerUseCase,
} from "../src/customers/application/use-cases";
import { InMemoryCustomerRepository } from "./in-memory-customer.repository";
import { makeCustomer, makeCustomerProps } from "./customer-test.factory";

describe("UpdateCustomerUseCase and DeleteCustomerUseCase", () => {
  let repository: InMemoryCustomerRepository;

  beforeEach(() => {
    repository = new InMemoryCustomerRepository();
  });

  it("updates an existing customer", async () => {
    const customer = await repository.create(makeCustomer());

    const useCase = new UpdateCustomerUseCase(repository);
    const updated = await useCase.execute(customer.id, {
      name: "Ana Lima",
      email: "ana.lima@example.com",
    });

    expect(updated.name).toBe("Ana Lima");
    expect(updated.email).toBe("ana.lima@example.com");
  });

  it("does not report the current customer as a uniqueness conflict", async () => {
    const customer = await repository.create(makeCustomer());
    const conflictSpy = jest.spyOn(repository, "findUniqueConflict");

    const useCase = new UpdateCustomerUseCase(repository);
    const updated = await useCase.execute(customer.id, {
      name: "Ana Lima",
    });

    expect(updated.name).toBe("Ana Lima");
    expect(conflictSpy).toHaveBeenCalledWith({
      email: customer.email,
      cpf: customer.cpf,
      excludeCustomerId: customer.id,
    });
  });

  it("throws when updating to another customer's email", async () => {
    await repository.create(makeCustomer());
    const customer = await repository.create(
      makeCustomer({
        ...makeCustomerProps({
          email: "bruno@example.com",
          cpf: "111.444.777-35",
        }),
      }),
    );

    const useCase = new UpdateCustomerUseCase(repository);

    await expect(
      useCase.execute(customer.id, { email: "ana@example.com" }),
    ).rejects.toMatchObject({
      field: "email",
      name: "CustomerConflictError",
    } satisfies Partial<CustomerConflictError>);
  });

  it("throws when updating to another customer's CPF", async () => {
    await repository.create(makeCustomer());
    const customer = await repository.create(
      makeCustomer({
        ...makeCustomerProps({
          email: "bruno@example.com",
          cpf: "111.444.777-35",
        }),
      }),
    );

    const useCase = new UpdateCustomerUseCase(repository);

    await expect(
      useCase.execute(customer.id, { cpf: "529.982.247-25" }),
    ).rejects.toMatchObject({
      field: "cpf",
      name: "CustomerConflictError",
    } satisfies Partial<CustomerConflictError>);
  });

  it("throws when updating an unknown customer", async () => {
    const useCase = new UpdateCustomerUseCase(repository);

    await expect(
      useCase.execute("unknown", { name: "Nobody" }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it("deletes an existing customer", async () => {
    const customer = await repository.create(makeCustomer());

    const useCase = new DeleteCustomerUseCase(repository);
    await useCase.execute(customer.id);

    expect(await repository.findById(customer.id)).toBeNull();
  });

  it("throws when deleting an unknown customer", async () => {
    const useCase = new DeleteCustomerUseCase(repository);

    await expect(useCase.execute("unknown")).rejects.toThrow(
      CustomerNotFoundError,
    );
  });
});
