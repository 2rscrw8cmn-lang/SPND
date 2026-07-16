import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const emailOtpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tokenHash = formData.get("token_hash");
  const code = formData.get("code");
  const type = formData.get("type");
  const supabase = await createClient();

  if (
    typeof tokenHash === "string" &&
    typeof type === "string" &&
    emailOtpTypes.has(type)
  ) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return redirect(request, "/");
  } else if (typeof code === "string" && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirect(request, "/");
  }

  return redirect(request, "/login?error=invalid_link");
}
