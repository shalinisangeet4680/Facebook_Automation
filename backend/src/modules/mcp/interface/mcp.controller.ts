import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { FastifyReply, FastifyRequest } from "fastify";

import { ProtocolError } from "@shared/errors/domain-error";
import { ExternalClient, Public } from "@shared/security/public.decorator";

import { McpServerFactory } from "../application/mcp-server.factory";
import { McpAuthGuard } from "./mcp-auth.guard";

@ApiExcludeController()
@Public()
@ExternalClient()
@SkipThrottle()
@UseGuards(McpAuthGuard)
@Controller({ path: "mcp", version: VERSION_NEUTRAL })
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly factory: McpServerFactory) {}

  @Post()
  async handle(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const server = this.factory.create(
      req.mcp!,
      req.mcpClientName ?? "MCP client",
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      this.logger.error(
        "MCP request failed",
        err instanceof Error ? err.stack : String(err),
      );
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" });
        reply.raw.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
    }
  }

  @Get()
  @Delete()
  other(): never {
    throw new ProtocolError(
      405,
      { error: "method_not_allowed", error_description: "Use POST." },
      { Allow: "POST" },
    );
  }
}
