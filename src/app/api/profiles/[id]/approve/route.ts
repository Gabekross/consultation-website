import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserIdFromBearer, isPlatformAdmin } from "@/app/api/_auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromBearer(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await isPlatformAdmin(userId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .update({ status: "active", approved_at: new Date().toISOString(), approved_by: userId, rejection_reason: null })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
