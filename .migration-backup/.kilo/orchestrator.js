const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const knowledgePath = path.resolve(__dirname, "knowledgeBase.json");
const templatesPath = path.resolve(__dirname, "templates.json");

function readJSON(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(p, data) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function ensureKB() {
  if (!fs.existsSync(knowledgePath)) writeJSON(knowledgePath, []);
  return readJSON(knowledgePath, []);
}

function loadTemplates() {
  const defaultTemplates = [
    {
      id: "FrontendCadet",
      domain: "frontend",
      promptTemplate:
        "You are Frontend Cadet. Task: {task.description}. Provide code changes, plus brief docs and unit tests. Use tools: lint, typecheck.",
      commands: {
        lint: "npm run lint --silent",
        build: "npm run build --silent",
        test: "npm test --silent",
      },
      maxConcurrent: 2,
      successCriteria: "build + tests",
    },
    {
      id: "BackendCadet",
      domain: "backend",
      promptTemplate:
        "You are Backend Cadet. Task: {task.description}. Provide API/backend code with tests and docs. Use tooling to ensure reliability.",
      commands: {
        lint: "npm run lint --silent",
        build: "npm run build --silent",
        test: "npm test --silent",
      },
      maxConcurrent: 2,
      successCriteria: "build + tests",
    },
    {
      id: "TestsCadet",
      domain: "tests",
      promptTemplate:
        "You are Tests Cadet. Task: {task.description}. Write tests and ensure coverage. Provide minimal docs.",
      commands: { test: "npm test --silent" },
      maxConcurrent: 2,
      successCriteria: "tests pass",
    },
  ];
  if (!fs.existsSync(templatesPath)) {
    writeJSON(templatesPath, defaultTemplates);
    return defaultTemplates;
  }
  const loaded = readJSON(templatesPath, []);
  return loaded.length ? loaded : defaultTemplates;
}

function nextId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function decomposeTask(taskDesc) {
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

function selectTemplateForDomain(domain, templates) {
  const t = templates.find(x => x.domain === domain) ?? templates[0];
  return t;
}

function runShell(cmd, workDir) {
  return new Promise(resolve => {
    const sp = spawn(cmd, {
      shell: true,
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    sp.stdout.on("data", d => (out += d.toString()));
    sp.stderr.on("data", d => (err += d.toString()));
    sp.on("close", code => resolve({ code, stdout: out, stderr: err }));
  });
}

async function executeAgent(template, task) {
  const workDir = process.cwd();
  const cmds = [];
  if (template.commands?.lint) cmds.push(template.commands.lint);
  if (template.commands?.build) cmds.push(template.commands.build);
  if (template.commands?.test) cmds.push(template.commands.test);
  let logs = "";
  for (const c of cmds) {
    const res = await runShell(c, workDir);
    logs += `[${c}] code=${res.code}\n${res.stdout}${res.stderr}`;
    if (res.code !== 0)
      return {
        success: false,
        artifacts: { logs: logs },
        improvements: [`Command failed: ${c}`],
      };
  }
  const artifacts = {
    logs: logs,
    summary: `Agent ${template.id} completed ${task.description}`,
  };
  const improvements = [
    `Template ${template.id}: task ${task.description} completed`,
  ];
  return { success: true, artifacts, improvements };
}

function applyImprovementsToTemplates(templateId, improvements, templates) {
  return templates.map(t =>
    t.id === templateId
      ? {
          ...t,
          promptTemplate:
            t.promptTemplate +
            "\n" +
            improvements.map(i => "// " + i).join("\n"),
        }
      : t,
  );
}

function maybeCreateNewTemplateFromImprovements(improvements, templates) {
  const cross = improvements.some(i =>
    i.toLowerCase().includes("cross-domain"),
  );
  if (cross) {
    const hybrid = {
      id: "HybridCadet",
      domain: "frontend",
      promptTemplate:
        "HybridCadet: cross-domain capabilities. Task: {task.description}.",
      commands: {
        lint: "npm run lint --silent",
        build: "npm run build --silent",
        test: "npm test --silent",
      },
      maxConcurrent: 2,
      successCriteria: "hybrid success",
    };
    if (!templates.find(t => t.id === hybrid.id)) return [...templates, hybrid];
  }
  return templates;
}

async function runPlan(taskDesc) {
  const knowledge = ensureKB();
  let templates = loadTemplates();
  const subtasks = decomposeTask(taskDesc);
  const spawned = [];
  for (const sub of subtasks) {
    const tmpl = selectTemplateForDomain(sub.domain, templates);
    const res = await executeAgent(tmpl, sub);
    const entry = {
      id: nextId("kb"),
      task: sub,
      templateId: tmpl.id,
      result: res,
      improvements: res.improvements,
      createdAt: new Date().toISOString(),
    };
    knowledge.push(entry);
    if (res.improvements && res.improvements.length > 0) {
      templates = applyImprovementsToTemplates(
        tmpl.id,
        res.improvements,
        templates,
      );
    }
    spawned.push({
      id: nextId("agent"),
      templateId: tmpl.id,
      task: sub,
      status: res.success ? "completed" : "failed",
      artifacts: res.artifacts,
      improvements: res.improvements,
    });
  }
  templates = maybeCreateNewTemplateFromImprovements(
    spawned.flatMap(s => s.improvements ?? []),
    templates,
  );
  writeJSON(templatesPath, templates);
  writeJSON(knowledgePath, knowledge);
  return { spawned, knowledge };
}

module.exports = { runPlan };

if (require.main === module) {
  const arg = process.argv[2] || "Add feature X to the project";
  runPlan(arg)
    .then(r => {
      console.log("Plan executed. Subtasks:", r.spawned.length);
    })
    .catch(e => {
      console.error(e);
    });
}
