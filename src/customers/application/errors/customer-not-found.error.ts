export class CustomerNotFoundError extends Error {
  constructor(id: string) {
    super(`Customer ${id} was not found`);
    this.name = "CustomerNotFoundError";
  }
}
