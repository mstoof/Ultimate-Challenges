import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ImportForm from "./ImportForm";

type Props = { searchParams: Promise<{ error?: string; kind?: string; sport?: string; from?: string }> };

export default async function NewEventPage({ searchParams }: Props) {
  const { error, kind, sport, from } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/new");

  return <ImportForm error={error} kind={kind === "trip" ? "trip" : "race"} initialSport={sport} fromGear={from === "gear"} />;
}
