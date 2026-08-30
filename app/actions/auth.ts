"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { login, logout, setSessionCookie } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    redirect("/login?error=empty");
  }

  const token = await login(identifier, password);
  if (!token) {
    redirect("/login?error=invalid");
  }

  await setSessionCookie(token);
  redirect("/");
}

export async function logoutAction() {
  const token = (await cookies()).get("starboard_session")?.value;
  if (token) await logout(token);
  await setSessionCookie(null);
  redirect("/login");
}
