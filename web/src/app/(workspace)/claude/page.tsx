import type { Metadata } from "next";

import { ClaudeConnector } from "@/features/connector/claude-connector";

export const metadata: Metadata = { title: "Use with Claude" };

export default function ClaudePage() {
  return <ClaudeConnector />;
}
