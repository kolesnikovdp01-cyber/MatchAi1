import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, asc, or } from "drizzle-orm";
import { db, predictionButtonsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const ADMIN_ID = process.env["ADMIN_ID"] ?? "8589717818";

function adminGuard(req: Request, res: Response, next: NextFunction): void {
  const adminId = req.headers["x-admin-id"];
  if (adminId !== ADMIN_ID) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

const GetButtonsQuery = z.object({
  type: z.enum(["ai", "author"]),
  predictionId: z.coerce.number().int().min(0),
});

const CreateButtonBody = z.object({
  predictionType: z.enum(["ai", "author"]),
  predictionId: z.number().int().min(0),
  label: z.string().min(1).max(80),
  url: z.string().url(),
  sortOrder: z.number().int().default(0),
});

const UpdateButtonBody = z.object({
  label: z.string().min(1).max(80).optional(),
  url: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
});

// Public: get buttons for a prediction.
// For AI type, ALSO returns global buttons (predictionId=0).
router.get("/buttons", async (req, res): Promise<void> => {
  const parsed = GetButtonsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { type, predictionId } = parsed.data;

  let buttons;
  if (predictionId !== 0) {
    // Return both global (predictionId=0) and per-prediction buttons
    buttons = await db
      .select()
      .from(predictionButtonsTable)
      .where(
        and(
          eq(predictionButtonsTable.predictionType, type),
          or(
            eq(predictionButtonsTable.predictionId, predictionId),
            eq(predictionButtonsTable.predictionId, 0)
          )
        )
      )
      .orderBy(asc(predictionButtonsTable.sortOrder), asc(predictionButtonsTable.id));
  } else {
    buttons = await db
      .select()
      .from(predictionButtonsTable)
      .where(
        and(
          eq(predictionButtonsTable.predictionType, type),
          eq(predictionButtonsTable.predictionId, predictionId)
        )
      )
      .orderBy(asc(predictionButtonsTable.sortOrder), asc(predictionButtonsTable.id));
  }

  res.json(buttons);
});

// Admin: list all buttons (optionally filtered by type)
router.get("/admin/buttons", adminGuard, async (req, res): Promise<void> => {
  const type = req.query["type"] as string | undefined;
  let query = db.select().from(predictionButtonsTable).$dynamic();
  if (type === "ai" || type === "author") {
    query = query.where(eq(predictionButtonsTable.predictionType, type));
  }
  const buttons = await query.orderBy(
    asc(predictionButtonsTable.predictionType),
    asc(predictionButtonsTable.predictionId),
    asc(predictionButtonsTable.sortOrder)
  );
  res.json(buttons);
});

// Admin: get global AI buttons (predictionId=0)
router.get("/admin/global-ai-buttons", adminGuard, async (req, res): Promise<void> => {
  const buttons = await db
    .select()
    .from(predictionButtonsTable)
    .where(
      and(
        eq(predictionButtonsTable.predictionType, "ai"),
        eq(predictionButtonsTable.predictionId, 0)
      )
    )
    .orderBy(asc(predictionButtonsTable.sortOrder), asc(predictionButtonsTable.id));
  res.json(buttons);
});

// Admin: get global Author buttons (predictionId=0)
router.get("/admin/global-author-buttons", adminGuard, async (req, res): Promise<void> => {
  const buttons = await db
    .select()
    .from(predictionButtonsTable)
    .where(
      and(
        eq(predictionButtonsTable.predictionType, "author"),
        eq(predictionButtonsTable.predictionId, 0)
      )
    )
    .orderBy(asc(predictionButtonsTable.sortOrder), asc(predictionButtonsTable.id));
  res.json(buttons);
});

// Admin: create button (predictionId=0 = global AI button)
router.post("/admin/buttons", adminGuard, async (req, res): Promise<void> => {
  const parsed = CreateButtonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [button] = await db.insert(predictionButtonsTable).values(parsed.data).returning();
  res.status(201).json(button);
});

router.patch("/admin/buttons/:id", adminGuard, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateButtonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [button] = await db.update(predictionButtonsTable).set(parsed.data).where(eq(predictionButtonsTable.id, id)).returning();
  if (!button) { res.status(404).json({ error: "Button not found" }); return; }
  res.json(button);
});

router.delete("/admin/buttons/:id", adminGuard, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(predictionButtonsTable).where(eq(predictionButtonsTable.id, id));
  res.status(204).send();
});

router.patch("/admin/ai-predictions/:id", adminGuard, async (req, res): Promise<void> => {
  const { aiPredictionsTable } = await import("@workspace/db");
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ analysis: z.string().optional(), status: z.enum(["pending","win","lose","refund"]).optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [pred] = await db.update(aiPredictionsTable).set(body.data).where(eq(aiPredictionsTable.id, id)).returning();
  if (!pred) { res.status(404).json({ error: "Not found" }); return; }
  res.json(pred);
});

router.delete("/admin/author-predictions/:id", adminGuard, async (req, res): Promise<void> => {
  const { authorPredictionsTable } = await import("@workspace/db");
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(predictionButtonsTable).where(
    and(eq(predictionButtonsTable.predictionType, "author"), eq(predictionButtonsTable.predictionId, id))
  );
  await db.delete(authorPredictionsTable).where(eq(authorPredictionsTable.id, id));
  res.status(204).send();
});

export default router;
