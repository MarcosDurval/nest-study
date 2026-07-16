type CreateAddressUseCaseInput = {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};

type UpdateAddressUseCaseInput = Partial<CreateAddressUseCaseInput>;

export type CreateCustomerUseCaseInput = {
  name: string;
  email: string;
  phone?: string | null;
  cpf: string;
  address: CreateAddressUseCaseInput;
};

export type UpdateCustomerUseCaseInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  cpf?: string;
  address?: UpdateAddressUseCaseInput;
};
