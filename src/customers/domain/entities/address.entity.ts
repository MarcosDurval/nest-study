import { DomainValidationError } from "../errors/domain-validation.error";

export type AddressProps = {
  id: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAddressProps = {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};

export type UpdateAddressProps = Partial<CreateAddressProps>;

export class Address {
  private constructor(private readonly props: AddressProps) {}

  static create(props: CreateAddressProps): Address {
    const now = new Date();

    return new Address({
      id: null,
      street: Address.required(props.street, "Street"),
      number: Address.required(props.number, "Number"),
      complement: Address.optional(props.complement),
      neighborhood: Address.required(props.neighborhood, "Neighborhood"),
      city: Address.required(props.city, "City"),
      state: Address.normalizeState(props.state),
      zipCode: Address.required(props.zipCode, "Zip code"),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AddressProps): Address {
    if (!props.id) {
      throw new DomainValidationError("Address id is required");
    }

    return new Address({
      ...props,
      street: Address.required(props.street, "Street"),
      number: Address.required(props.number, "Number"),
      complement: Address.optional(props.complement),
      neighborhood: Address.required(props.neighborhood, "Neighborhood"),
      city: Address.required(props.city, "City"),
      state: Address.normalizeState(props.state),
      zipCode: Address.required(props.zipCode, "Zip code"),
    });
  }

  update(props: UpdateAddressProps): void {
    if (props.street !== undefined) {
      this.props.street = Address.required(props.street, "Street");
    }

    if (props.number !== undefined) {
      this.props.number = Address.required(props.number, "Number");
    }

    if (props.complement !== undefined) {
      this.props.complement = Address.optional(props.complement);
    }

    if (props.neighborhood !== undefined) {
      this.props.neighborhood = Address.required(
        props.neighborhood,
        "Neighborhood",
      );
    }

    if (props.city !== undefined) {
      this.props.city = Address.required(props.city, "City");
    }

    if (props.state !== undefined) {
      this.props.state = Address.normalizeState(props.state);
    }

    if (props.zipCode !== undefined) {
      this.props.zipCode = Address.required(props.zipCode, "Zip code");
    }

    this.props.updatedAt = new Date();
  }

  toPlain(): AddressProps {
    return { ...this.props };
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

  private static normalizeState(state: string): string {
    const normalized = Address.required(state, "State").toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new DomainValidationError("State must have two letters");
    }

    return normalized;
  }
}
