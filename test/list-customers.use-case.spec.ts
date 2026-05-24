import {
  InvalidPaginationError,
  SortDirection,
} from "../src/shared/application/pagination";
import { CustomerListOrderBy } from "../src/customers/application/ports/customer.repository";
import { ListCustomersUseCase } from "../src/customers/application/use-cases";
import { makeCustomer } from "./customer-test.factory";
import { InMemoryCustomerRepository } from "./in-memory-customer.repository";

describe("ListCustomersUseCase", () => {
  it("returns a paginated customers page", async () => {
    const repository = new InMemoryCustomerRepository();
    await repository.create(makeCustomer({ email: "ana@example.com" }));
    await repository.create(
      makeCustomer({
        email: "bia@example.com",
        cpf: "153.509.460-56",
      }),
    );
    await repository.create(
      makeCustomer({
        email: "caio@example.com",
        cpf: "111.444.777-35",
      }),
    );

    const useCase = new ListCustomersUseCase(repository);
    const page = await useCase.execute({ limit: 2, offset: 1 });

    expect(page.total).toBe(3);
    expect(page.limit).toBe(2);
    expect(page.offset).toBe(1);
    expect(page.items).toHaveLength(2);
    expect(page.orderBy).toBe(CustomerListOrderBy.CreatedAt);
    expect(page.orderDirection).toBe(SortDirection.Desc);
  });

  it("applies default pagination and ordering inside the use case", async () => {
    const repository = new InMemoryCustomerRepository();
    await repository.create(makeCustomer());

    const useCase = new ListCustomersUseCase(repository);
    const page = await useCase.execute();

    expect(page.limit).toBe(20);
    expect(page.offset).toBe(0);
    expect(page.orderBy).toBe(CustomerListOrderBy.CreatedAt);
    expect(page.orderDirection).toBe(SortDirection.Desc);
  });

  it("sorts deterministically by the requested order", async () => {
    const repository = new InMemoryCustomerRepository();
    await repository.create(
      makeCustomer({
        name: "Caio",
        email: "caio@example.com",
      }),
    );
    await repository.create(
      makeCustomer({
        name: "Ana",
        email: "ana@example.com",
        cpf: "153.509.460-56",
      }),
    );
    await repository.create(
      makeCustomer({
        name: "Bia",
        email: "bia@example.com",
        cpf: "111.444.777-35",
      }),
    );

    const useCase = new ListCustomersUseCase(repository);
    const page = await useCase.execute({
      limit: 3,
      offset: 0,
      orderBy: CustomerListOrderBy.Email,
      orderDirection: SortDirection.Asc,
    });

    expect(page.items.map((customer) => customer.email)).toEqual([
      "ana@example.com",
      "bia@example.com",
      "caio@example.com",
    ]);
  });

  it("rejects invalid pagination in the use case", async () => {
    const useCase = new ListCustomersUseCase(new InMemoryCustomerRepository());

    await expect(useCase.execute({ limit: 101 })).rejects.toThrow(
      InvalidPaginationError,
    );
  });
});
