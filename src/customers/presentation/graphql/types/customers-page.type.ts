import { Field, Int, ObjectType } from "@nestjs/graphql";
import {
  CustomerListOrderBy,
  SortDirection,
} from "../customer-list-order.enum";
import { CustomerType } from "./customer.type";

@ObjectType("CustomersPage")
export class CustomersPageType {
  @Field(() => [CustomerType])
  items: CustomerType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;

  @Field(() => CustomerListOrderBy)
  orderBy: CustomerListOrderBy;

  @Field(() => SortDirection)
  orderDirection: SortDirection;

  @Field()
  hasNextPage: boolean;
}
