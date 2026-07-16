import { InputValidationError } from "../src/shared/application/validation";
import {
  createCustomerInputValidator,
  updateCustomerInputValidator,
} from "../src/customers/presentation/graphql/customer-input.validators";
import { makeCustomerProps } from "./customer-test.factory";

describe("customer input validators", () => {
  it("normalizes create customer input", () => {
    const parsed = createCustomerInputValidator.validate({
      ...makeCustomerProps(),
      name: " Ana Silva ",
      email: " ana@example.com ",
      phone: " ",
      address: {
        ...makeCustomerProps().address,
        state: "pe",
        complement: "",
      },
    });

    expect(parsed.name).toBe("Ana Silva");
    expect(parsed.email).toBe("ana@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.address.state).toBe("PE");
    expect(parsed.address.complement).toBeNull();
  });

  it("rejects invalid create customer input", () => {
    expect(() =>
      createCustomerInputValidator.validate({
        ...makeCustomerProps(),
        name: "",
        email: "invalid",
        address: {
          ...makeCustomerProps().address,
          state: "pernambuco",
        },
      }),
    ).toThrow(InputValidationError);
  });

  it("rejects unknown fields with a library-independent error", () => {
    expect(() =>
      createCustomerInputValidator.validate({
        ...makeCustomerProps(),
        unknown: true,
      }),
    ).toThrow(InputValidationError);
  });

  it("normalizes update customer input", () => {
    const parsed = updateCustomerInputValidator.validate({
      name: " Ana Lima ",
      phone: "",
      address: {
        city: " Olinda ",
        state: "pe",
      },
    });

    expect(parsed.name).toBe("Ana Lima");
    expect(parsed.phone).toBeNull();
    expect(parsed.address?.city).toBe("Olinda");
    expect(parsed.address?.state).toBe("PE");
  });
});
