import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ZodError } from "zod";
import { CustomerMetrics } from "../../../observability/customer.metrics";
import { InvalidPaginationError } from "../../../shared/application/pagination";
import { DomainValidationError } from "../../domain/errors/domain-validation.error";
import { CustomerConflictError } from "../../application/errors/customer-conflict.error";
import { CustomerNotFoundError } from "../../application/errors/customer-not-found.error";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from "../../application/use-cases";
import { CustomerGraphqlMapper } from "./customer-graphql.mapper";
import { CustomerListOrderBy, SortDirection } from "./customer-list-order.enum";
import {
  createCustomerInputSchema,
  updateCustomerInputSchema,
} from "./customer-input.schemas";
import { CreateCustomerInput } from "./inputs/create-customer.input";
import { UpdateCustomerInput } from "./inputs/update-customer.input";
import { CustomersPageType } from "./types/customers-page.type";
import { CustomerType } from "./types/customer.type";

type CustomerCreationFailureReason =
  | "validation_error"
  | "conflict"
  | "domain_error"
  | "unexpected_error";

@Resolver(() => CustomerType)
export class CustomersResolver {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly listCustomersUseCase: ListCustomersUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly deleteCustomerUseCase: DeleteCustomerUseCase,
    private readonly customerMetrics: CustomerMetrics,
  ) {}

  @Query(() => CustomersPageType)
  async customers(
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
    @Args("offset", { type: () => Int, nullable: true }) offset?: number,
    @Args("orderBy", { type: () => CustomerListOrderBy, nullable: true })
    orderBy?: CustomerListOrderBy,
    @Args("orderDirection", { type: () => SortDirection, nullable: true })
    orderDirection?: SortDirection,
  ): Promise<CustomersPageType> {
    const page = await this.listCustomersUseCase.execute({
      limit,
      offset,
      orderBy,
      orderDirection,
    });

    return {
      items: page.items.map((customer) =>
        CustomerGraphqlMapper.toType(customer),
      ),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      orderBy: page.orderBy,
      orderDirection: page.orderDirection,
      hasNextPage: page.offset + page.items.length < page.total,
    };
  }

  @Query(() => CustomerType)
  async customer(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CustomerType> {
    try {
      const customer = await this.getCustomerUseCase.execute(id);
      return CustomerGraphqlMapper.toType(customer);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Mutation(() => CustomerType)
  async createCustomer(
    @Args("input") input: CreateCustomerInput,
  ): Promise<CustomerType> {
    const startedAt = process.hrtime.bigint();

    try {
      const data = createCustomerInputSchema.parse(input);
      const customer = await this.createCustomerUseCase.execute(data);
      const result = CustomerGraphqlMapper.toType(customer);

      this.customerMetrics.recordCreation("success", "none");
      this.customerMetrics.observeCreationDuration(
        "success",
        this.durationSecondsSince(startedAt),
      );

      return result;
    } catch (error) {
      this.customerMetrics.recordCreation(
        "failure",
        this.getCustomerCreationFailureReason(error),
      );
      this.customerMetrics.observeCreationDuration(
        "failure",
        this.durationSecondsSince(startedAt),
      );

      this.handleError(error);
    }
  }

  @Mutation(() => CustomerType)
  async updateCustomer(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateCustomerInput,
  ): Promise<CustomerType> {
    try {
      const data = updateCustomerInputSchema.parse(input);
      const customer = await this.updateCustomerUseCase.execute(id, data);
      return CustomerGraphqlMapper.toType(customer);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Mutation(() => Boolean)
  async deleteCustomer(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    try {
      await this.deleteCustomerUseCase.execute(id);
      return true;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof InvalidPaginationError) {
      throw new BadRequestException(error.message);
    }

    if (error instanceof CustomerNotFoundError) {
      throw new NotFoundException(error.message);
    }

    if (error instanceof CustomerConflictError) {
      throw new ConflictException(error.message);
    }

    if (error instanceof DomainValidationError) {
      throw new BadRequestException(error.message);
    }

    throw error;
  }

  private getCustomerCreationFailureReason(
    error: unknown,
  ): CustomerCreationFailureReason {
    if (error instanceof ZodError) {
      return "validation_error";
    }

    if (error instanceof CustomerConflictError) {
      return "conflict";
    }

    if (error instanceof DomainValidationError) {
      return "domain_error";
    }

    return "unexpected_error";
  }

  private durationSecondsSince(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  }
}
