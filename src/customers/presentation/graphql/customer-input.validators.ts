import { z } from "zod";
import {
  CreateCustomerUseCaseInput,
  UpdateCustomerUseCaseInput,
} from "../../application/dtos/customer-use-case.dto";
import { InputValidator } from "../../../shared/application/validation";
import { ZodInputValidator } from "../../../shared/presentation/validation/zod-input-validator";

const requiredString = (field: string) =>
  z.string().trim().min(1, `${field} is required`);

const optionalString = (field: string) => requiredString(field).optional();
const emailSchema = requiredString("email").pipe(z.email("email is invalid"));

const nullableOptionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  });

const createAddressSchema = z
  .object({
    street: requiredString("street"),
    number: requiredString("number"),
    complement: nullableOptionalString,
    neighborhood: requiredString("neighborhood"),
    city: requiredString("city"),
    state: requiredString("state")
      .length(2, "state must have two letters")
      .transform((state) => state.toUpperCase()),
    zipCode: requiredString("zipCode"),
  })
  .strict();

const updateAddressSchema = z
  .object({
    street: optionalString("street"),
    number: optionalString("number"),
    complement: nullableOptionalString.optional(),
    neighborhood: optionalString("neighborhood"),
    city: optionalString("city"),
    state: optionalString("state")
      .refine((state) => state === undefined || state.length === 2, {
        message: "state must have two letters",
      })
      .transform((state) => state?.toUpperCase()),
    zipCode: optionalString("zipCode"),
  })
  .strict();

const createCustomerInputSchema = z
  .object({
    name: requiredString("name"),
    email: emailSchema,
    phone: nullableOptionalString,
    cpf: requiredString("cpf"),
    address: createAddressSchema,
  })
  .strict() satisfies z.ZodType<CreateCustomerUseCaseInput>;

const updateCustomerInputSchema = z
  .object({
    name: optionalString("name"),
    email: emailSchema.optional(),
    phone: nullableOptionalString.optional(),
    cpf: optionalString("cpf"),
    address: updateAddressSchema.optional(),
  })
  .strict() satisfies z.ZodType<UpdateCustomerUseCaseInput>;

export const createCustomerInputValidator: InputValidator<CreateCustomerUseCaseInput> =
  new ZodInputValidator(createCustomerInputSchema);

export const updateCustomerInputValidator: InputValidator<UpdateCustomerUseCaseInput> =
  new ZodInputValidator(updateCustomerInputSchema);
