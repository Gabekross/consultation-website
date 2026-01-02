import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const sb = supabaseAdmin();
  const { data: profile } = await sb.from("profiles").select("whatsapp_number").eq("slug", slug).maybeSingle();

  const num = profile?.whatsapp_number;
  if (!num) return NextResponse.json({ error: "No WhatsApp number configured." }, { status: 404 });

  // Phase 1: simple blank message (Phase 2 will build message from latest lead)
  const wa = `https://wa.me/${encodeURIComponent(num)}?text=${encodeURIComponent("Hi! I just submitted a booking request. Can you confirm availability?")}`;
  return NextResponse.redirect(wa, { status: 302 });
}
