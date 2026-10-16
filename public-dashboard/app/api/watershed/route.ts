import { NextResponse } from "next/server";
import { createWatershedLookup } from "@/lib/geography/watershedContext";

/**
 * Selected-site HUC10/HUC12 identification from the USGS Watershed Boundary Dataset, queried from
 * the server so browser CORS policy cannot break it. Only fixed USGS layers are queried (never a
 * caller-supplied URL); successful results are cached in memory for 15 minutes.
 */
const lookup = createWatershedLookup();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const level = Number(params.get("level"));
  const longitude = Number(params.get("x"));
  const latitude = Number(params.get("y"));
  if ([...params.keys()].some((key) => !["level", "x", "y"].includes(key)) || (level !== 10 && level !== 12)
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    return NextResponse.json({ error: "Use level 10 or 12 with a valid longitude (x) and latitude (y)." }, { status: 400 });
  }
  const result = await lookup(level, longitude, latitude);
  return NextResponse.json(result, {
    headers: { "Cache-Control": result.status === "error" ? "no-store" : "public, max-age=900" },
  });
}
