import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validate.js";

export const splitsRouter = Router();

const createSplitBodySchema = z
  .object({
    owner: z.string().min(1, "owner is required"),
    projectId: z.string().min(1, "projectId is required"),
    title: z.string().min(1, "title is required"),
    projectType: z.string().min(1, "projectType is required"),
    token: z.string().min(1, "token is required"),
    collaborators: z
      .array(
        z.object({
          address: z.string().min(1, "address is required"),
          alias: z.string().min(1, "alias is required"),
          basisPoints: z
            .number()
            .int("basisPoints must be an integer")
            .positive("basisPoints must be greater than 0")
            .max(10_000, "basisPoints must be <= 10000")
        })
      )
      .min(2, "at least 2 collaborators are required")
  })
  .superRefine((value, ctx) => {
    const totalBasisPoints = value.collaborators.reduce(
      (sum, collaborator) => sum + collaborator.basisPoints,
      0
    );
    if (totalBasisPoints !== 10_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["collaborators"],
        message: "collaborators basisPoints must sum to exactly 10000"
      });
    }
  });

splitsRouter.get("/:projectId", (req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: `Split project ${req.params.projectId} is not wired yet.`
  });
});

splitsRouter.post("/", validateRequest({ body: createSplitBodySchema }), (req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: "Create split endpoint is not wired yet.",
    request: req.body
  });
});

