import { Controller, Get, Res } from "@nestjs/common";
import { MetricsRegistry } from "./metrics.registry";

type MetricsResponse = {
  type(contentType: string): MetricsResponse;
};

@Controller()
export class MetricsController {
  constructor(private readonly metricsRegistry: MetricsRegistry) {}

  @Get("metrics")
  async metrics(
    @Res({ passthrough: true }) response: MetricsResponse,
  ): Promise<string> {
    response.type(this.metricsRegistry.contentType);
    return this.metricsRegistry.metrics();
  }
}
