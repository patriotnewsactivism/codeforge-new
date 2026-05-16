// Convex function references for the shared CodeForge Convex deployment
// These mirror the functions defined in artifacts/codeforge/convex/
// Using internal Convex FunctionReference format since we can't import
// the generated types from the sibling web artifact directly.

// @ts-ignore
function ref(path: string): any {
  return { _type: "reference", _functionPath: path };
}

export const api = {
  projects: {
    list: ref("projects:list"),
    get: ref("projects:get"),
    create: ref("projects:create"),
    remove: ref("projects:remove"),
    updateLastOpened: ref("projects:updateLastOpened"),
    setGithubRepo: ref("projects:setGithubRepo"),
  },
  files: {
    listByProject: ref("files:listByProject"),
    getByPath: ref("files:getByPath"),
    updateContent: ref("files:updateContent"),
    create: ref("files:create"),
    remove: ref("files:remove"),
  },
  auth: {
    currentUser: ref("auth:currentUser"),
  },
  chat: {
    listSessions: ref("chat:listSessions"),
    listMessages: ref("chat:listMessages"),
    createSession: ref("chat:createSession"),
    getOrCreateSession: ref("chat:getOrCreateSession"),
    sendMessage: ref("chat:sendMessage"),
  },
  git: {
    importFromGitHub: ref("git:importFromGitHub"),
    listCommits: ref("git:listCommits"),
    listBranches: ref("git:listBranches"),
    getActiveBranch: ref("git:getActiveBranch"),
    pushToGitHub: ref("git:pushToGitHub"),
  },
  users: {
    registerPushToken: ref("users:registerPushToken"),
  },
  buildLoop: {
    getActiveSession: ref("buildLoop:getActiveSession"),
  },
};
