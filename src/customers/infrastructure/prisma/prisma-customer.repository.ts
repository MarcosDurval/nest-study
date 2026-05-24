import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CUSTOMER_CREATED_EVENT_TYPE } from "../../../shared/events/customer-created.event";
import { Customer } from "../../domain/entities/customer.entity";
import { CustomerConflictError } from "../../application/errors/customer-conflict.error";
import {
  CustomerListOrderBy,
  CustomerPagination,
  CustomerRepository,
  CustomerUniqueConflict,
  CustomerUniqueConflictLookup,
  PaginatedCustomers,
} from "../../application/ports/customer.repository";
import { PrismaService } from "../../../database/prisma.service";

type CustomerWithAddress = Prisma.CustomerGetPayload<{
  include: { address: true };
}>;

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(customer: Customer): Promise<Customer> {
    const plain = customer.toPlain();

    if (!plain.address) {
      throw new Error("Customer address is required");
    }

    const address = plain.address;

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const createdCustomer = await transaction.customer.create({
          data: {
            name: plain.name,
            email: plain.email,
            phone: plain.phone,
            cpf: plain.cpf,
            address: {
              create: {
                street: address.street,
                number: address.number,
                complement: address.complement,
                neighborhood: address.neighborhood,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
              },
            },
          },
          include: { address: true },
        });

        await transaction.outboxEvent.create({
          data: {
            eventType: CUSTOMER_CREATED_EVENT_TYPE,
            payload: {
              customerId: createdCustomer.id,
              name: createdCustomer.name,
              email: createdCustomer.email,
              createdAt: createdCustomer.createdAt.toISOString(),
            },
          },
        });

        return createdCustomer;
      });

      return this.toDomain(created);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async save(customer: Customer): Promise<Customer> {
    const plain = customer.toPlain();
    const customerId = customer.id;

    try {
      const updated = await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          name: plain.name,
          email: plain.email,
          phone: plain.phone,
          cpf: plain.cpf,
          address: plain.address
            ? {
                upsert: {
                  create: {
                    street: plain.address.street,
                    number: plain.address.number,
                    complement: plain.address.complement,
                    neighborhood: plain.address.neighborhood,
                    city: plain.address.city,
                    state: plain.address.state,
                    zipCode: plain.address.zipCode,
                  },
                  update: {
                    street: plain.address.street,
                    number: plain.address.number,
                    complement: plain.address.complement,
                    neighborhood: plain.address.neighborhood,
                    city: plain.address.city,
                    state: plain.address.state,
                    zipCode: plain.address.zipCode,
                  },
                },
              }
            : undefined,
        },
        include: { address: true },
      });

      return this.toDomain(updated);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(pagination: CustomerPagination): Promise<PaginatedCustomers> {
    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        include: { address: true },
        orderBy: this.toPrismaOrderBy(pagination),
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.customer.count(),
    ]);

    return {
      items: customers.map((customer) => this.toDomain(customer)),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      orderBy: pagination.orderBy,
      orderDirection: pagination.orderDirection,
    };
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { address: true },
    });

    return customer ? this.toDomain(customer) : null;
  }

  async findUniqueConflict(
    lookup: CustomerUniqueConflictLookup,
  ): Promise<CustomerUniqueConflict | null> {
    const customers = await this.prisma.customer.findMany({
      where: {
        id: lookup.excludeCustomerId
          ? { not: lookup.excludeCustomerId }
          : undefined,
        OR: [{ email: lookup.email }, { cpf: lookup.cpf }],
      },
      select: { id: true, email: true, cpf: true },
      take: 2,
    });

    const customerWithEmail = customers.find(
      (customer) => customer.email === lookup.email,
    );

    if (customerWithEmail) {
      return { field: "email", customerId: customerWithEmail.id };
    }

    const customerWithCpf = customers.find(
      (customer) => customer.cpf === lookup.cpf,
    );

    if (customerWithCpf) {
      return { field: "cpf", customerId: customerWithCpf.id };
    }

    return null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customer.delete({ where: { id } });
  }

  private toDomain(customer: CustomerWithAddress): Customer {
    return Customer.reconstitute({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpf: customer.cpf,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      address: customer.address
        ? {
            id: customer.address.id,
            street: customer.address.street,
            number: customer.address.number,
            complement: customer.address.complement,
            neighborhood: customer.address.neighborhood,
            city: customer.address.city,
            state: customer.address.state,
            zipCode: customer.address.zipCode,
            createdAt: customer.address.createdAt,
            updatedAt: customer.address.updatedAt,
          }
        : null,
    });
  }

  private toPrismaOrderBy(
    pagination: CustomerPagination,
  ): Prisma.CustomerOrderByWithRelationInput[] {
    const primaryOrderBy: Prisma.CustomerOrderByWithRelationInput =
      pagination.orderBy === CustomerListOrderBy.CreatedAt
        ? { createdAt: pagination.orderDirection }
        : pagination.orderBy === CustomerListOrderBy.Email
          ? { email: pagination.orderDirection }
          : { name: pagination.orderDirection };

    return [primaryOrderBy, { id: pagination.orderDirection }];
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");

        if (target.includes("email")) {
          throw new CustomerConflictError("email");
        }

        if (target.includes("cpf")) {
          throw new CustomerConflictError("cpf");
        }

        throw new CustomerConflictError("emailOrCpf");
      }
    }

    throw error;
  }
}
