import { Field, InputType } from "@nestjs/graphql";
import { UpdateAddressInput } from "./update-address.input";

@InputType()
export class UpdateCustomerInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  cpf?: string;

  @Field(() => UpdateAddressInput, { nullable: true })
  address?: UpdateAddressInput;
}
