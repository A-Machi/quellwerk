import type { Metadata } from "next";

import { signInAction } from "@/app/auth-actions";
import { LoginForm } from "@/frontend/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/frontend/components/ui/card";

export const metadata: Metadata = { title: "Anmelden · Quellwerk" };

// US-00: Login. Registrierung ist in Supabase ausgeschaltet.
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Quellwerk</CardTitle>
          <CardDescription>Melde dich an, um deine Notebooks zu öffnen.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm action={signInAction} />
        </CardContent>
      </Card>
    </main>
  );
}
