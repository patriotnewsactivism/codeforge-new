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
var deploymentTokenCreate_exports = {};
__export(deploymentTokenCreate_exports, {
  deploymentTokenCreate: () => deploymentTokenCreate
});
module.exports = __toCommonJS(deploymentTokenCreate_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = require("chalk");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_envvars = require("./lib/envvars.js");
var import_utils = require("./lib/utils/utils.js");
const deploymentTokenCreate = new import_extra_typings.Command("create").summary("Create an access token").description(
  `Creates a deploy key that, when set as ${import_chalk.chalkStderr.bold(import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME)}, scopes all commands to the target deployment. Defaults to the current deployment if '--deployment' isn't passed

  Print a new deploy key to stdout:           \`npx convex deployment token create my-token\`
  Save a new deploy key in ${import_utils.ENV_VAR_FILE_PATH}:        \`npx convex deployment token create my-token --save-env\`
  Save a new deploy key in a custom env file: \`npx convex deployment token create ci-token --save-env .env.production\`
  Create a key for the project's prod:        \`npx convex deployment token create ci-token --deployment prod\`
`
).argument("<name>", "Name for the new deploy key").allowExcessArguments(false).option(
  "--save-env [path]",
  `Save the new key as ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME} in an env file instead of printing it. Defaults to ${import_utils.ENV_VAR_FILE_PATH}.`
).addDeploymentSelectionOptions((0, import_command.actionDescription)("Create a deploy key for")).showHelpAfterError().action(async (name, options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  const auth = ctx.bigBrainAuth();
  if (auth === null || auth.kind !== "accessToken") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Creating a deploy key currently requires being logged in with a personal access token. ${process.env[import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME] ? `Unset ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME}` : process.env[import_utils.CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME] ? `Unset ${import_utils.CONVEX_DEPLOYMENT_TOKEN_ENV_VAR_NAME}` : `Run ${import_chalk.chalkStderr.bold("npx convex login")}`} and try again.`
    });
  }
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    { ensureLocalRunning: false }
  );
  if (deployment.deploymentFields === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Cannot create a deploy key for a self-hosted deployment."
    });
  }
  const { deploymentName, deploymentType } = deployment.deploymentFields;
  if (deploymentType === "local" || deploymentType === "anonymous") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot create a deploy key for a ${deploymentType} deployment.`
    });
  }
  (0, import_log.showSpinner)(`Creating deploy key for ${deploymentName}...`);
  const response = await (0, import_utils.typedPlatformClient)(ctx).POST(
    "/deployments/{deployment_name}/create_deploy_key",
    {
      params: { path: { deployment_name: deploymentName } },
      body: { name }
    }
  );
  const deployKey = response.data.deployKey;
  if (options.saveEnv === void 0) {
    (0, import_log.logFinishedStep)(`Created deploy key "${name}" for ${deploymentName}.`);
    (0, import_log.logOutput)(deployKey);
    return;
  }
  const envFile = typeof options.saveEnv === "string" ? options.saveEnv : import_utils.ENV_VAR_FILE_PATH;
  const existingFileContent = ctx.fs.exists(envFile) ? ctx.fs.readUtf8File(envFile) : null;
  const updatedContent = (0, import_envvars.changedEnvVarFile)({
    existingFileContent,
    envVarName: import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
    envVarValue: deployKey,
    commentAfterValue: null,
    commentOnPreviousLine: null
  });
  if (updatedContent === null) {
    (0, import_log.logFinishedStep)(
      `Deploy key for ${deploymentName} already present in ${envFile}; no changes made.`
    );
    return;
  }
  ctx.fs.writeUtf8File(envFile, updatedContent);
  (0, import_log.logFinishedStep)(
    `Saved deploy key "${name}" for ${deploymentName} as ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME} in ${envFile}.`
  );
});
//# sourceMappingURL=deploymentTokenCreate.js.map
