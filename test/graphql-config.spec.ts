import { createGraphqlConfig } from "../src/graphql.config";

describe("createGraphqlConfig", () => {
  it("enables development GraphQL tooling outside production", () => {
    const config = createGraphqlConfig("development");

    expect(config.autoSchemaFile).toEqual(
      expect.stringContaining("src/schema.gql"),
    );
    expect(config.playground).toBe(true);
    expect(config.introspection).toBe(true);
    expect(config.csrfPrevention).toBe(false);
  });

  it("disables interactive GraphQL tooling and enables CSRF prevention in production", () => {
    const config = createGraphqlConfig("production");

    expect(config.autoSchemaFile).toBe(true);
    expect(config.playground).toBe(false);
    expect(config.introspection).toBe(false);
    expect(config.csrfPrevention).toBe(true);
  });
});
