import { inject } from "vitest";

// Le code testé lit DATABASE_URL : on le fait pointer vers la base jetable.
process.env.DATABASE_URL = inject("testDatabaseUrl");
