import { notFound, redirect } from "next/navigation";
import { policies } from "@/lib/data";
export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const policy = policies.find((item) => item.programId === id); if (!policy) notFound(); redirect(`/policy/${policy.slug}#section-4`); }

