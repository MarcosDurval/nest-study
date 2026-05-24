import { Module } from "@nestjs/common";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { validateApiEnv } from "./config/env.validation";
import { CustomersModule } from "./customers/customers.module";
import { PrismaModule } from "./database/prisma.module";
import { createGraphqlConfig } from "./graphql.config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateApiEnv }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createGraphqlConfig(config.getOrThrow<string>("NODE_ENV")),
    }),
    PrismaModule,
    CustomersModule,
  ],
})
export class AppModule {}
