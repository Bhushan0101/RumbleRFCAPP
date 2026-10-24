// Public read-only passport lookup — matches the Python wuco_passport.lookup() API.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FIGHTER_NO = /^[A-Z]{3}-[0-9]{3,8}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fighterNo: string }> },
) {
  const { fighterNo } = await params;
  const no = (fighterNo ?? "").toUpperCase();
  if (!FIGHTER_NO.test(no)) {
    return NextResponse.json({ error: "Invalid fighter number" }, { status: 400 });
  }
  const row = await prisma.fighterPassport.findUnique({
    where: { fighterNo: no },
    include: {
      athlete: {
        include: {
          profile: { include: { gym: true } },
        },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const status = row.athlete.profile?.approvalStatus;
  if (status !== "approved" && status !== "suspended") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    fighter_no: row.fighterNo,
    issued_at: row.issuedAt.toISOString(),
    name: row.athlete.name,
    division: row.athlete.division,
    class_code: row.athlete.classCode,
    martial_art: row.athlete.martialArt,
    record: `${row.athlete.wins}-${row.athlete.losses}-${row.athlete.draws}`,
    status: status === "approved" ? "Active" : "Suspended",
    nationality: row.athlete.country || "Ireland",
    club: row.athlete.profile?.gym?.name ?? "Independent",
    portrait_url: row.athlete.portraitUrl ?? null,
  });
}
