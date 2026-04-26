import * as fs from 'fs'
import * as path from 'path'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()
import { prisma } from '../src/lib/db'

const COURSE_ID = 'cmo6i1nw40062ns3dphwow5af' // TPAI APR 2026

type BeatSpec =
  | { kind: 'section_header'; title: string }
  | { kind: 'slide'; slideType: 'text' | 'diagram'; title?: string; outline: string }

const beats: BeatSpec[] = [
  // A. Opening (≈10 min)
  { kind: 'section_header', title: 'What changed in 2026' },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'A two-axis shift',
    outline:
      "Frame the moment for an educated, non-technical audience: AI got dramatically more capable in two ways at once — smarter on its own, AND much better at being put to work. This is not a single-axis shift like 'bigger model = better answers.' Set this two-axis idea up as the spine of the whole session. Punchy and declarative; no jargon.",
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: "This isn't another hype cycle",
    outline:
      "Push back on hype-cycle skepticism for an audience that has watched many tech waves come and go. Three concrete things AI is finishing in 2026 that were impossible 18 months ago — named systems, named companies, real outcomes. Specific, demonstrable, not 'transforming everything.'",
  },

  // B. The AI vs. what we build around it (≈35 min)
  { kind: 'section_header', title: 'The AI is no longer the whole product' },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'Same brain, different outcomes',
    outline:
      'A thought experiment: take the same AI model and put it in two different setups — a chat window vs. a coding tool with file access. Same brain, very different outcomes. Why? Because what we build around the AI is now most of the capability. Use this to set up the rest of the section.',
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'What got smarter in the AI itself',
    outline:
      "What got smarter inside the AI in 2026, in plain language. Better at multi-step reasoning. Better at knowing what it doesn't know. Better at sustained focus on a long task. Avoid technical terms like 'parameters' or 'context window' — describe the experience, not the architecture.",
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'What got smarter around the AI',
    outline:
      "What got smarter in the workflow scaffolding around the AI: tools the AI can use, memory it can carry across steps, the ability to plan and revise. Frame this as the bigger surprise of 2026 — most of the capability gain came from this layer, not from the model getting smarter. Use 'scaffolding' or 'workflow' rather than 'harness'.",
  },
  {
    kind: 'slide',
    slideType: 'diagram',
    title: 'AI + scaffolding stack',
    outline:
      "A simple visual diagram showing the AI in the middle, with a labeled layer of scaffolding around it: tools, memory, planning, checking. Show with an arrow or label that 'effective capability = AI + scaffolding'. Clean, readable at presentation distance, no technical jargon. Targeted at a non-technical educated audience.",
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'The contested next leap',
    outline:
      'Stake the contested claim: where does the next big leap come from — making the AI smarter, or building better workflows around it? The bills are very different: smarter models cost billions in compute; better scaffolding is mostly engineering and design. Name who holds each view (named labs, named investors). Surface the disagreement, do not hedge.',
  },
  { kind: 'section_header', title: 'Discussion: where does "the AI" live in your work?' },

  // C. AI that does things (≈35 min)
  { kind: 'section_header', title: 'AI that finishes jobs, not just answers questions' },
  {
    kind: 'slide',
    slideType: 'text',
    title: '50 steps on its own',
    outline:
      "What is genuinely new in 2026: AI that takes 50 steps on its own to complete real work — not a chatbot, not a search engine. It makes a plan, uses tools, checks its own output, adjusts, and finishes. Set this up as the real shift this year, not hype. Use a concrete example to anchor it (e.g. 'fix a bug in this codebase' or 'reconcile these spreadsheets').",
  },
  {
    kind: 'slide',
    slideType: 'diagram',
    title: 'How an AI loop works',
    outline:
      "A simple visual diagram of an AI work loop: plan → take a step → check the result → adjust → finish. Use a concrete worked example as the labels (e.g. 'fix a bug': read code → propose change → run tests → revise → done). Should be readable at a glance and not require technical vocabulary.",
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'Where this is working today',
    outline:
      "Where AI-that-does-things is actually delivering work today. Concrete domains with named systems and companies: software engineering (specific examples), customer service triage, document review, research synthesis. Be specific, with numbers where you have them. Avoid vague 'transforming workflows' framing.",
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'Where it falls apart',
    outline:
      "Where AI-that-does-things still breaks: the brittle middle of complex jobs. Work that requires judgment under ambiguity, context that isn't written down, novel situations. Be honest about the gap between 'demo works' and 'reliable in production.' This is what your audience will care about.",
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'How much without checking in?',
    outline:
      'The real question this raises for organizations: how much should AI do without checking in with a person? Frame as a contested choice between high-autonomy (efficient but risky) and low-autonomy (slower but accountable). Name the trade-off in concrete operational terms — what breaks at each end. Stake a position.',
  },
  {
    kind: 'section_header',
    title: 'Discussion: which jobs in your world are already partly done by AI?',
  },

  // D. Synthesis (≈30 min)
  { kind: 'section_header', title: 'What this implies' },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'Three takeaways',
    outline:
      'Three takeaways summarizing how the capability frontier has shifted in 2026: (1) capability moves on two axes, not one; (2) most of 2026 progress is at the workflow/scaffolding layer; (3) AI that finishes jobs is a real shift, not hype. Each takeaway one short declarative line. Punchy.',
  },
  {
    kind: 'slide',
    slideType: 'text',
    title: 'Bridge to Session 2',
    outline:
      "Bridge to next session. Capability raises two questions we'll tackle next time: the bill (compute, energy, money — what does this actually cost, and who pays?) and the people side (how does this change work; who decides what AI does without supervision?). Plant the seeds for the systems lens of Session 2.",
  },
]

async function main() {
  const course = await prisma.course.findUnique({ where: { id: COURSE_ID } })
  if (!course) {
    console.error(`Course ${COURSE_ID} not found`)
    process.exit(1)
  }

  const last = await prisma.session.findFirst({
    where: { courseId: COURSE_ID },
    orderBy: { position: 'desc' },
  })
  const position = (last?.position ?? -1) + 1

  const session = await prisma.session.create({
    data: {
      courseId: COURSE_ID,
      position,
      title: 'Session 1: What LLMs can do now',
      description:
        'Capability — how the AI itself and the workflows around it have advanced in 2026. For a 2-hour class with an older, educated, non-technical audience.',
    },
  })
  console.log(`Created session ${session.id}: "${session.title}"`)

  for (let i = 0; i < beats.length; i++) {
    const b = beats[i]
    const data: any = { sessionId: session.id, position: i, kind: b.kind }
    if (b.kind === 'section_header') {
      data.title = b.title
    } else {
      data.slideType = b.slideType
      data.title = b.title ?? null
      data.outline = b.outline
    }
    await prisma.beat.create({ data })
  }
  console.log(`Created ${beats.length} beats`)
  console.log(`\nOpen: /sessions/${session.id}/edit`)
}
main().finally(() => prisma.$disconnect())
