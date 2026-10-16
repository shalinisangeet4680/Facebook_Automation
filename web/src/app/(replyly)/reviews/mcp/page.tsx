import type { Metadata } from "next";

import { McpPage } from "@/features/replyly/mcp-page";

export const metadata: Metadata = { title: "MCP" };

export default function Page() {
  return <McpPage />;
}
