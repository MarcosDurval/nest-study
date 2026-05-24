export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

export type PaginationInput<TOrderBy extends string> = {
  limit?: number | null;
  offset?: number | null;
  orderBy?: TOrderBy | null;
  orderDirection?: SortDirection | null;
};

export type PageRequest<TOrderBy extends string> = {
  limit: number;
  offset: number;
  orderBy: TOrderBy;
  orderDirection: SortDirection;
};

export type PaginatedResult<TItem, TOrderBy extends string> = {
  items: TItem[];
  total: number;
  limit: number;
  offset: number;
  orderBy: TOrderBy;
  orderDirection: SortDirection;
};
