import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserIdFromBearer, isPlatformAdmin } from "@/app/api/_auth";

const bodySchema = z.object({ reason: z.string().optional().nullable() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromBearer(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await isPlatformAdmin(userId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .update({ status: "rejected", rejection_reason: parsed.data.reason ?? null })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
