import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { CustomerWelcomeEmailSender } from "../src/email/customer-welcome-email.sender";
import { CustomerCreatedEvent } from "../src/shared/events/customer-created.event";

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));

describe("CustomerWelcomeEmailSender", () => {
  let transport: { sendMail: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    transport = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(nodemailer.createTransport).mockReturnValue(transport as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the welcome email when failure simulation is disabled", async () => {
    const sender = makeSender({
      EMAIL_FAILURE_SIMULATION_ENABLED: false,
      EMAIL_FAILURE_SIMULATION_RATE: 1,
    });

    await sender.send(validEvent());

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "localhost",
      port: 1025,
      secure: false,
    });
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Customers App <no-reply@customers.local>",
        to: "ana@example.com",
      }),
    );
  });

  it("throws before sending when simulated failure is selected", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.49);
    const sender = makeSender({
      EMAIL_FAILURE_SIMULATION_ENABLED: true,
      EMAIL_FAILURE_SIMULATION_RATE: 0.5,
    });

    await expect(sender.send(validEvent())).rejects.toThrow(
      "Simulated email delivery failure for ana@example.com",
    );

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it("sends when simulated failure is not selected", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const sender = makeSender({
      EMAIL_FAILURE_SIMULATION_ENABLED: true,
      EMAIL_FAILURE_SIMULATION_RATE: 0.5,
    });

    await sender.send(validEvent());

    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  function makeSender(
    overrides: Record<string, string | number | boolean> = {},
  ): CustomerWelcomeEmailSender {
    const values: Record<string, string | number | boolean> = {
      SMTP_FROM: "Customers App <no-reply@customers.local>",
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      EMAIL_FAILURE_SIMULATION_ENABLED: false,
      EMAIL_FAILURE_SIMULATION_RATE: 0,
      ...overrides,
    };

    const config = {
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];

        if (value === undefined) {
          throw new Error(`Missing env var ${key}`);
        }

        return value;
      }),
    } as unknown as ConfigService;

    return new CustomerWelcomeEmailSender(config);
  }

  function validEvent(): CustomerCreatedEvent {
    return {
      customerId: "customer-id",
      name: "Ana Silva",
      email: "ana@example.com",
      createdAt: "2026-05-18T12:00:00.000Z",
    };
  }
});
