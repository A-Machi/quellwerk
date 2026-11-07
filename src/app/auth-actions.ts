"use server";

import { redirect } from "next/navigation";

import { parseSignInForm, signInWithPassword, signOut } from "@/backend/auth";
import { toActionError } from "@/backend/errors";

export type SignInState = { error: string | null };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  try {
    const { email, password } = parseSignInForm(formData);
    await signInWithPassword(email, password);
  } catch (error) {
    return { error: toActionError(error).error };
  }
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
