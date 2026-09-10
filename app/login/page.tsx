import { redirect } from "next/navigation";
import { signIn, auth } from "@/lib/auth";
import Brand from "@/app/Brand";

type Props = { searchParams: Promise<{ check?: string; error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { check, error, next } = await searchParams;

  const session = await auth();
  if (session?.user) redirect(next ?? "/");

  async function request(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email.includes("@")) redirect("/login?error=email");

    // redirectTo bepaalt waar je uitkomt na het klikken op de link.
    await signIn("resend", { email, redirectTo: next ?? "/" });
  }

  if (check) {
    return (
      <main className="login">
        <h1>Kijk in je mail</h1>
        <p>
          Er staat een inloglink klaar. Die werkt 15 minuten en maar één keer. Niks binnen een minuut?
          Kijk even in spam.
        </p>
        <a href="/login">Ander adres proberen</a>
      </main>
    );
  }

  return (
    <main className="login">
      <div className="login__brand">
        <Brand size={52} />
        <h1>Ultimate Challenges</h1>
      </div>
      <p>Vul je mailadres in, dan sturen we een inloglink. Een wachtwoord heb je niet nodig.</p>

      {error === "email" && <p className="login__error">Dat lijkt geen geldig mailadres.</p>}
      {error === "AccessDenied" && (
        <p className="login__error">
          Dit adres staat niet op de lijst. Vraag of iemand je toevoegt.
        </p>
      )}
      {error && !["email", "AccessDenied"].includes(error) && (
        <p className="login__error">Versturen lukte niet. Probeer het zo nog eens.</p>
      )}

      <form action={request}>
        <label htmlFor="email">Je mailadres</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="naam@voorbeeld.nl" required />
        <button type="submit">Stuur me een inloglink</button>
      </form>
    </main>
  );
}
