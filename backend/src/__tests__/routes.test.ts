import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../index.js";

describe("Route Integration Tests", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "https://example.com/postgres";
    process.env.SIMULATOR_ACCOUNT = "GD5T6IPRNCKFOHQ3STZ5BTEYI5V6U5U6U5U6U5U6U5U6U5U6U5U6U5U6";
    process.env.CONTRACT_ID = "CBLASIRZ7CUKC7S5IS3VSNMQGKZ5FTRWLHZZXH7H4YG6ZLRFPJF5H2LR";
    process.env.HORIZON_URL = "https://horizon-testnet.stellar.org";
    process.env.SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
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
    it("should return 200 and ok status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("Error Handling & Request ID", () => {
    it("should propagate request-id in validation error responses", async () => {
      const res = await request(app)
        .get("/splits/invalid-project-id!!!")
        .set("x-request-id", "test-request-id");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("validation_error");
      expect(res.body.requestId).toBe("test-request-id");
    });

    it("should return 404 for unknown routes", async () => {
      const res = await request(app).get("/unknown-route");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    });
  });
});
