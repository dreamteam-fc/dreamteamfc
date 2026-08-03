"use server";

import { redirect } from "next/navigation";

import {
  buildForgotPasswordPath,
  buildLoginPath,
  buildResetPasswordPath,
  buildSignupPath,
  ensureAppUserForAuthUser,
  getSafeNextPath
} from "@/lib/auth/app-user";
import { buildAbsoluteAppUrl } from "@/lib/server/http/app-origin.ts";
import { createSupabaseServerClient } from "@/lib/supabase/server.ts";

function redirectToLogin(
  options?: { error?: string; next?: string; notice?: string }
): never {
  redirect(buildLoginPath(options));
}

export async function loginAction(formData: FormData) {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawNext = formData.get("next");
  const nextPath = getSafeNextPath(
    typeof rawNext === "string" ? rawNext : undefined,
    "/me"
  );

  if (typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
    redirectToLogin({ error: "Email obbligatoria.", next: nextPath });
  }

  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    redirectToLogin({ error: "Password obbligatoria.", next: nextPath });
  }

  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      redirectToLogin({
        error:
          "Email non confermata. Controlla la casella di posta oppure disattiva Confirm email in Supabase (Auth → Providers → Email) in locale.",
        next: nextPath
      });
    }

    redirectToLogin({ error: "Credenziali non valide.", next: nextPath });
  }

  const {
    data: { user },
    error: getUserError
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    await supabase.auth.signOut();
    redirectToLogin({
      error: "Sessione non disponibile dopo il login.",
      next: nextPath
    });
  }

  try {
    await ensureAppUserForAuthUser(user);
  } catch (caughtError) {
    await supabase.auth.signOut();
    redirectToLogin({
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Impossibile collegare l'utente applicativo.",
      next: nextPath
    });
  }

  redirect(nextPath);
}

function redirectToSignup(
  options?: { error?: string; next?: string; notice?: string }
): never {
  redirect(buildSignupPath(options));
}

function redirectToForgotPassword(
  options?: { error?: string; next?: string; notice?: string }
): never {
  redirect(buildForgotPasswordPath(options));
}

function redirectToResetPassword(
  options?: { error?: string; next?: string; notice?: string }
): never {
  redirect(buildResetPasswordPath(options));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapSignupErrorMessage(message: string, code?: string) {
  const normalized = `${code ?? ""} ${message}`.toLowerCase();

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit")
  ) {
    return "Limite email Supabase raggiunto. In locale: Authentication → Providers → Email → disattiva Confirm email, poi riprova tra qualche minuto.";
  }

  if (normalized.includes("already") || normalized.includes("registered")) {
    return "Questa email risulta gia registrata. Usa il login oppure recupera la password.";
  }

  if (normalized.includes("password")) {
    return "Password non accettata da Supabase. Usa almeno 8 caratteri e riprova.";
  }

  if (normalized.includes("email") && normalized.includes("invalid")) {
    return "Email non accettata da Supabase. Prova con un altro indirizzo.";
  }

  return "Impossibile completare la registrazione.";
}

function validatePasswordOrRedirect(
  password: string,
  confirmPassword: string,
  redirectWithError: (message: string) => never
) {
  if (password.length < 8) {
    redirectWithError("La password deve contenere almeno 8 caratteri.");
  }

  if (password !== confirmPassword) {
    redirectWithError("Le password non coincidono.");
  }
}

export async function signupAction(formData: FormData) {
  const rawDisplayName = formData.get("displayName");
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");
  const rawNext = formData.get("next");
  const nextPath = getSafeNextPath(
    typeof rawNext === "string" ? rawNext : undefined,
    "/me"
  );

  const displayName =
    typeof rawDisplayName === "string" ? rawDisplayName.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const confirmPassword =
    typeof rawConfirmPassword === "string" ? rawConfirmPassword : "";

  if (email.length === 0) {
    redirectToSignup({ error: "Email obbligatoria.", next: nextPath });
  }

  if (!isValidEmail(email)) {
    redirectToSignup({ error: "Inserisci un'email valida.", next: nextPath });
  }

  validatePasswordOrRedirect(password, confirmPassword, (message) =>
    redirectToSignup({ error: message, next: nextPath })
  );

  const supabase = await createSupabaseServerClient();
  const emailRedirectTo = await buildAbsoluteAppUrl(
    `/auth/confirm?next=${encodeURIComponent(nextPath)}`
  );
  const metadata =
    displayName.length > 0
      ? {
          display_name: displayName,
          name: displayName
        }
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo
    }
  });

  if (error) {
    redirectToSignup({
      error: mapSignupErrorMessage(error.message, error.code),
      next: nextPath
    });
  }

  // Supabase, per anti-enumeration, risponde "ok" anche se l'email e gia registrata,
  // ma senza identities e senza session.
  if ((data.user?.identities?.length ?? 0) === 0) {
    redirectToSignup({
      error:
        "Questa email risulta gia registrata. Usa il login oppure recupera la password.",
      next: nextPath
    });
  }

  if (!data.session) {
    redirectToSignup({
      notice: "Controlla la tua email per completare la registrazione.",
      next: nextPath
    });
  }

  const {
    data: { user },
    error: getUserError
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    await supabase.auth.signOut();
    redirectToSignup({
      error: "Sessione non disponibile dopo la registrazione.",
      next: nextPath
    });
  }

  try {
    await ensureAppUserForAuthUser(user);
  } catch (caughtError) {
    await supabase.auth.signOut();
    redirectToSignup({
      error:
        caughtError instanceof Error
          ? caughtError.message
          : "Impossibile collegare l'utente applicativo.",
      next: nextPath
    });
  }

  redirect(nextPath);
}

export async function forgotPasswordAction(formData: FormData) {
  const rawEmail = formData.get("email");
  const rawNext = formData.get("next");
  const nextPath = getSafeNextPath(
    typeof rawNext === "string" ? rawNext : undefined,
    "/me"
  );
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  if (email.length === 0) {
    redirectToForgotPassword({ error: "Email obbligatoria.", next: nextPath });
  }

  if (!isValidEmail(email)) {
    redirectToForgotPassword({
      error: "Inserisci un'email valida.",
      next: nextPath
    });
  }

  const supabase = await createSupabaseServerClient();
  const resetNextPath = buildResetPasswordPath({ next: nextPath });
  const redirectTo = await buildAbsoluteAppUrl(
    `/auth/confirm?next=${encodeURIComponent(resetNextPath)}`
  );

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  redirectToForgotPassword({
    notice: "Se l'email esiste, riceverai le istruzioni.",
    next: nextPath
  });
}

export async function updatePasswordAction(formData: FormData) {
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");
  const rawNext = formData.get("next");
  const nextPath = getSafeNextPath(
    typeof rawNext === "string" ? rawNext : undefined,
    "/me"
  );
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const confirmPassword =
    typeof rawConfirmPassword === "string" ? rawConfirmPassword : "";

  validatePasswordOrRedirect(password, confirmPassword, (message) =>
    redirectToResetPassword({ error: message, next: nextPath })
  );

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: getUserError
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    redirectToResetPassword({
      error: "Sessione di recupero non valida o scaduta.",
      next: nextPath
    });
  }

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    redirectToResetPassword({
      error: "Impossibile aggiornare la password.",
      next: nextPath
    });
  }

  await supabase.auth.signOut();
  redirectToLogin({
    notice: "Password aggiornata. Ora puoi accedere.",
    next: nextPath
  });
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirectToLogin({ notice: "Logout completato." });
}
