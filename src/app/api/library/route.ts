import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeSavedIdea } from "@/lib/server/serialize";

export async function GET() {
  const ideas = await prisma.savedIdea.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return NextResponse.json({ ideas: ideas.map(serializeSavedIdea) });
}
