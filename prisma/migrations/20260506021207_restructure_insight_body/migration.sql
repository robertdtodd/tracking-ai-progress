/*
  Warnings:

  - You are about to drop the column `evidence` on the `Insight` table. All the data in the column will be lost.
  - You are about to drop the column `whatsChanging` on the `Insight` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Insight" DROP COLUMN "evidence",
DROP COLUMN "whatsChanging",
ADD COLUMN     "rationale" TEXT NOT NULL DEFAULT '';
