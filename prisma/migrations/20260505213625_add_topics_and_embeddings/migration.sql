-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "UserArticle" ADD COLUMN     "abstract" TEXT,
ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT 'news',
ADD COLUMN     "fullText" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'accepted';

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingestConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicArticle" (
    "topicId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicArticle_pkey" PRIMARY KEY ("topicId","articleId")
);

-- CreateTable
CREATE TABLE "ArticleEmbedding" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleEmbedding_articleId_chunkIndex_key" ON "ArticleEmbedding"("articleId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "TopicArticle" ADD CONSTRAINT "TopicArticle_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicArticle" ADD CONSTRAINT "TopicArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "UserArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleEmbedding" ADD CONSTRAINT "ArticleEmbedding_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "UserArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (HNSW for cosine-distance vector search)
CREATE INDEX "ArticleEmbedding_embedding_cosine_idx" ON "ArticleEmbedding" USING hnsw ("embedding" vector_cosine_ops);
