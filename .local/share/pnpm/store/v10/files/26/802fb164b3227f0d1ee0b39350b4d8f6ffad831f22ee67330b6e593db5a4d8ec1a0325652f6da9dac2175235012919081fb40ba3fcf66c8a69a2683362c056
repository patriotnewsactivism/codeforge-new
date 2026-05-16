import { Context } from "../../../bundler/context.js";
import { OnDeploymentActivityFunc } from "../deployment.js";
export type DeploymentDetails = {
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
    onActivity: OnDeploymentActivityFunc;
};
export declare function handleLocalDeployment(ctx: Context, options: {
    teamSlug: string;
    projectSlug: string;
    ports: {
        cloud: number | undefined;
        site: number | undefined;
    };
    backendVersion?: string | undefined;
    forceUpgrade: boolean;
}): Promise<DeploymentDetails>;
export declare function loadLocalDeploymentCredentials(ctx: Context, deploymentName: string): Promise<{
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
}>;
/** Copies the default dev env vars from big brain the first time the local dev backend is started */
export declare function importDefaultEnvVars(ctx: Context, { teamSlug, projectSlug, deploymentName, deploymentUrl, adminKey, }: {
    teamSlug: string;
    projectSlug: string;
    deploymentName: string;
    deploymentUrl: string;
    adminKey: string;
}): Promise<void>;
//# sourceMappingURL=localDeployment.d.ts.map