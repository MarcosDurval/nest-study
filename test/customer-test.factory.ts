import {
  CreateCustomerProps,
  Customer,
} from "../src/customers/domain/entities/customer.entity";

export function makeCustomerProps(
  overrides: Partial<CreateCustomerProps> = {},
): CreateCustomerProps {
  return {
    name: "Ana Silva",
    email: "ana@example.com",
    phone: "+55 81 99999-9999",
    cpf: "529.982.247-25",
    address: {
      street: "Rua das Flores",
      number: "123",
      complement: "Apt 401",
      neighborhood: "Boa Viagem",
      city: "Recife",
      state: "PE",
      zipCode: "51020-000",
    },
    ...overrides,
  };
}

export function makeCustomer(
  overrides: Partial<CreateCustomerProps> = {},
): Customer {
  return Customer.create(makeCustomerProps(overrides));
}
