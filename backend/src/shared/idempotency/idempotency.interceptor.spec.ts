import { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of, throwError } from "rxjs";

import { CryptoService } from "@shared/security/crypto.service";

import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyRepository } from "./idempotency.repository";
import { IdempotencyKeyRow } from "./idempotency.tables";

class MemoryKeys {
  rows = new Map<string, IdempotencyKeyRow>();

  claim(input: {
    workspaceId: string;
    key: string;
    requestHash: string;
    expiresAt: Date;
  }) {
    const id = `${input.workspaceId}:${input.key}`;
    if (this.rows.has(id)) return Promise.resolve(false);
    this.rows.set(id, {
      id,
      workspaceId: input.workspaceId,
      key: input.key,
      requestHash: input.requestHash,
      statusCode: null,
      response: null,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    });
    return Promise.resolve(true);
  }

  find(workspaceId: string, key: string) {
    return Promise.resolve(this.rows.get(`${workspaceId}:${key}`) ?? null);
  }

  complete(
    workspaceId: string,
    key: string,
    statusCode: number,
    response: unknown,
  ) {
    const row = this.rows.get(`${workspaceId}:${key}`)!;
    row.statusCode = statusCode;
    row.response = response;
    return Promise.resolve();
  }

  release(workspaceId: string, key: string) {
    this.rows.delete(`${workspaceId}:${key}`);
    return Promise.resolve();
  }
}

function setup() {
  const keys = new MemoryKeys();
  const crypto = { hash: (v: string) => `h(${v})` } as unknown as CryptoService;
  const interceptor = new IdempotencyInterceptor(
    keys as unknown as IdempotencyRepository,
    crypto,
  );
  const reply = { statusCode: 201, status: vi.fn() };
  const context = (key: string | undefined, body: unknown) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { workspaceId: "w1", userId: "u1", sessionId: "s1" },
          headers: key ? { "idempotency-key": key } : {},
          method: "POST",
          url: "/api/v1/campaigns/c1/launch",
          body,
        }),
        getResponse: () => reply,
      }),
    }) as unknown as ExecutionContext;
  return { keys, interceptor, reply, context };
}

const KEY = "launch-0123456789abcdef";

describe("IdempotencyInterceptor", () => {
  it("requires a well-formed key", () => {
    const { interceptor, context } = setup();
    const next: CallHandler = { handle: () => of({ ok: true }) };
    expect(() => interceptor.intercept(context(undefined, {}), next)).toThrow(
      "This action needs an Idempotency-Key header.",
    );
  });

  it("runs the handler once and replays the stored response", async () => {
    const { interceptor, context } = setup();
    const handle = vi.fn(() => of({ launched: true }));
    const next: CallHandler = { handle };
    const first = await firstValueFrom(
      interceptor.intercept(context(KEY, { a: 1 }), next),
    );
    const second = await firstValueFrom(
      interceptor.intercept(context(KEY, { a: 1 }), next),
    );
    expect(first).toEqual({ launched: true });
    expect(second).toEqual({ launched: true });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("rejects the same key with a different body", async () => {
    const { interceptor, context } = setup();
    const next: CallHandler = { handle: () => of({ launched: true }) };
    await firstValueFrom(interceptor.intercept(context(KEY, { a: 1 }), next));
    await expect(
      firstValueFrom(interceptor.intercept(context(KEY, { a: 2 }), next)),
    ).rejects.toThrow("already used for a different request");
  });

  it("reports a request that is still in progress", async () => {
    const { interceptor, context, keys } = setup();
    await keys.claim({
      workspaceId: "w1",
      key: KEY,
      requestHash: `h(POST:/api/v1/campaigns/c1/launch:${JSON.stringify({ a: 1 })})`,
      expiresAt: new Date(Date.now() + 1000),
    });
    const next: CallHandler = { handle: () => of({}) };
    await expect(
      firstValueFrom(interceptor.intercept(context(KEY, { a: 1 }), next)),
    ).rejects.toThrow("already being processed");
  });

  it("releases the key when the handler fails so the client can retry", async () => {
    const { interceptor, context, keys } = setup();
    const failing: CallHandler = {
      handle: () => throwError(() => new Error("Meta unavailable")),
    };
    await expect(
      firstValueFrom(interceptor.intercept(context(KEY, { a: 1 }), failing)),
    ).rejects.toThrow("Meta unavailable");
    expect(keys.rows.size).toBe(0);
  });
});
