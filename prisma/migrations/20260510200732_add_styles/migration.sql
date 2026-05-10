-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "styleId" TEXT;

-- CreateTable
CREATE TABLE "Style" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Style_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Style_name_key" ON "Style"("name");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed three default styles. ON CONFLICT keeps it safe to re-run.
INSERT INTO "Style" ("id", "name", "body", "updatedAt") VALUES
(
  'style_editorial_ft',
  'Editorial — FT',
  E'Editorial print style, inspired by the Financial Times and Bloomberg Businessweek.\n\nPalette:\n- Background: warm cream #faf6ed\n- Primary ink: near-black #1a1a1a\n- Accent (data, highlights): terracotta #c45e3e\n- Secondary accent: steel-blue #5b7a98\n- Sparing muted neutrals for grids and dividers\n\nTypography:\n- Headlines: large serif (system serif stack — Georgia, Charter), tight letter-spacing, generous size\n- Body and labels: humanist sans-serif (system sans), comfortable line height\n- All-caps with letter-spacing for category labels and metadata (e.g. "INFRASTRUCTURE · COMPUTE")\n\nLayout:\n- Single big idea per slide; supporting notes as small side callouts\n- Generous outer padding\n- For charts: thick data lines, end-of-line labels, prose callouts pointing to specific data\n- For diagrams: data-forward, minimal decoration\n\nAvoid: drop shadows, gradients, rounded boxes, illustrative icons, decorative borders, gradient fills, emoji.',
  CURRENT_TIMESTAMP
),
(
  'style_minimalist_light',
  'Minimalist — light',
  E'Minimalist app-UI style, inspired by Linear and Notion.\n\nPalette:\n- Background: pure white #ffffff\n- Primary ink: near-black #18181b\n- Single accent for emphasis (links, highlights): indigo #6366f1\n- Soft neutrals for secondary blocks: #f4f4f5, #e4e4e7\n\nTypography:\n- All sans-serif, system stack, modern and tight\n- Headlines: medium-bold weight, no all-caps\n- Body: comfortable size, generous line height\n\nLayout:\n- Quiet, calm, lots of whitespace\n- Generous padding inside cards / blocks\n- Two-column compare-and-contrast or single-column flow are both natural\n- Subtle 1px borders or very-light-gray fills delineate sections\n- No drop shadows, no gradients, no illustrative imagery\n\nAvoid: serifs anywhere, ornate borders, multiple accent colors, decorative photos, emoji.',
  CURRENT_TIMESTAMP
),
(
  'style_editorial_dark',
  'Editorial — dark',
  E'Editorial dark style, moody and after-hours, inspired by The Verge feature pieces and Pitchfork.\n\nPalette:\n- Background: deep ink #0e0e10\n- Primary text: warm white #f5f4f0\n- Accent (highlights, headlines, data): warm amber #f6b042\n- Secondary accent: dusky teal #4f9b9b\n- Subtle dark neutrals: #2a2a2d for blocks, #4a4a4d for borders\n\nTypography:\n- Headlines: large serif (system serif stack — Georgia, Charter), high weight, magazine-cover scale\n- Body and labels: clean sans-serif, slightly relaxed letter-spacing\n- Pull quotes set in serif, italics allowed\n\nLayout:\n- Dark slabs with generous padding\n- Headlines feel weighty\n- Pull quotes and callouts as bordered boxes with the amber accent\n- Charts: bright single-color data on dark grid; sparse labels\n\nAvoid: bright pure-white surfaces, heavy gradients, emoji, flat illustrations, rounded card stacks.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;
