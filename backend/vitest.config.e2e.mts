import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    fileParallelism: false,
    setupFiles: ["./test/setup-env.ts"],
    globalSetup: ["./test/global-setup.ts"],
  },
});
