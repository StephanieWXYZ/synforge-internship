-- Additive OIDC identity mapping. Password columns remain available during the
-- legacy-account linking window and can be removed only in a later migration.
ALTER TABLE "User" ADD COLUMN "oidcIssuer" TEXT;
ALTER TABLE "User" ADD COLUMN "oidcSubject" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- SQLite cannot drop NOT NULL from an existing column with ALTER COLUMN. The
-- table rebuild preserves local user IDs and every existing relation.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "passwordSalt" TEXT,
    "oidcIssuer" TEXT,
    "oidcSubject" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" (
    "id", "email", "name", "passwordHash", "passwordSalt",
    "oidcIssuer", "oidcSubject", "emailVerified", "createdAt"
)
SELECT
    "id", "email", "name", "passwordHash", "passwordSalt",
    "oidcIssuer", "oidcSubject", "emailVerified", "createdAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_oidcIssuer_oidcSubject_key"
ON "User"("oidcIssuer", "oidcSubject");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
