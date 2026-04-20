export type Article = {
  d: string
  sec: string
  t: string
  by: string | null
  th: Record<string, string[]>
  url?: string | null
  source?: string | null
}

export type ThemeConfig = {
  name: string
  subs: string[]
}

export const themeConfig: ThemeConfig[] = [
  {name:"Anthropic & Mythos", subs:["Mythos launch","Access & deployment","Government response"]},
  {name:"Anthropic vs Pentagon", subs:["Supply-chain-risk label","Negotiations & breakdown","Legal battle","Industry & politics","Commentary & opinion"]},
  {name:"OpenAI", subs:["Altman & leadership","Products & strategy"]},
  {name:"AI Industry & Models", subs:["New models & releases","Products & strategy","Benchmarks & capability","Agents","Chips & hardware"]},
  {name:"Cybersecurity & Defense", subs:["Offensive capability","Vulnerabilities & patching"]},
  {name:"War & Military", subs:["Iran conflict","Defense contracts","Drones & autonomy","Arms race & weapons"]},
  {name:"China & Geopolitics", subs:[]},
  {name:"Politics & Elections", subs:["Trump administration","Midterms & campaigns","Lobbying & money","Government use"]},
  {name:"Legal & Regulation", subs:["Courts & lawsuits","State legislation","Federal policy"]},
  {name:"Jobs & Labor", subs:["Future of work","Coders & software","Layoffs & cuts","Tiny teams","Young workers & grads"]},
  {name:"Business & Economy", subs:["Markets & finance","Startups & VC","Corporate pivots","Inequality & wealth"]},
  {name:"Data Centers & Energy", subs:["Power & grid","Local opposition","Real estate & capital"]},
  {name:"AI Safety & Risks", subs:["Model behavior","Personal harm","Existential & systemic","Interpretability & alignment"]},
  {name:"AI Misuse & Slop", subs:["Deepfakes & impersonation","Content fraud","Hallucinations & errors"]},
  {name:"Companions & Relationships", subs:[]},
  {name:"Health & Medicine", subs:[]},
  {name:"Education", subs:[]},
  {name:"Arts & Creative", subs:["Writing & publishing","Visual art & design","Performance & film"]},
  {name:"Society & Culture", subs:["Discourse & ideas","Creativity & taste","Public backlash","Young people"]},
  {name:"Daily Life & Tools", subs:[]},
]
