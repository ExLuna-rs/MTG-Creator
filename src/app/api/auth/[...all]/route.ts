import { getAuth } from "@/server/auth/auth";

// Routes de Better Auth (/api/auth/…) : inscription, connexion, emails…
// Elles valident elles-mêmes leurs entrées et limitent les tentatives.
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
