import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEncryptIngestKeyForStorage = vi.fn();
vi.mock("./ingestKeyVault", () => ({
  encryptIngestKeyForStorage: (...a: unknown[]) => mockEncryptIngestKeyForStorage(...a),
}));

const mockUpdateDeviceMeta = vi.fn();
vi.mock("./devices", () => ({
  updateDeviceMeta: (...a: unknown[]) => mockUpdateDeviceMeta(...a),
}));

beforeEach(() => {
  mockEncryptIngestKeyForStorage.mockReset().mockResolvedValue("encrypted-value");
  mockUpdateDeviceMeta.mockReset().mockResolvedValue(undefined);
});

describe("persistEncryptedIngestKey", () => {
  it("encrypts the raw key and stores it on the device meta", async () => {
    const { persistEncryptedIngestKey } = await import("./persistIngestKey");

    await persistEncryptedIngestKey("device-1", "raw-key-value");

    expect(mockEncryptIngestKeyForStorage).toHaveBeenCalledWith("raw-key-value");
    expect(mockUpdateDeviceMeta).toHaveBeenCalledWith("device-1", {
      ingest_key_enc: "encrypted-value",
    });
  });

  it("does not touch device meta when encryption yields no value", async () => {
    mockEncryptIngestKeyForStorage.mockResolvedValue(null);
    const { persistEncryptedIngestKey } = await import("./persistIngestKey");

    await persistEncryptedIngestKey("device-1", "raw-key-value");

    expect(mockUpdateDeviceMeta).not.toHaveBeenCalled();
  });
});
