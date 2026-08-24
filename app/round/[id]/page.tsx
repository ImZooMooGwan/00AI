import { notFound, redirect } from "next/navigation";
import { policies } from "@/lib/data";
export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const policy = policies.find((item) => item.roundId === id); if (!policy) notFound(); redirect(`/policy/${policy.slug}#section-4`); }

