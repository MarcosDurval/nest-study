import { Field, InputType } from "@nestjs/graphql";
import { CreateAddressInput } from "./create-address.input";

@InputType()
export class CreateCustomerInput {
  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field()
  cpf: string;

  @Field(() => CreateAddressInput)
  address: CreateAddressInput;
}
