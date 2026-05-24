import {
  InvalidPaginationError,
  normalizePagination,
  SortDirection,
} from "../src/shared/application/pagination";

enum ProductOrderBy {
  CreatedAt = "createdAt",
  Name = "name",
}

describe("normalizePagination", () => {
  it("applies shared defaults and module-specific default order", () => {
    const pagination = normalizePagination({
      allowedOrderBy: Object.values(ProductOrderBy),
      defaultOrderBy: ProductOrderBy.CreatedAt,
    });

    expect(pagination).toEqual({
      limit: 20,
      offset: 0,
      orderBy: ProductOrderBy.CreatedAt,
      orderDirection: SortDirection.Desc,
    });
  });

  it("accepts module-specific order fields", () => {
    const pagination = normalizePagination({
      input: {
        limit: 10,
        offset: 5,
        orderBy: ProductOrderBy.Name,
        orderDirection: SortDirection.Asc,
      },
      allowedOrderBy: Object.values(ProductOrderBy),
      defaultOrderBy: ProductOrderBy.CreatedAt,
    });

    expect(pagination.orderBy).toBe(ProductOrderBy.Name);
    expect(pagination.orderDirection).toBe(SortDirection.Asc);
  });

  it("rejects invalid shared pagination values", () => {
    expect(() =>
      normalizePagination({
        input: { limit: 101 },
        allowedOrderBy: Object.values(ProductOrderBy),
        defaultOrderBy: ProductOrderBy.CreatedAt,
      }),
    ).toThrow(InvalidPaginationError);
  });
});
