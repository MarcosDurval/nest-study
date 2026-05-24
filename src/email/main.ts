import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { EmailModule } from "./email.module";

async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(EmailModule);
  Logger.log("Email service started", "EmailService");
}

void bootstrap();
