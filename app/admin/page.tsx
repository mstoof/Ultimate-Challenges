import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

function fmt(d: Date | null): string {
  if (!d) return "nog nooit";
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/admin");
  if (!isAdmin(session.user.email, session.user.role)) redirect("/");

  const superAdmin = isSuperAdmin(session.user.email);

  const rows = await db.select().from(users);
  const members = rows.sort(
    (a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0)
  );

  // Admins mogen namen aanpassen.
  async function updateMemberName(formData: FormData) {
    "use server";
    const session = await auth();
    if (!isAdmin(session?.user?.email, session?.user?.role)) redirect("/");
    const memberId = String(formData.get("memberId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (memberId && name) {
      await db.update(users).set({ name }).where(eq(users.id, memberId));
    }
    redirect("/admin");
  }

  // Alleen de super-admin mag admins toevoegen/verwijderen.
  async function setMemberRole(formData: FormData) {
    "use server";
    const session = await auth();
    if (!isSuperAdmin(session?.user?.email)) redirect("/");
    const memberId = String(formData.get("memberId") ?? "");
    const role = String(formData.get("role") ?? "") === "admin" ? "admin" : "member";
    if (memberId) {
      const [target] = await db.select().from(users).where(eq(users.id, memberId)).limit(1);
      // De super-admin blijft altijd super-admin.
      if (target && !isSuperAdmin(target.email)) {
        await db.update(users).set({ role }).where(eq(users.id, memberId));
      }
    }
    redirect("/admin");
  }

  return (
    <main className="admin">
      <Link href="/" className="form__back">
        ← Terug naar de agenda
      </Link>
      <h1>Admin</h1>
      <p className="form__lead">
        {members.length} leden. Pas namen aan, en{" "}
        {superAdmin ? "maak anderen admin" : "beheer leden"}. Iemand verschijnt hier pas nadat
        die één keer heeft ingelogd.
      </p>

      <ul className="admin__list">
        {members.map((m) => {
          const superRow = isSuperAdmin(m.email);
          const rank = superRow ? "super-admin" : m.role === "admin" ? "admin" : "lid";
          return (
            <li key={m.id} className="admin__member">
              <div className="admin__top">
                <span className={`admin__rank admin__rank--${superRow ? "super" : m.role}`}>
                  {rank}
                </span>
                <span className="admin__email">{m.email}</span>
              </div>

              <form action={updateMemberName} className="admin__name">
                <input type="hidden" name="memberId" value={m.id} />
                <input name="name" defaultValue={m.name} aria-label={`Naam van ${m.email}`} />
                <button type="submit" className="btn">
                  Opslaan
                </button>
              </form>

              <p className="admin__meta">
                Lid sinds {fmt(m.createdAt)} · Laatst gezien: {fmt(m.lastSeenAt)}
              </p>

              {superAdmin && !superRow && (
                <form action={setMemberRole} className="admin__role">
                  <input type="hidden" name="memberId" value={m.id} />
                  <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                  <button type="submit" className="btn">
                    {m.role === "admin" ? "Admin verwijderen" : "Maak admin"}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
