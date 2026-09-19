import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadGear, loadGearEventOptions, loadGearProfile } from "@/lib/gear";
import GearView from "./GearView";

export const dynamic = "force-dynamic";

export default async function GearPage() {
  const session = await auth();
  if (!session?.user?.id) {
    // Middleware vangt dit normaal al af; dit is de vangnet-route.
    return (
      <main className="form">
        <p>Log in om je uitrusting te beheren.</p>
      </main>
    );
  }

  const [sections, profile, eventOptions] = await Promise.all([
    loadGear(session.user.id),
    loadGearProfile(session.user.id),
    loadGearEventOptions(),
  ]);
  const aiEnabled = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="gear">
      <Link href="/" className="form__back">
        ← Terug naar de agenda
      </Link>
      <GearView sections={sections} profile={profile} eventOptions={eventOptions} aiEnabled={aiEnabled} />
    </main>
  );
}
