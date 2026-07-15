import { afterEach, describe, expect, it } from "vitest";
import { importsEnabled } from "@/lib/env";

const original = process.env.SPND_ENABLE_IMPORTS;
afterEach(() => { if (original === undefined) delete process.env.SPND_ENABLE_IMPORTS; else process.env.SPND_ENABLE_IMPORTS = original; });

describe("import feature flag", () => {
  it("is disabled by default and for non-exact values", () => {
    delete process.env.SPND_ENABLE_IMPORTS; expect(importsEnabled()).toBe(false);
    process.env.SPND_ENABLE_IMPORTS = "TRUE"; expect(importsEnabled()).toBe(false);
  });
  it("enables imports only when explicitly true", () => {
    process.env.SPND_ENABLE_IMPORTS = "true"; expect(importsEnabled()).toBe(true);
  });
});
