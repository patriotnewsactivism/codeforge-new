# CodeForge V2 - Build Plan

## Phase 1: Core Architecture & IDE Layout
- [x] Initialize project
- [ ] Install Monaco Editor + dependencies\n- [ ] Add Docker-backed agent runner and governance modules
- [ ] Define Convex schema (projects, files, sessions, messages, collaborators)
- [ ] Build IDE layout: file tree | editor tabs | AI chat panel
- [ ] File tree component with expand/collapse
- [ ] Tabbed Monaco editor with syntax highlighting
- [ ] Ctrl+S to save files
- [ ] Dark theme (matching original CodeForge)

## Phase 2: AI Chat
- [ ] Chat panel UI (message list, input)
- [ ] Multi-model selector (DeepSeek V3.2, Grok 4.1 Fast, GPT-5 Mini)
- [ ] Send messages to AI via Viktor tools gateway
- [ ] @codeforge mentions in chat to cue AI
- [ ] Auto-fallback when model fails
- [ ] Cost tracking (token usage + dollar display per session)

## Phase 3: GitHub Integration
- [ ] GitHub OAuth or token-based auth
- [ ] Import repo action
- [ ] Browse file tree from imported repo
- [ ] Edit files and commit back

## Phase 4: Live Preview
- [ ] Sandbox iframe for HTML/CSS/JS preview
- [ ] Auto-refresh on file save

## Phase 5: Live Collaboration
- [ ] Real-time presence (who's viewing)
- [ ] Live cursor/change watching
- [ ] Collaborative session management

## Phase 6: Landing Page
- [ ] Dark themed landing matching original CodeForge style
- [ ] Feature cards, CTAs

## Steps for each phase:
1. Implement backend + frontend
2. Write e2e test
3. bun run sync:build
4. Run tests
5. Take screenshots
6. Deploy preview
7. Notify user
