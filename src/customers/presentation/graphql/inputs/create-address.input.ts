import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class CreateAddressInput {
  @Field()
  street: string;

  @Field()
  number: string;

  @Field(() => String, { nullable: true })
  complement?: string | null;

  @Field()
  neighborhood: string;

  @Field()
  city: string;

  @Field()
  state: string;

  @Field()
  zipCode: string;
}
