"use strict";
import { Command, Option } from "@commander-js/extra-typings";
import {
  envGet,
  envList,
  envRemove,
  envSet
} from "./lib/env.js";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import { defaultEnvBackend } from "./lib/defaultEnv.js";
import {
  fetchTeamAndProject
} from "./lib/api.js";
import { oneoffContext } from "../bundler/context.js";
import { selectEnvDeployment } from "./env.js";
import { getProjectDetails } from "./lib/deploymentSelection.js";
function addEnvDefaultOptions(cmd) {
  return cmd.addOption(
    new Option(
      "--type <type>",
      "Manage default env vars for the given deployment type (dev, preview, prod) instead of inferring from the current deployment."
    )
  ).addOption(
    new Option(
      "--project <project>",
      "Select a project manually. Accepts `team-slug:project-slug` or just `project-slug` (team inferred from your current project). Requires --type."
    )
  );
}
const envDefaultSet = addEnvDefaultOptions(
  new Command("set").usage("[options] <name> <value>").arguments("[name] [value]").summary("Set a default variable").description(
    "Set default environment variables for your project's deployment type.\n\n  npx convex env default set NAME 'value'\n  npx convex env default set NAME # omit a value to set one interactively\n  npx convex env default set NAME --from-file value.txt\n  npx convex env default set --from-file .env.defaults\nWhen setting multiple values, it will refuse all changes if any variables are already set to different values by default. Pass --force to overwrite the provided values.\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided.\n"
  ).option(
    "--from-file <file>",
    "Read environment variables from a .env file. Without --force, fails if any existing variable has a different value."
  ).option(
    "--force",
    "When setting multiple variables, overwrite existing environment variable values instead of failing on mismatch."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (name, value, cmdOptions, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await ensureHasConvexDependency(ctx, "env default set");
  const didAnything = await envSet(ctx, backend, name, value, cmdOptions);
  if (didAnything === false) {
    cmd.outputHelp({ error: true });
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "error: No environment variables specified to be set."
    });
  }
});
const envDefaultGet = addEnvDefaultOptions(
  new Command("get").arguments("<name>").summary("Print a default variable's value").description(
    "Print a default variable's value: `npx convex env default get NAME`\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (envVarName, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await ensureHasConvexDependency(ctx, "env default get");
  await envGet(ctx, backend, envVarName);
});
const envDefaultRemove = addEnvDefaultOptions(
  new Command("remove").alias("rm").alias("unset").arguments("<name>").summary("Unset a default variable").description(
    "Unset a default variable: `npx convex env default remove NAME`\nIf the variable doesn't exist, the command doesn't do anything and succeeds.\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (name, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await ensureHasConvexDependency(ctx, "env default remove");
  await envRemove(ctx, backend, name);
});
const envDefaultList = addEnvDefaultOptions(
  new Command("list").summary("List all default variables").description(
    "List all default variables: `npx convex env default list`\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (_options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await ensureHasConvexDependency(ctx, "env default list");
  await envList(ctx, backend);
});
export const envDefault = new Command("default").summary("Manage project-level default environment variables").description(
  "Manage default environment variables for your project.\n\nThe default environment variables read and written to by this command are the ones for the deployment type of the current deployment (i.e. dev in most cases), unless --type is provided.\n\n  Set a default variable: `npx convex env default set NAME 'value'`\n  Unset a default variable: `npx convex env default remove NAME`\n  List all default variables: `npx convex env default list`\n  Print a default variable's value: `npx convex env default get NAME`\n\n"
).addCommand(envDefaultSet).addCommand(envDefaultGet).addCommand(envDefaultRemove).addCommand(envDefaultList).helpCommand(false);
async function resolveEnvDefaultBackend(options) {
  const dtypeOverride = normalizeTypeOption(options.type);
  if (options.project !== void 0) {
    const parsedProject = parseProjectOption(options.project);
    if (parsedProject === null) {
      const ctx3 = await oneoffContext(options);
      return await ctx3.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "error: --project must be `team-slug:project-slug` or `project-slug`."
      });
    }
    if (dtypeOverride === void 0) {
      const ctx3 = await oneoffContext(options);
      return await ctx3.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "error: --project requires --type to also be set."
      });
    }
    let ctx2;
    let resolved;
    if (parsedProject.kind === "teamAndProject") {
      ctx2 = await oneoffContext(options);
      resolved = {
        teamSlug: parsedProject.teamSlug,
        projectSlug: parsedProject.projectSlug
      };
    } else {
      const selected = await selectEnvDeployment(options);
      ctx2 = selected.ctx;
      if (selected.deployment.deploymentFields === null) {
        return await ctx2.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "error: --project <project-slug> requires a current cloud deployment to infer the team from. Use `team-slug:project-slug` to specify the team explicitly."
        });
      }
      const { team } = await fetchTeamAndProject(
        ctx2,
        selected.deployment.deploymentFields.deploymentName
      );
      resolved = { teamSlug: team, projectSlug: parsedProject.projectSlug };
    }
    const details = await getProjectDetails(ctx2, {
      kind: "teamAndProjectSlugs",
      teamSlug: resolved.teamSlug,
      projectSlug: resolved.projectSlug
    });
    return {
      ctx: ctx2,
      backend: defaultEnvBackend(ctx2, details.id, dtypeOverride)
    };
  }
  const { ctx, deployment } = await selectEnvDeployment(options);
  const backend = await resolveDefaultEnvBackend(
    ctx,
    deployment.deploymentFields,
    dtypeOverride
  );
  return { ctx, backend };
}
function normalizeTypeOption(type) {
  if (type === void 0) return void 0;
  if (type === "development") return "dev";
  if (type === "production") return "prod";
  return type;
}
function parseProjectOption(value) {
  const parts = value.split(":");
  if (parts.length === 1 && parts[0].length > 0) {
    return { kind: "projectOnly", projectSlug: parts[0] };
  }
  if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
    return {
      kind: "teamAndProject",
      teamSlug: parts[0],
      projectSlug: parts[1]
    };
  }
  return null;
}
export async function resolveDefaultEnvBackend(ctx, deploymentFields, dtypeOverride) {
  if (deploymentFields === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Default environment variables are only available for cloud projects."
    });
  }
  if (deploymentFields.deploymentType === "anonymous") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Default environment variables are not available for anonymous deployments."
    });
  }
  const dtype = dtypeOverride ?? resolveDefaultEnvDtype(deploymentFields.deploymentType);
  const { projectId } = await fetchTeamAndProject(
    ctx,
    deploymentFields.deploymentName
  );
  return defaultEnvBackend(ctx, projectId, dtype);
}
function resolveDefaultEnvDtype(deploymentType) {
  if (deploymentType === "local") return "dev";
  return deploymentType;
}
//# sourceMappingURL=envDefault.js.map
