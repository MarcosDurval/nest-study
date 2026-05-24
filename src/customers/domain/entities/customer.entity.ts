import {
  Address,
  AddressProps,
  CreateAddressProps,
  UpdateAddressProps,
} from "./address.entity";
import { DomainValidationError } from "../errors/domain-validation.error";
import { Cpf } from "../value-objects/cpf.value-object";
import { Email } from "../value-objects/email.value-object";

export type CustomerProps = {
  id: string | null;
  name: string;
  email: string;
  phone: string | null;
  cpf: string;
  address: Address | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerPlain = Omit<CustomerProps, "address"> & {
  address: AddressProps | null;
};

export type CreateCustomerProps = {
  name: string;
  email: string;
  phone?: string | null;
  cpf: string;
  address: CreateAddressProps;
};

export type UpdateCustomerProps = {
  name?: string;
  email?: string;
  phone?: string | null;
  cpf?: string;
  address?: UpdateAddressProps;
};

export class Customer {
  private constructor(private readonly props: CustomerProps) {}

  static create(props: CreateCustomerProps): Customer {
    const now = new Date();

    return new Customer({
      id: null,
      name: Customer.required(props.name, "Name"),
      email: Email.create(props.email).value,
      phone: Customer.optional(props.phone),
      cpf: Cpf.create(props.cpf).value,
      address: Address.create(props.address),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CustomerPlain): Customer {
    if (!props.id) {
      throw new DomainValidationError("Customer id is required");
    }

    return new Customer({
      ...props,
      name: Customer.required(props.name, "Name"),
      email: Email.create(props.email).value,
      phone: Customer.optional(props.phone),
      cpf: Cpf.create(props.cpf).value,
      address: props.address ? Address.reconstitute(props.address) : null,
    });
  }

  update(props: UpdateCustomerProps): void {
    if (props.name !== undefined) {
      this.props.name = Customer.required(props.name, "Name");
    }

    if (props.email !== undefined) {
      this.props.email = Email.create(props.email).value;
    }

    if (props.phone !== undefined) {
      this.props.phone = Customer.optional(props.phone);
    }

    if (props.cpf !== undefined) {
      this.props.cpf = Cpf.create(props.cpf).value;
    }

    if (props.address !== undefined) {
      if (!this.props.address) {
        throw new DomainValidationError("Customer address does not exist");
      }

      this.props.address.update(props.address);
    }

    this.props.updatedAt = new Date();
  }

  get id(): string {
    if (!this.props.id) {
      throw new DomainValidationError(
        "Customer id is not available before persistence",
      );
    }

    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get cpf(): string {
    return this.props.cpf;
  }

  get address(): Address | null {
    return this.props.address;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPlain(): CustomerPlain {
    return {
      ...this.props,
      address: this.props.address?.toPlain() ?? null,
    };
  }

  private static required(value: string, field: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new DomainValidationError(`${field} is required`);
    }

    return normalized;
  }

  private static optional(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
