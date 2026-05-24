import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class UpdateAddressInput {
  @Field(() => String, { nullable: true })
  street?: string;

  @Field(() => String, { nullable: true })
  number?: string;

  @Field(() => String, { nullable: true })
  complement?: string | null;

  @Field(() => String, { nullable: true })
  neighborhood?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  state?: string;

  @Field(() => String, { nullable: true })
  zipCode?: string;
}
