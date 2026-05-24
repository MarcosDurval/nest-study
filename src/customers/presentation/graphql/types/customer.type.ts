import { Field, ID, ObjectType } from "@nestjs/graphql";
import { AddressType } from "./address.type";

@ObjectType("Customer")
export class CustomerType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  phone: string | null;

  @Field()
  cpf: string;

  @Field(() => AddressType, { nullable: true })
  address: AddressType | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
