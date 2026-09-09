import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...a: unknown[]) => mockCreateClient(...a),
}));

// import.meta.env is a Proxy that stringifies assigned values, so setting a
// key to `undefined` stores the literal string "undefined" rather than
// clearing it. Always `delete` a key to represent "unset".
const env = import.meta.env as unknown as Record<string, string | undefined>;
const saved = {
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
};

function stubEnv(values: {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}) {
  for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
    if (values[key] === undefined) delete env[key];
    else env[key] = values[key];
  }
}

beforeEach(() => {
  vi.resetModules();
  mockCreateClient.mockReset().mockReturnValue({ marker: "client" });
  stubEnv({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });
});

afterEach(() => {
  stubEnv(saved);
});

describe("supabase (browser client)", () => {
  it("creates a PKCE-flow client with the URL and anon key at import time", async () => {
    await import("./supabase");

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      { auth: { flowType: "pkce" } },
    );
  });
});

describe("createServerClient", () => {
  it("creates a non-persisting client with the service role key", async () => {
    const { createServerClient } = await import("./supabase");

    createServerClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("throws when the service role key is missing", async () => {
    stubEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    });
    const { createServerClient } = await import("./supabase");

    expect(() => createServerClient()).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is required for server client",
    );
  });

  it("throws when the service role key is blank after trimming", async () => {
    stubEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "   ",
    });
    const { createServerClient } = await import("./supabase");

    expect(() => createServerClient()).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is required for server client",
    );
  });
});

describe("createAdminClient", () => {
  it("creates a client with the service role key when configured", async () => {
    const { createAdminClient } = await import("./supabase");

    createAdminClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("falls back to createServerClient, which throws, when no service key is configured", async () => {
    stubEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    });
    const { createAdminClient } = await import("./supabase");

    expect(() => createAdminClient()).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is required for server client",
    );
  });
});

describe("createAuthClient", () => {
  it("creates a request-scoped PKCE client that doesn't persist or auto-refresh", async () => {
    const { createAuthClient } = await import("./supabase");

    createAuthClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      },
    );
  });
});
