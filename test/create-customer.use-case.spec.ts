import { CustomerConflictError } from "../src/customers/application/errors/customer-conflict.error";
import { CreateCustomerUseCase } from "../src/customers/application/use-cases";
import { InMemoryCustomerRepository } from "./in-memory-customer.repository";
import { makeCustomer, makeCustomerProps } from "./customer-test.factory";

describe("CreateCustomerUseCase", () => {
  let repository: InMemoryCustomerRepository;
  let useCase: CreateCustomerUseCase;

  beforeEach(() => {
    repository = new InMemoryCustomerRepository();
    useCase = new CreateCustomerUseCase(repository);
  });

  it("creates a customer", async () => {
    const conflictSpy = jest.spyOn(repository, "findUniqueConflict");

    const customer = await useCase.execute(makeCustomerProps());

    expect(conflictSpy).toHaveBeenCalledWith({
      email: "ana@example.com",
      cpf: "52998224725",
    });
    expect(await repository.findById(customer.id)).toBe(customer);
  });

  it("does not create when email already exists", async () => {
    await repository.create(makeCustomer());

    await expect(useCase.execute(makeCustomerProps())).rejects.toMatchObject({
      field: "email",
      name: "CustomerConflictError",
    } satisfies Partial<CustomerConflictError>);
  });

  it("does not create when CPF already exists", async () => {
    await repository.create(makeCustomer());

    await expect(
      useCase.execute(
        makeCustomerProps({
          email: "other@example.com",
        }),
      ),
    ).rejects.toMatchObject({
      field: "cpf",
      name: "CustomerConflictError",
    } satisfies Partial<CustomerConflictError>);
  });
});
