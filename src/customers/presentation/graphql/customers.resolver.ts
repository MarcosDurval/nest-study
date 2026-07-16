import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InvalidPaginationError } from "../../../shared/application/pagination";
import { InputValidationError } from "../../../shared/application/validation";
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
  createCustomerInputValidator,
  updateCustomerInputValidator,
} from "./customer-input.validators";
import { CreateCustomerInput } from "./inputs/create-customer.input";
import { UpdateCustomerInput } from "./inputs/update-customer.input";
import { CustomersPageType } from "./types/customers-page.type";
import { CustomerType } from "./types/customer.type";

@Resolver(() => CustomerType)
export class CustomersResolver {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly listCustomersUseCase: ListCustomersUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly deleteCustomerUseCase: DeleteCustomerUseCase,
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
    try {
      const data = createCustomerInputValidator.validate(input);
      const customer = await this.createCustomerUseCase.execute(data);
      return CustomerGraphqlMapper.toType(customer);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Mutation(() => CustomerType)
  async updateCustomer(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateCustomerInput,
  ): Promise<CustomerType> {
    try {
      const data = updateCustomerInputValidator.validate(input);
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
    if (error instanceof InputValidationError) {
      throw new BadRequestException({
        message: error.message,
        errors: error.issues,
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
}
