-- DropIndex
DROP INDEX "ArticleEmbedding_embedding_cosine_idx";

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stance" TEXT NOT NULL DEFAULT 'working_hypothesis',
    "bottomLine" TEXT NOT NULL DEFAULT '',
    "whatsChanging" TEXT NOT NULL DEFAULT '',
    "openQuestions" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT 'human',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightTopic" (
    "insightId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "InsightTopic_pkey" PRIMARY KEY ("insightId","topicId")
);

-- CreateTable
CREATE TABLE "ArticleSupport" (
    "insightId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "relevance" TEXT NOT NULL DEFAULT 'supports',
    "excerpt" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleSupport_pkey" PRIMARY KEY ("insightId","articleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insight_slug_key" ON "Insight"("slug");

-- AddForeignKey
ALTER TABLE "InsightTopic" ADD CONSTRAINT "InsightTopic_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightTopic" ADD CONSTRAINT "InsightTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSupport" ADD CONSTRAINT "ArticleSupport_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSupport" ADD CONSTRAINT "ArticleSupport_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "UserArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
