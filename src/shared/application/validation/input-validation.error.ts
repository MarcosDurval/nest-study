import { ValidationIssue } from "./input-validator";

export class InputValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super("Validation failed");
    this.name = "InputValidationError";
  }
}
