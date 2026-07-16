export type ValidationIssue = {
  path: string;
  message: string;
};

export interface InputValidator<T> {
  validate(input: unknown): T;
}
