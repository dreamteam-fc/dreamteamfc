import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildForgotPasswordPath,
  buildLoginPath,
  getSafeNextPath
} from "@/lib/auth/app-user";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler.ts";

const SUPPORTED_CONFIRMATION_TYPES = new Set<EmailOtpType>([
  "recovery",
  "signup"
]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const requestedNextPath = requestUrl.searchParams.get("next");
  const isRecovery =
    type === "recovery" || requestedNextPath?.startsWith("/reset-password");
  const defaultNextPath = isRecovery ? "/reset-password" : "/me";
  const nextPath = getSafeNextPath(
    requestedNextPath,
    defaultNextPath
  );
  const authError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      new URL(
        isRecovery
          ? buildForgotPasswordPath({
              error: "Link di recupero non valido o scaduto. Richiedine uno nuovo."
            })
          : buildLoginPath({ error: "Link di conferma non valido o scaduto." }),
        request.url
      )
    );
  }

  const { getResponse, supabase } = createSupabaseRouteHandlerClient(request);
  let confirmationError: Error | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    confirmationError = error;
  } else if (
    tokenHash &&
    type &&
    SUPPORTED_CONFIRMATION_TYPES.has(type as EmailOtpType)
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });
    confirmationError = error;
  } else {
    confirmationError = new Error("Missing or unsupported confirmation parameters.");
  }

  const destinationPath = confirmationError
    ? isRecovery
      ? buildForgotPasswordPath({
          error: "Link di recupero non valido o scaduto. Richiedine uno nuovo."
        })
      : buildLoginPath({ error: "Link di conferma non valido o scaduto." })
    : nextPath;

  const redirectResponse = NextResponse.redirect(
    new URL(destinationPath, request.url)
  );

  for (const cookie of getResponse().cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}
