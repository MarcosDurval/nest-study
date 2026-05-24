import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("Address")
export class AddressType {
  @Field(() => ID)
  id: string;

  @Field()
  street: string;

  @Field()
  number: string;

  @Field(() => String, { nullable: true })
  complement: string | null;

  @Field()
  neighborhood: string;

  @Field()
  city: string;

  @Field()
  state: string;

  @Field()
  zipCode: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
