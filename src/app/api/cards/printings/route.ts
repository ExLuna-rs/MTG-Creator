import type { NextRequest } from "next/server";
import { z } from "zod";
import { listPrintings } from "@/server/cards/printings";

// Éditions papier d'une carte, pour choisir sa version dans un deck
// (données publiques).
export async function GET(request: NextRequest) {
  const oracleId = z.uuid().safeParse(request.nextUrl.searchParams.get("card"));
  if (!oracleId.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const printings = (await listPrintings(oracleId.data)).map((printing) => ({
    ...printing,
    oracleId: oracleId.data,
  }));
  return Response.json(
    { printings },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
