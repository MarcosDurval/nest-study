import { z } from "zod";
import {
  InputValidationError,
  InputValidator,
} from "../../application/validation";

export class ZodInputValidator<T> implements InputValidator<T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  validate(input: unknown): T {
    try {
      return this.schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new InputValidationError(
          error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      throw error;
    }
  }
}
