import { join } from "path";
import { ApolloDriverConfig } from "@nestjs/apollo";

export function createGraphqlConfig(
  nodeEnv?: string,
): Omit<ApolloDriverConfig, "driver"> {
  const isProduction = nodeEnv === "production";

  return {
    autoSchemaFile: isProduction ? true : join(process.cwd(), "src/schema.gql"),
    sortSchema: true,
    playground: !isProduction,
    introspection: !isProduction,
    csrfPrevention: isProduction,
  };
}
