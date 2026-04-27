import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../index.js";
import { initDatabase, closeDatabase, getDataSource } from "../services/database.js";
import { User } from "../entities/User.js";

describe("User Registration API", () => {
  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    // Clean up test data
    const dataSource = getDataSource();
    const userRepository = dataSource.getRepository(User);
    await userRepository.delete({});
    await closeDatabase();
  });

  describe("POST /users/register", () => {
    it("should register a new user with valid wallet address", async () => {
      const response = await request(app)
        .post("/users/register")
        .send({
          walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          email: "test@example.com",
          alias: "TestUser"
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.walletAddress).toBe("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
      expect(response.body.email).toBe("test@example.com");
      expect(response.body.alias).toBe("TestUser");
      expect(response.body.role).toBe("user");
      expect(response.body.isActive).toBe(true);
    });

    it("should register a user without optional fields", async () => {
      const response = await request(app)
        .post("/users/register")
        .send({
          walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.walletAddress).toBe("GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    });

    it("should reject duplicate wallet address", async () => {
      const walletAddress = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
      
      // First registration
      await request(app)
        .post("/users/register")
        .send({ walletAddress });

      // Duplicate registration
      const response = await request(app)
        .post("/users/register")
        .send({ walletAddress });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("should reject invalid wallet address format", async () => {
      const response = await request(app)
        .post("/users/register")
        .send({
          walletAddress: "INVALID_ADDRESS"
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("should reject invalid email format", async () => {
      const response = await request(app)
        .post("/users/register")
        .send({
          walletAddress: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
          email: "invalid-email"
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /users/:walletAddress", () => {
    it("should retrieve user by wallet address", async () => {
      const walletAddress = "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE";
      
      // Register user first
      await request(app)
        .post("/users/register")
        .send({
          walletAddress,
          alias: "GetTestUser"
        });

      // Retrieve user
      const response = await request(app)
        .get(`/users/${walletAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.walletAddress).toBe(walletAddress);
      expect(response.body.alias).toBe("GetTestUser");
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app)
        .get("/users/GFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

      expect(response.status).toBe(404);
    });

    it("should reject invalid wallet address format", async () => {
      const response = await request(app)
        .get("/users/INVALID");

      expect(response.status).toBe(400);
    });
  });
});
