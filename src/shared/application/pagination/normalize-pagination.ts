import { InvalidPaginationError } from "./invalid-pagination.error";
import {
  PageRequest,
  PaginationInput,
  SortDirection,
} from "./pagination.types";

const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const DEFAULT_ORDER_DIRECTION = SortDirection.Desc;

type NormalizePaginationOptions<TOrderBy extends string> = {
  input?: PaginationInput<TOrderBy>;
  allowedOrderBy: readonly TOrderBy[];
  defaultOrderBy: TOrderBy;
  defaultOrderDirection?: SortDirection;
  defaultLimit?: number;
  defaultOffset?: number;
  maxLimit?: number;
};

export function normalizePagination<TOrderBy extends string>({
  input = {},
  allowedOrderBy,
  defaultOrderBy,
  defaultOrderDirection = DEFAULT_ORDER_DIRECTION,
  defaultLimit = DEFAULT_LIMIT,
  defaultOffset = DEFAULT_OFFSET,
  maxLimit = DEFAULT_MAX_LIMIT,
}: NormalizePaginationOptions<TOrderBy>): PageRequest<TOrderBy> {
  const limit = input.limit ?? defaultLimit;
  const offset = input.offset ?? defaultOffset;
  const orderBy = input.orderBy ?? defaultOrderBy;
  const orderDirection = input.orderDirection ?? defaultOrderDirection;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidPaginationError("limit must be greater than 0");
  }

  if (limit > maxLimit) {
    throw new InvalidPaginationError(
      `limit must be less than or equal to ${maxLimit}`,
    );
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidPaginationError(
      "offset must be greater than or equal to 0",
    );
  }

  if (!allowedOrderBy.includes(orderBy)) {
    throw new InvalidPaginationError("orderBy is invalid");
  }

  if (!Object.values(SortDirection).includes(orderDirection)) {
    throw new InvalidPaginationError("orderDirection is invalid");
  }

  return {
    limit,
    offset,
    orderBy,
    orderDirection,
  };
}
