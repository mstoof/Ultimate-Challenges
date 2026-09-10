import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ImportForm from "./ImportForm";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewEventPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/new");

  return <ImportForm error={error} />;
}
