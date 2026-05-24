import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { CustomerCreatedEvent } from "../shared/events/customer-created.event";

@Injectable()
export class CustomerWelcomeEmailSender {
  private transporter?: Transporter;
  private readonly failureSimulationEnabled: boolean;
  private readonly failureSimulationRate: number;

  constructor(private readonly config: ConfigService) {
    this.failureSimulationEnabled = this.config.getOrThrow<boolean>(
      "EMAIL_FAILURE_SIMULATION_ENABLED",
    );
    this.failureSimulationRate = this.config.getOrThrow<number>(
      "EMAIL_FAILURE_SIMULATION_RATE",
    );
  }

  async send(event: CustomerCreatedEvent): Promise<void> {
    this.throwSimulatedFailure(event);

    await this.getTransporter().sendMail({
      from: this.config.getOrThrow<string>("SMTP_FROM"),
      to: event.email,
      subject: "Welcome to Customers App",
      text: `Hello ${event.name}, your customer account was created successfully.`,
      html: `<p>Hello ${event.name},</p><p>Your customer account was created successfully.</p>`,
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>("SMTP_HOST"),
      port: this.config.getOrThrow<number>("SMTP_PORT"),
      secure: this.config.getOrThrow<boolean>("SMTP_SECURE"),
    });

    return this.transporter;
  }

  private throwSimulatedFailure(event: CustomerCreatedEvent): void {
    if (
      !this.failureSimulationEnabled ||
      this.failureSimulationRate <= 0 ||
      Math.random() >= this.failureSimulationRate
    ) {
      return;
    }

    throw new Error(`Simulated email delivery failure for ${event.email}`);
  }
}
