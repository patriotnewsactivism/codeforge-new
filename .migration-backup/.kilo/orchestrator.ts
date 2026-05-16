import * as fs from "fs";
import * as path from "path";
import { loadGovernance } from "./governance";
import { runWorker } from "./workers/manager";

type SubTask = {
  id: string;
  description: string;
  domain: "frontend" | "backend" | "tests" | "docs" | "tools";
};
interface AgentTemplate {
  id: string;
  domain: string;
  promptTemplate: string;
  tools: string[];
  successCriteria: string;
  maxConcurrent?: number;
}
interface AgentInstance {
  id: string;
  templateId: string;
  task: SubTask;
  status: "pending" | "running" | "completed" | "failed";
  artifacts?: any;
  improvements?: string[];
}
interface KnowledgeBaseEntry {
  id: string;
  task: SubTask;
  templateId: string;
  result: any;
  improvements?: string[];
  createdAt: string;
}

const KB_PATH = path.resolve(__dirname, "knowledgeBase.json");
const TEMPL_PATH = path.resolve(__dirname, "templates.json");

function readJSON<T>(p: string, fallback: T): T {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function writeJSON(p: string, data: any) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function loadTemplates(): AgentTemplate[] {
  const defaultTemplates: AgentTemplate[] = [
    {
      id: "FrontendCadet",
      domain: "frontend",
      promptTemplate: "You are Frontend Cadet. Task: {task.description}.",
      tools: ["lint", "typecheck"],
      successCriteria: "build+tests",
    },
    {
      id: "BackendCadet",
      domain: "backend",
      promptTemplate: "You are Backend Cadet. Task: {task.description}.",
      tools: ["lint", "typecheck"],
      successCriteria: "build+tests",
    },
    {
      id: "TestsCadet",
      domain: "tests",
      promptTemplate: "You are Tests Cadet. Task: {task.description}.",
      tools: ["test-runner"],
      successCriteria: "tests pass",
    },
  ];
  if (!fs.existsSync(TEMPL_PATH)) {
    writeJSON(TEMPL_PATH, defaultTemplates);
    return defaultTemplates;
  }
  const loaded = readJSON<AgentTemplate[]>(TEMPL_PATH, []);
  return loaded.length ? loaded : defaultTemplates;
}

function ensureKB(): KnowledgeBaseEntry[] {
  if (!fs.existsSync(KB_PATH)) writeJSON(KB_PATH, []);
  return readJSON<KnowledgeBaseEntry[]>(KB_PATH, []);
}

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function decomposeTask(taskDesc: string): SubTask[] {
  return [
    {
      id: nextId("sub"),
      description: `Implement: ${taskDesc} - frontend changes`,
      domain: "frontend",
    },
    {
      id: nextId("sub"),
      description: `Implement: ${taskDesc} - backend API layer`,
      domain: "backend",
    },
    {
      id: nextId("sub"),
      description: `Tests & validation for: ${taskDesc}`,
      domain: "tests",
    },
  ];
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export async function runPlan(taskDesc: string) {
  const knowledge = ensureKB();
  const templates = loadTemplates();
  const governance = loadGovernance();
  const subtasks = decomposeTask(taskDesc);

  // simple in-flight tracking
  const domainQuota: Record<string, number> = governance.domainQuotas;
  // compute current usage from knowledge base
  const usage: Record<string, number> = {};
  knowledge.forEach(k => {
    const dom = k.task.domain;
    usage[dom] = (usage[dom] || 0) + 1;
  });

  const inFlight: AgentInstance[] = [];
  const results: { sub: SubTask; tmpl: AgentTemplate; res: any }[] = [];

  // basic concurrency control
  const MAX_PARALLEL = 2;
  const running: Promise<any>[] = [];

  const spawnIfPossible = async (sub: SubTask, tmpl: AgentTemplate) => {
    // gate by quota
    const used = usage[sub.domain] ?? 0;
    if (used >= (domainQuota[sub.domain] ?? 0)) {
      return false;
    }
    // mark usage
    usage[sub.domain] = used + 1;
    const res = await require("./workers/manager").runWorker(tmpl, sub);
    // persist knowledge base entry
    knowledge.push({
      id: nextId("kb"),
      task: sub,
      templateId: tmpl.id,
      result: res,
      improvements: res.improvements,
      createdAt: new Date().toISOString(),
    });
    // update template on improvements
    if (res.improvements && res.improvements.length > 0) {
      // naive append to promptTemplate for brevity
      tmpl.promptTemplate =
        tmpl.promptTemplate +
        "\n" +
        res.improvements.map(i => "// " + i).join("\n");
    }
    results.push({ sub, tmpl, res });
    return true;
  };

  // process subtasks queue with simple greedy concurrency
  for (const sub of subtasks) {
    const tmpl = templates.find(t => t.domain === sub.domain) ?? templates[0];
    const p = spawnIfPossible(sub, tmpl).then(done => done);
    running.push(p);
    if (running.length >= MAX_PARALLEL) {
      await Promise.race(running);
      // prune finished promises
      for (let i = running.length - 1; i >= 0; i--) {
        if ((running[i] as any).isFulfilled) {
          running.splice(i, 1);
        }
      }
    }
  }
  // wait for all
  await Promise.all(running);

  // governance: prune if needed
  const templatesAfter: any[] = templates;
  if (
    governance.growthEnabled &&
    templatesAfter.length > governance.growthMaxTemplates
  ) {
    // simple prune: keep first N
    const keep = governance.growthMaxTemplates;
    while (templatesAfter.length > keep) templatesAfter.pop();
    writeJSON(TEMPL_PATH, templatesAfter);
  }

  writeJSON(KB_PATH, knowledge);
  // metrics could be appended here
  return { spawned: results.length, knowledge: knowledge.length };
}

// CLI entrypoint
if (require.main === module) {
  const arg = process.argv[2] || "Add feature X to the project";
  runPlan(arg)
    .then(r => console.log("Plan complete", r))
    .catch(e => console.error(e));
}
