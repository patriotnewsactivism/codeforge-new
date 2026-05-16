import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

type SubTask = {
  id: string;
  description: string;
  domain: "frontend" | "backend" | "tests" | "docs" | "tools";
};
type AgentTemplate = {
  id: string;
  domain: string;
  promptTemplate: string;
  tools: string[];
  successCriteria: string;
  maxConcurrent?: number;
};

type RunResult = {
  success: boolean;
  artifacts?: any;
  improvements?: string[];
};

const WORKSPACE_ROOT = path.resolve("C:\\codeforge-v2\\.kilo\\workers");
const IMAGE_MAP: Record<string, string> = {
  frontend: "codeforge/frontend-cadet:latest",
  backend: "codeforge/backend-cadet:latest",
  tests: "codeforge/tests-cadet:latest",
  hybrid: "codeforge/hybrid-cadet:latest",
};

async function exec(
  cmd: string,
  args: string[],
  timeoutMs: number = 600000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let o = "",
      e = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
    }, timeoutMs);
    proc.stdout.on("data", d => (o += d.toString()));
    proc.stderr.on("data", d => (e += d.toString()));
    proc.on("error", err => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", code => {
      clearTimeout(timer);
      resolve({ code, stdout: o, stderr: e });
    });
  });
}

export async function ensureDockerAvailable(): Promise<boolean> {
  try {
    const res = await exec("docker", ["version"], 120000);
    return res.code === 0;
  } catch {
    return false;
  }
}

export async function pullImagesIfNeeded(
  templates: AgentTemplate[],
): Promise<void> {
  const domains = Array.from(new Set(templates.map(t => t.domain)));
  for (const d of domains) {
    const img = IMAGE_MAP[d] ?? IMAGE_MAP["frontend"];
    await execDocker(["pull", img]);
  }
}

function execDocker(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const dockerCmd = "docker";
  return exec(dockerCmd, args, 600000);
}

export async function runWorker(
  template: AgentTemplate,
  task: SubTask,
): Promise<RunResult> {
  const workspace = path.resolve(WORKSPACE_ROOT, `${template.id}_${task.id}`);
  fs.mkdirSync(workspace, { recursive: true });
  const inputPath = path.join(workspace, "input.json");
  const artifactsPath = path.join(workspace, "artifacts.json");
  const input = { task, template };
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2), "utf8");

  const image = IMAGE_MAP[template.domain] ?? IMAGE_MAP.frontend;
  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${workspace}:/work`,
    "-w",
    "/work",
    image,
    "bash",
    "-lc",
    "if [ -f /work/input.json ]; then echo RUNNING; else echo NO_INPUT; fi; sleep 0.1; true",
  ];
  try {
    const res = await execDocker(dockerArgs);
    if (res.code !== 0) {
      return {
        success: false,
        artifacts: { logs: res.stdout, error: res.stderr },
        improvements: ["Docker run failed"],
      };
    }
  } catch (e) {
    return {
      success: false,
      artifacts: { logs: "", error: String(e) },
      improvements: ["Docker run exception"],
    };
  }

  let artifacts = null;
  if (fs.existsSync(artifactsPath)) {
    try {
      artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
    } catch {
      artifacts = null;
    }
  }

  const improvements =
    artifacts && artifacts.improvements
      ? artifacts.improvements
      : [`Agent ${template.id} executed on ${task.description}`];
  const ok = artifacts != null && (artefactsHasCode(artifacts) || false);
  return { success: ok, artifacts: artifacts ?? { logs: "" }, improvements };
}

function artefactsHasCode(a: any) {
  if (!a) return false;
  if (a.code) return true;
  if (a.output) return true;
  return false;
}
