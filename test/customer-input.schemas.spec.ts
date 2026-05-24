import { ZodError } from "zod";
import {
  createCustomerInputSchema,
  updateCustomerInputSchema,
} from "../src/customers/presentation/graphql/customer-input.schemas";
import { makeCustomerProps } from "./customer-test.factory";

describe("customer input schemas", () => {
  it("normalizes create customer input", () => {
    const parsed = createCustomerInputSchema.parse({
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
      createCustomerInputSchema.parse({
        ...makeCustomerProps(),
        name: "",
        email: "invalid",
        address: {
          ...makeCustomerProps().address,
          state: "pernambuco",
        },
      }),
    ).toThrow(ZodError);
  });

  it("normalizes update customer input", () => {
    const parsed = updateCustomerInputSchema.parse({
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
