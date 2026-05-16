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
var deploymentSelect_exports = {};
__export(deploymentSelect_exports, {
  deploymentSelect: () => deploymentSelect,
  saveSelectedDeployment: () => saveSelectedDeployment
});
module.exports = __toCommonJS(deploymentSelect_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_deploymentSelector = require("./lib/deploymentSelector.js");
var import_configure = require("./configure.js");
var import_deploy2 = require("./lib/deploy2.js");
var import_filePaths = require("./lib/localDeployment/filePaths.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_deploymentCreate = require("./deploymentCreate.js");
var import_chalk = require("chalk");
const deploymentSelect = new import_extra_typings.Command("select").summary("Select the deployment to use when running commands").description(
  "Select the deployment to use when running commands.\n\nThe deployment will be used by all `npx convex` commands, except `npx convex deploy`. You can also run individual commands on another deployment by using the --deployment flag on that command.\n\nExamples:\n  npx convex select dev                              # Select your personal cloud dev deployment in the current project\n  npx convex select local                            # Select your local deployment\n  npx convex select dev/james                        # Select a deployment in the same project by its reference\n  npx convex select some-project:dev/james           # Select a deployment in another project in the same team\n  npx convex select some-team:some-project:dev/james # Select a deployment in a particular team/project\n"
).argument("<deployment>", "The deployment to use").allowExcessArguments(false).action(async (selector) => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const currentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {});
  const parsed = (0, import_deploymentSelector.parseDeploymentSelector)(selector);
  if (currentSelection.kind === "chooseProject" && parsed.kind !== "inTeamProject" && parsed.kind !== "deploymentName" && parsed.kind !== "local") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No project configured. Run \`npx convex dev\` to set up a project first, or use a full selector like 'my-team:my-project:dev/james' or 'happy-capybara-123'.`
    });
  }
  if (parsed.kind === "local" && process.stdin.isTTY && (0, import_filePaths.loadProjectLocalConfig)(ctx) === null) {
    if (currentSelection.kind === "chooseProject") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No project configured. Run \`npx convex dev\` to set up a project first.`
      });
    }
    const wantsToCreate = await (0, import_prompts.promptYesNo)(ctx, {
      message: "No local deployment found. Create one now?",
      default: true
    });
    if (!wantsToCreate) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No local deployment found. Run ${import_chalk.chalkStderr.bold("npx convex deployment create local")} to create one.`
      });
    }
    await (0, import_deploymentCreate.createLocalDeployment)(ctx, currentSelection, true);
    return;
  }
  const newSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0,
    deployment: selector
  });
  await saveSelectedDeployment(
    ctx,
    selector,
    newSelection,
    (0, import_deploymentSelection.deploymentNameFromSelection)(currentSelection)
  );
});
async function saveSelectedDeployment(ctx, selector, selection, previousDeploymentName) {
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(ctx, selection, {
    ensureLocalRunning: false
  });
  if (deployment.deploymentFields === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null,
      errForSentry: `Unexpected selection in select: ${JSON.stringify(deployment)}`
    });
  }
  if (deployment.deploymentFields.deploymentType === "prod") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Selecting a production deployment is unsupported. To run commands on a production deployment, pass the ${import_chalk.chalkStderr.bold(`--deployment ${selector}`)} flag to each command.`
    });
  }
  const { convexSiteUrl: siteUrl } = deployment.deploymentFields.deploymentType === "local" ? { convexSiteUrl: null } : await (0, import_deploy2.fetchDeploymentCanonicalUrls)(ctx, {
    adminKey: deployment.adminKey,
    deploymentUrl: deployment.url
  });
  await (0, import_configure.updateEnvAndConfigForDeploymentSelection)(
    ctx,
    {
      url: deployment.url,
      siteUrl,
      deploymentName: deployment.deploymentFields.deploymentName,
      teamSlug: deployment.deploymentFields.teamSlug,
      projectSlug: deployment.deploymentFields.projectSlug,
      deploymentType: deployment.deploymentFields.deploymentType
    },
    previousDeploymentName
  );
}
//# sourceMappingURL=deploymentSelect.js.map
