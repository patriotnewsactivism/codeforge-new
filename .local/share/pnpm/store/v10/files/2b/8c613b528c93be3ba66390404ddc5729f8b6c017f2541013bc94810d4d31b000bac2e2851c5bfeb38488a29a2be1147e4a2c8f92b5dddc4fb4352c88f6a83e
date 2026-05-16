"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var envDefault_exports = {};
__export(envDefault_exports, {
  envDefault: () => envDefault,
  resolveDefaultEnvBackend: () => resolveDefaultEnvBackend
});
module.exports = __toCommonJS(envDefault_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_env = require("./lib/env.js");
var import_utils = require("./lib/utils/utils.js");
var import_defaultEnv = require("./lib/defaultEnv.js");
var import_api = require("./lib/api.js");
var import_context = require("../bundler/context.js");
var import_env2 = require("./env.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
function addEnvDefaultOptions(cmd) {
  return cmd.addOption(
    new import_extra_typings.Option(
      "--type <type>",
      "Manage default env vars for the given deployment type (dev, preview, prod) instead of inferring from the current deployment."
    )
  ).addOption(
    new import_extra_typings.Option(
      "--project <project>",
      "Select a project manually. Accepts `team-slug:project-slug` or just `project-slug` (team inferred from your current project). Requires --type."
    )
  );
}
const envDefaultSet = addEnvDefaultOptions(
  new import_extra_typings.Command("set").usage("[options] <name> <value>").arguments("[name] [value]").summary("Set a default variable").description(
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
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env default set");
  const didAnything = await (0, import_env.envSet)(ctx, backend, name, value, cmdOptions);
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
  new import_extra_typings.Command("get").arguments("<name>").summary("Print a default variable's value").description(
    "Print a default variable's value: `npx convex env default get NAME`\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (envVarName, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env default get");
  await (0, import_env.envGet)(ctx, backend, envVarName);
});
const envDefaultRemove = addEnvDefaultOptions(
  new import_extra_typings.Command("remove").alias("rm").alias("unset").arguments("<name>").summary("Unset a default variable").description(
    "Unset a default variable: `npx convex env default remove NAME`\nIf the variable doesn't exist, the command doesn't do anything and succeeds.\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (name, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env default remove");
  await (0, import_env.envRemove)(ctx, backend, name);
});
const envDefaultList = addEnvDefaultOptions(
  new import_extra_typings.Command("list").summary("List all default variables").description(
    "List all default variables: `npx convex env default list`\nThe deployment type is determined by the current deployment (local maps to dev), or by --type if provided."
  ).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false)
).action(async (_options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, backend } = await resolveEnvDefaultBackend(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env default list");
  await (0, import_env.envList)(ctx, backend);
});
const envDefault = new import_extra_typings.Command("default").summary("Manage project-level default environment variables").description(
  "Manage default environment variables for your project.\n\nThe default environment variables read and written to by this command are the ones for the deployment type of the current deployment (i.e. dev in most cases), unless --type is provided.\n\n  Set a default variable: `npx convex env default set NAME 'value'`\n  Unset a default variable: `npx convex env default remove NAME`\n  List all default variables: `npx convex env default list`\n  Print a default variable's value: `npx convex env default get NAME`\n\n"
).addCommand(envDefaultSet).addCommand(envDefaultGet).addCommand(envDefaultRemove).addCommand(envDefaultList).helpCommand(false);
async function resolveEnvDefaultBackend(options) {
  const dtypeOverride = normalizeTypeOption(options.type);
  if (options.project !== void 0) {
    const parsedProject = parseProjectOption(options.project);
    if (parsedProject === null) {
      const ctx3 = await (0, import_context.oneoffContext)(options);
      return await ctx3.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "error: --project must be `team-slug:project-slug` or `project-slug`."
      });
    }
    if (dtypeOverride === void 0) {
      const ctx3 = await (0, import_context.oneoffContext)(options);
      return await ctx3.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "error: --project requires --type to also be set."
      });
    }
    let ctx2;
    let resolved;
    if (parsedProject.kind === "teamAndProject") {
      ctx2 = await (0, import_context.oneoffContext)(options);
      resolved = {
        teamSlug: parsedProject.teamSlug,
        projectSlug: parsedProject.projectSlug
      };
    } else {
      const selected = await (0, import_env2.selectEnvDeployment)(options);
      ctx2 = selected.ctx;
      if (selected.deployment.deploymentFields === null) {
        return await ctx2.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "error: --project <project-slug> requires a current cloud deployment to infer the team from. Use `team-slug:project-slug` to specify the team explicitly."
        });
      }
      const { team } = await (0, import_api.fetchTeamAndProject)(
        ctx2,
        selected.deployment.deploymentFields.deploymentName
      );
      resolved = { teamSlug: team, projectSlug: parsedProject.projectSlug };
    }
    const details = await (0, import_deploymentSelection.getProjectDetails)(ctx2, {
      kind: "teamAndProjectSlugs",
      teamSlug: resolved.teamSlug,
      projectSlug: resolved.projectSlug
    });
    return {
      ctx: ctx2,
      backend: (0, import_defaultEnv.defaultEnvBackend)(ctx2, details.id, dtypeOverride)
    };
  }
  const { ctx, deployment } = await (0, import_env2.selectEnvDeployment)(options);
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
async function resolveDefaultEnvBackend(ctx, deploymentFields, dtypeOverride) {
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
  const { projectId } = await (0, import_api.fetchTeamAndProject)(
    ctx,
    deploymentFields.deploymentName
  );
  return (0, import_defaultEnv.defaultEnvBackend)(ctx, projectId, dtype);
}
function resolveDefaultEnvDtype(deploymentType) {
  if (deploymentType === "local") return "dev";
  return deploymentType;
}
//# sourceMappingURL=envDefault.js.map
