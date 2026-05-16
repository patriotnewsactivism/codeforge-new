export interface GovernanceConfig {
  domainQuotas: Record<string, number>;
  growthMaxTemplates: number;
  growthEnabled: boolean;
  growthGate: boolean;
}

import * as fs from "fs";
import * as path from "path";

const GOV_PATH = path.resolve(__dirname, "governance.json");

function loadGovernance(): GovernanceConfig {
  if (!fs.existsSync(GOV_PATH)) {
    const defaultCfg: GovernanceConfig = {
      domainQuotas: { frontend: 2, backend: 2, tests: 2 },
      growthMaxTemplates: 6,
      growthEnabled: true,
      growthGate: true,
    };
    fs.mkdirSync(path.dirname(GOV_PATH), { recursive: true });
    fs.writeFileSync(GOV_PATH, JSON.stringify(defaultCfg, null, 2), "utf8");
    return defaultCfg;
  }
  try {
    return JSON.parse(fs.readFileSync(GOV_PATH, "utf8")) as GovernanceConfig;
  } catch {
    return {
      domainQuotas: { frontend: 2, backend: 2, tests: 2 },
      growthMaxTemplates: 6,
      growthEnabled: true,
      growthGate: true,
    };
  }
}

export { loadGovernance };
