import { DAILY_NEURON_LIMIT, getTodayUsage } from "@/backend/ai/usage";
import { getSession } from "@/backend/auth";
import { UsageMeter } from "@/frontend/components/usage-meter";

// Liest den Tagesverbrauch des eingeloggten Nutzers. Steht hinter <Suspense>,
// weil die Session erst zur Laufzeit feststeht.
export async function UsageBadge() {
  const neurons = await readTodayUsage();
  if (neurons === null) return null;
  return <UsageMeter neurons={neurons} limit={DAILY_NEURON_LIMIT} />;
}

async function readTodayUsage(): Promise<number | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    return await getTodayUsage(session.supabase);
  } catch (error) {
    console.error("Tagesverbrauch nicht lesbar", error);
    return null;
  }
}
