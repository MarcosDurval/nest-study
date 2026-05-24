import { Customer } from "../../domain/entities/customer.entity";
import { AddressType } from "./types/address.type";
import { CustomerType } from "./types/customer.type";

export class CustomerGraphqlMapper {
  static toType(customer: Customer): CustomerType {
    const plain = customer.toPlain();

    return {
      id: customer.id,
      name: plain.name,
      email: plain.email,
      phone: plain.phone,
      cpf: plain.cpf,
      address: plain.address ? this.toAddressType(plain.address) : null,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  }

  private static toAddressType(
    address: NonNullable<ReturnType<Customer["toPlain"]>["address"]>,
  ): AddressType {
    if (!address.id) {
      throw new Error("Address id is not available before persistence");
    }

    return {
      id: address.id,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
