import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEmailEnv } from "../config/env.validation";
import { CustomerCreatedEmailConsumer } from "./customer-created-email.consumer";
import { CustomerWelcomeEmailSender } from "./customer-welcome-email.sender";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEmailEnv }),
  ],
  providers: [CustomerCreatedEmailConsumer, CustomerWelcomeEmailSender],
})
export class EmailModule {}
