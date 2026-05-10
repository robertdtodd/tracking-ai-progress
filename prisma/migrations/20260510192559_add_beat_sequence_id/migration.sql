-- AlterTable
ALTER TABLE "Beat" ADD COLUMN     "sequenceId" TEXT;

-- CreateIndex
CREATE INDEX "Beat_sessionId_sequenceId_idx" ON "Beat"("sessionId", "sequenceId");
