import { cpf as cpfValidator } from "cpf-cnpj-validator";

import { DomainValidationError } from "../errors/domain-validation.error";

export class Cpf {
  private constructor(private readonly cpf: string) {}

  static create(value: string): Cpf {
    const normalized = Cpf.normalize(value);

    if (!cpfValidator.isValid(normalized)) {
      throw new DomainValidationError("CPF is invalid");
    }

    return new Cpf(normalized);
  }

  static normalize(value: string): string {
    return cpfValidator.strip(value);
  }

  get value(): string {
    return this.cpf;
  }

  toString(): string {
    return this.cpf;
  }
}
