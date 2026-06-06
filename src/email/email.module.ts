import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEmailEnv } from "../config/env.validation";
import { ObservabilityModule } from "../observability/observability.module";
import { CustomerCreatedEmailConsumer } from "./customer-created-email.consumer";
import { CustomerWelcomeEmailSender } from "./customer-welcome-email.sender";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEmailEnv }),
    ObservabilityModule,
  ],
  providers: [CustomerCreatedEmailConsumer, CustomerWelcomeEmailSender],
})
export class EmailModule {}
