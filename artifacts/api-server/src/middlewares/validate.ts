import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: "Validation failed",
        issues: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
