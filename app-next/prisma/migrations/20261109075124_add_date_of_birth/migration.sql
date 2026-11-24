-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_athletes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "division" TEXT NOT NULL DEFAULT 'Featherweight',
    "country" TEXT NOT NULL DEFAULT '',
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "biography" TEXT,
    "portraitUrl" TEXT,
    "cartoonUrl" TEXT,
    "isSample" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "classCode" TEXT,
    "martialArt" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_athletes" ("biography", "cartoonUrl", "classCode", "country", "displayOrder", "division", "draws", "gender", "id", "isSample", "losses", "martialArt", "name", "nickname", "portraitUrl", "wins") SELECT "biography", "cartoonUrl", "classCode", "country", "displayOrder", "division", "draws", "gender", "id", "isSample", "losses", "martialArt", "name", "nickname", "portraitUrl", "wins" FROM "athletes";
DROP TABLE "athletes";
ALTER TABLE "new_athletes" RENAME TO "athletes";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
