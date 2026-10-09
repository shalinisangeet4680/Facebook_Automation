import { Injectable } from "@nestjs/common";
import { lookup } from "dns/promises";
import { isIP } from "net";

import { OAUTH_POLICY } from "../domain/oauth.policy";

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return (
      a === "::1" ||
      a === "::" ||
      a.startsWith("fc") ||
      a.startsWith("fd") ||
      a.startsWith("fe8") ||
      a.startsWith("fe9") ||
      a.startsWith("fea") ||
      a.startsWith("feb")
    );
  }
  const [a = 0, b = 0] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

@Injectable()
export class CimdFetcher {
  async fetch(url: string): Promise<unknown> {
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password) {
      throw new Error("Client metadata must be served over https");
    }
    const addresses = isIP(target.hostname)
      ? [{ address: target.hostname }]
      : await lookup(target.hostname, { all: true });
    if (
      !addresses.length ||
      addresses.some((a) => isPrivateAddress(a.address))
    ) {
      throw new Error("Client metadata host is not public");
    }
    const res = await fetch(target, {
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(OAUTH_POLICY.cimdTimeoutMs),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > OAUTH_POLICY.cimdMaxBytes) {
        await reader.cancel();
        throw new Error("Client metadata is too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  }
}
