import { signOutAction } from "@/app/auth-actions";
import { getSession } from "@/backend/auth";
import { AccountMenu } from "@/frontend/components/account-menu";

// Liest den eingeloggten Nutzer aus der Session. Steht hinter <Suspense>,
// weil die Session erst zur Laufzeit feststeht.
export async function UserBadge() {
  const session = await getSession();
  if (!session?.user.email) return null;
  return <AccountMenu email={session.user.email} signOutAction={signOutAction} />;
}
