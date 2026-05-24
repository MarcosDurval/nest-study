import { registerEnumType } from "@nestjs/graphql";
import { SortDirection } from "../../../shared/application/pagination";
import { CustomerListOrderBy } from "../../application/ports/customer.repository";

registerEnumType(CustomerListOrderBy, {
  name: "CustomerListOrderBy",
});

registerEnumType(SortDirection, {
  name: "SortDirection",
});

export { CustomerListOrderBy, SortDirection };
