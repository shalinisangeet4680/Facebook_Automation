import { NestFastifyApplication } from "@nestjs/platform-fastify";

export interface Reply {
  statusCode: number;
  body: Record<string, unknown>;
  cookies: Record<string, string>;
  headers: Record<string, unknown>;
}

export async function call(
  app: NestFastifyApplication,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {},
): Promise<Reply> {
  const res = await app.inject({
    method,
    url,
    payload: options.body as object | undefined,
    headers: options.headers,
    cookies: options.cookies,
  });
  const cookies: Record<string, string> = {};
  for (const c of res.cookies) cookies[c.name] = c.value;
  return {
    statusCode: res.statusCode,
    body: res.body ? (JSON.parse(res.body) as Record<string, unknown>) : {},
    cookies,
    headers: res.headers,
  };
}

export function multipart(
  file: Buffer,
  mime: string,
  filename: string,
  name?: string,
) {
  const boundary = "----autopilot";
  const parts: Buffer[] = [];
  if (name) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return {
    payload: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
