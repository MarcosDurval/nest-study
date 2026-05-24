import { DomainValidationError } from "../src/customers/domain/errors/domain-validation.error";
import { Customer } from "../src/customers/domain/entities/customer.entity";
import { makeCustomerProps } from "./customer-test.factory";

describe("Customer", () => {
  it("normalizes email, CPF and address state when created", () => {
    const customer = Customer.create(
      makeCustomerProps({
        email: " ANA@Example.COM ",
        cpf: "529.982.247-25",
        address: {
          ...makeCustomerProps().address,
          state: "pe",
        },
      }),
    );

    expect(customer.email).toBe("ana@example.com");
    expect(customer.cpf).toBe("52998224725");
    expect(customer.address?.toPlain().state).toBe("PE");
  });

  it("requires a valid CPF", () => {
    expect(() =>
      Customer.create(makeCustomerProps({ cpf: "123.456.789-00" })),
    ).toThrow(DomainValidationError);
  });

  it("updates customer and address data", () => {
    const customer = Customer.create(makeCustomerProps());

    customer.update({
      name: "Ana Lima",
      phone: null,
      address: {
        city: "Olinda",
        state: "pe",
      },
    });

    expect(customer.name).toBe("Ana Lima");
    expect(customer.phone).toBeNull();
    expect(customer.address?.toPlain().city).toBe("Olinda");
    expect(customer.address?.toPlain().state).toBe("PE");
  });
});
