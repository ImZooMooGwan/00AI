import { indicators, snapshot } from "@/lib/data";
export function GET() { return Response.json({ meta: { apiVersion: "v1", datasetVersion: snapshot.datasetVersion, generatedAt: new Date().toISOString(), recordCount: indicators.length, sourceCount: 1, license: "KOSIS terms", nextCursor: null }, data: indicators }); }

