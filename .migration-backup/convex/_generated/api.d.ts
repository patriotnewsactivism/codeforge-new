/* eslint-disable */
/**
 * Generated `api` utility.
 * THIS CODE IS AUTOMATICALLY GENERATED.
 * To regenerate, run `npx convex dev`.
 */

import type { AnyApi, FilterApi, FunctionReference } from "convex/server";

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const fullApi: AnyApi;

// Module references (typed)
// api.ViktorSpacesEmail.ViktorSpacesEmail
// api.ViktorSpacesEmail.ViktorSpacesPasswordReset
// api.agentThoughts.listRecent
// api.agentThoughts.emit
// api.agentThoughts.clearForProject
// api.agents.listTasks
// api.agents.createTask
// api.agents.updateTask
// api.agents.runMultiAgent
// api.buildLoop.getActiveSession
// api.buildLoop.listSteps
// api.buildLoop.createSession
// api.buildLoop.addStep
// api.buildLoop.finishSession
// api.buildLoop.runBuildLoop
// api.changeHistory.listByProject
// api.changeHistory.listBySuggestion
// api.changeHistory.recordChange
// api.changeHistory.undoChange
// api.changeHistory.undoSuggestion
// api.chat.getOrCreateSession
// api.chat.createSession
// api.chat.listSessions
// api.chat.renameSession
// api.chat.deleteSession
// api.chat.archiveSession
// api.chat.getSession
// api.chat.updateModel
// api.chat.listMessages
// api.chat.addMessage
// api.chat.sendMessage
// api.collaboration.heartbeat
// api.collaboration.leave
// api.collaboration.listActive
// api.collaboration.createInvite
// api.collaboration.joinByInvite
// api.costEntries.log
// api.costEntries.getByUser
// api.costEntries.getTotalCost
// api.engine.createToolCall
// api.engine.updateToolCall
// api.engine.listToolCalls
// api.engine.clearToolCalls
// api.engine.runMission
// api.export.getProjectBundle
// api.files.listByProject
// api.files.getByPath
// api.files.updateContent
// api.files.create
// api.files.rename
// api.files.remove
// api.files.update
// api.files.bulkInsert
// api.git.listCommits
// api.git.listBranches
// api.git.getActiveBranch
// api.git.recordCommit
// api.git.upsertBranch
// api.git.pushToGitHub
// api.git.importFromGitHub
// api.github.saveToken
// api.github.getSettings
// api.github.validateToken
// api.github.updateProfile
// api.github.listRepos
// api.github.getTokenInternal
// api.github.importRepo
// api.github.commitFile
// api.github.createBranch
// api.github.createPullRequest
// api.intelligence.listMemories
// api.intelligence.getActiveMemories
// api.intelligence.deleteMemory
// api.intelligence.listRetrospectives
// api.intelligence.listAgentTasks
// api.intelligence.listToolCalls
// api.intelligence.listThoughts
// api.intelligence.listAgentMessages
// api.intelligence.listBuildSessions
// api.intelligence.getCostSummary
// api.limits.PLAN_LIMITS
// api.limits.getMyLimits
// api.limits.checkCanRun
// api.limits.trackUsage
// api.limits.getUserPlanLimits
// api.limits.getUserSub
// api.limits.getSpend
// api.memory.listMemories
// api.memory.listRetrospectives
// api.memory.listAgentMessages
// api.memory.getMemoryStats
// api.memory.addMemory
// api.memory.markMemoryUsed
// api.memory.applyMemoryDecay
// api.memory.postAgentMessage
// api.memory.getMemoriesForPrompt
// api.memory.runRetrospective
// api.memory.createRetrospective
// api.memory.patchRetrospectiveMemories
// api.memory.deleteMemory
// api.missions.listByProject
// api.missions.get
// api.previews.getShareLink
// api.previews.createShareLink
// api.previews.upsertShare
// api.previews.revokeShareLink
// api.previews.getShareByToken
// api.previews.incrementViewCount
// api.projects.list
// api.projects.get
// api.projects.create
// api.projects.remove
// api.projects.updateLastOpened
// api.projects.setGithubRepo
// api.rag.listIndexedFiles
// api.rag.getIndexStats
// api.rag.indexFile
// api.rag.removeFromIndex
// api.rag.indexProject
// api.rag.search
// api.rag.getContextForPrompt
// api.seedTestUser.seedTestUser
// api.sessions.list
// api.sessions.get
// api.sessions.getActive
// api.sessions.create
// api.sessions.updateModel
// api.sessions.addCost
// api.sessions.listActiveByProject
// api.stripe.createCheckoutSession
// api.stripe.stripeWebhook
// api.stripe.getSubByCustomerId
// api.stripe.upsertSubscription
// api.suggestions.listByProject
// api.suggestions.listPending
// api.suggestions.getAutonomousMode
// api.suggestions.updateStatus
// api.suggestions.addSuggestion
// api.suggestions.setAutonomousMode
// api.suggestions.markAutoRunAt
// api.suggestions.generateSuggestions
// api.suggestions.implementSuggestion
// api.suggestions.runAutonomousCycle
// api.testAuth.TestCredentials
// api.users.deleteAccount
// api.viktorTools.quickAiSearch
// api.viktorTools.generateImage
// api.vision.analyzeScreenshot
