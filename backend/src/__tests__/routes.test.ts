import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../index.js";

vi.mock("../services/stellar.js", () => {
  class RequestValidationError extends Error {
    type = "VALIDATION";
    code = "VALIDATION_ERROR";
    constructor(message: string) {
      super(message);
      this.name = "RequestValidationError";
    }
  }
  return {
    loadStellarConfig: vi.fn(() => ({
      horizonUrl: "http://horizon",
      sorobanRpcUrl: "http://rpc",
      networkPassphrase: "test",
      contractId: "CBLASIRZ7CUKC7S5IS3VSNMQGKZ5FTRWLHZZXH7H4YG6ZLRFPJF5H2LR",
      simulatorAccount: "test_account"
    })),
    getStellarRpcServer: vi.fn(() => ({
      getAccount: vi.fn().mockResolvedValue({}),
      simulateTransaction: vi.fn().mockResolvedValue({ result: { retval: null } }),
      prepareTransaction: vi.fn().mockResolvedValue({
        toXDR: () => "test_xdr",
        sequence: "1",
        fee: "100"
      }),
      getEvents: vi.fn().mockResolvedValue({ events: [] })
    })),
    listProjects: vi.fn().mockResolvedValue([]),
    fetchProjectById: vi.fn().mockResolvedValue(null),
    fetchClaimableBalance: vi.fn().mockResolvedValue(null),
    RequestValidationError
  };
});

describe("Route Integration Tests", () => {
  beforeAll(() => {
    process.env.SIMULATOR_ACCOUNT = "test_account";
    process.env.CONTRACT_ID = "CBLASIRZ7CUKC7S5IS3VSNMQGKZ5FTRWLHZZXH7H4YG6ZLRFPJF5H2LR";
    process.env.SOROBAN_NETWORK_PASSPHRASE = "test";
  });

  describe("GET /", () => {
    it("should return API info", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("SplitNaira API");
    });
  });

  describe("GET /health", () => {
    it("should return 200 and healthy status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /splits", () => {
    it("should return empty list when no projects found", async () => {
      const res = await request(app).get("/splits");
      if (res.status !== 200) {
        console.error("DEBUG: GET /splits failed", JSON.stringify(res.body, null, 2));
      }
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Error Handling & Request ID", () => {
    it("should propagate request-id in error responses", async () => {
      const res = await request(app)
        .get("/splits/invalid-project-id!!!") // This should fail validationRegex
        .set("x-request-id", "test-request-id");
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("validation_error");
      expect(res.headers["x-request-id"]).toBe("test-request-id");
      expect(res.body.requestId).toBe("test-request-id");
    });

    it("should return 404 for unknown routes", async () => {
      const res = await request(app).get("/unknown-route");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    });
  });
});
