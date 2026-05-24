export type CustomerConflictField = "email" | "cpf" | "emailOrCpf";

export class CustomerConflictError extends Error {
  constructor(readonly field: CustomerConflictField) {
    super(
      field === "emailOrCpf"
        ? "Customer with this email or CPF already exists"
        : `Customer with this ${field} already exists`,
    );
    this.name = "CustomerConflictError";
  }
}
