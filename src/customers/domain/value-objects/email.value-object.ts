import { DomainValidationError } from "../errors/domain-validation.error";

export class Email {
  private constructor(private readonly email: string) {}

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new DomainValidationError("Email is invalid");
    }

    return new Email(normalized);
  }

  get value(): string {
    return this.email;
  }

  toString(): string {
    return this.email;
  }
}
