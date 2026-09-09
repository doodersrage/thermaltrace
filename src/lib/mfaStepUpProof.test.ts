import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { runtimeEnvStore } = vi.hoisted(() => ({
  runtimeEnvStore: new Map<string, string>(),
}));

vi.mock("./runtimeEnv", () => ({
  getRuntimeEnv: (key: string) => runtimeEnvStore.get(key),
}));

import {
  createMfaStepUpProof,
  MFA_STEPUP_COOKIE,
  MFA_STEPUP_HEADER,
  verifyMfaStepUpProof,
} from "./mfaStepUpProof";

describe("mfaStepUpProof", () => {
  beforeEach(() => {
    runtimeEnvStore.clear();
    vi.stubEnv("CRON_SECRET", "test-mfa-stepup-secret");
    vi.stubEnv("MFA_STEPUP_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and verifies a proof for the same user", async () => {
    const token = await createMfaStepUpProof("user-abc");
    expect(token).toBeTruthy();
    expect(await verifyMfaStepUpProof(token, "user-abc")).toBe(true);
  });

  it("rejects proof for a different user", async () => {
    const token = await createMfaStepUpProof("user-abc");
    expect(await verifyMfaStepUpProof(token, "user-other")).toBe(false);
  });

  it("rejects tampered tokens", async () => {
    const token = await createMfaStepUpProof("user-abc");
    expect(token).toBeTruthy();
    const tampered = `${token!.slice(0, -4)}dead`;
    expect(await verifyMfaStepUpProof(tampered, "user-abc")).toBe(false);
    expect(await verifyMfaStepUpProof(null, "user-abc")).toBe(false);
    expect(await verifyMfaStepUpProof("not-a-token", "user-abc")).toBe(false);
  });

  it("fails closed when signing secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("MFA_STEPUP_SECRET", "");
    expect(await createMfaStepUpProof("user-abc")).toBeNull();
    expect(await verifyMfaStepUpProof("anything", "user-abc")).toBe(false);
  });

  it("falls back to runtime Worker secrets when build env is empty", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("MFA_STEPUP_SECRET", "");
    runtimeEnvStore.set("MFA_STEPUP_SECRET", "runtime-stepup-secret");
    const token = await createMfaStepUpProof("user-abc");
    expect(token).toBeTruthy();
    expect(await verifyMfaStepUpProof(token, "user-abc")).toBe(true);
  });

  it("prefers MFA_STEPUP_SECRET over CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "cron-fallback");
    vi.stubEnv("MFA_STEPUP_SECRET", "dedicated-stepup");
    const token = await createMfaStepUpProof("user-abc");
    expect(token).toBeTruthy();
    expect(await verifyMfaStepUpProof(token, "user-abc")).toBe(true);

    vi.stubEnv("MFA_STEPUP_SECRET", "other-dedicated");
    expect(await verifyMfaStepUpProof(token, "user-abc")).toBe(false);
  });

  it("exports cookie and companion header names", () => {
    expect(MFA_STEPUP_COOKIE).toBe("sb-mfa-stepup");
    expect(MFA_STEPUP_HEADER).toBe("x-sb-mfa-stepup");
  });
});
