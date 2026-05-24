import { DomainValidationError } from "../src/customers/domain/errors/domain-validation.error";
import { Cpf } from "../src/customers/domain/value-objects/cpf.value-object";

describe("Cpf", () => {
  it("normalizes a valid CPF", () => {
    const cpf = Cpf.create("529.982.247-25");

    expect(cpf.value).toBe("52998224725");
  });

  it("rejects invalid check digits", () => {
    expect(() => Cpf.create("529.982.247-24")).toThrow(DomainValidationError);
  });

  it("rejects repeated digits", () => {
    expect(() => Cpf.create("111.111.111-11")).toThrow(DomainValidationError);
  });
});
