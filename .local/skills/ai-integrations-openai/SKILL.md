---
name: ai-integrations-openai
description: |
  OpenAI AI integration via Replit AI Integrations proxy (JavaScript/TypeScript). Provides OpenAI-compatible API access without requiring your own API key.
---

# OpenAI AI Integration

OpenAI integration via Replit AI Integrations proxy — keys auto-provisioned.

## Supported OpenAI APIs

- chat-completions
- chat-completions with audio inputs/outputs
- audio transcriptions
- responses
- images generations
- images edits

## Supported Models

All listed non-use-case-specific gpt models support text + image inputs and text outputs.

- gpt-5.4: most capable general-purpose model. Prefer for non-coding tasks.
- gpt-5.3-codex: most capable coding model. Prefer for coding tasks. Responses API only (not chat completions).
- gpt-5.2: good for most tasks, prefer gpt-5.4
- gpt-5.2-codex: code-optimized gpt-5.2 variant. Responses API only (not chat completions).
- gpt-5.1, gpt-5: good for most tasks, prefer gpt-5.4
- gpt-5-mini: cost-effective for high-volume tasks
- gpt-5-nano: fastest and cheapest, use when volume and speed are critical
- gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini: legacy — DO NOT use unless project already uses them
- o4-mini: best thinking model for complex reasoning. Prefer over other o-series.
- o3: thinking model, slower but more intelligent than o4-mini
- o3-mini: legacy thinking model, prefer o4-mini
- gpt-image-1: image generation (text/image inputs, image output). Supported sizes: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait), auto.
- gpt-audio: speech-to-speech (text/audio in, audio+transcript out). Best for speech-to-speech with no TTS chaining. Less intelligent than newer text models (e.g. gpt-5.4).
- gpt-audio-mini: cheaper, less capable speech-to-speech
- gpt-4o-mini-transcribe: speech-to-text (audio in, text out)

IMPORTANT: This list is not OpenAI's full catalog — never tell the user a model "doesn't exist". For unlisted models, see Selection Guidelines. Default to OpenAI for chat when no provider is specified.

FORBIDDEN: Web Speech API (SpeechSynthesis/SpeechSynthesisUtterance). Users hate its robotic voice. For ANY text-to-speech, voice, or audio output, ALWAYS use AI — OpenAI or ElevenLabs. No exceptions, not for cost, offline support, or word highlighting.

Audio routing (forbidden to violate unless user explicitly requests otherwise):

- Speech-to-speech, no separate text model → OpenAI audio
- STT/TTS chained with a separate text model → ElevenLabs for both STT and TTS (never OpenAI, even if OpenAI seems easier)
- Non-latency-sensitive batch (transcription, synthesis, audiobooks) → OpenAI

Examples:

- ai voice chat app: use OpenAI (speech-to-speech, no text model specified)
- ai voice chat app that uses a text model: use ElevenLabs for both STT and TTS (text model specified)
- ai voice chat app that uses the most intelligent LLM: use ElevenLabs for both STT and TTS (and latest OpenAI text model)
- audio booking reading app: use OpenAI (not latency sensitive, TTS)
- call notes transcription app: use OpenAI (not latency sensitive, STT)
- customer support voice chatbot: use OpenAI (speech-to-speech, no text model specified)
- customer support voice chatbot that uses a text model: use ElevenLabs for both STT and TTS (latency sensitive and text model specified)

## Unsupported Capabilities

Not supported — do NOT proceed with this integration. Search other integrations first (e.g. Gemini for video), else fall back to OpenAI direct with user's API key:

- embeddings API
- fine-tuning API
- files API
- images variations
- video inputs / outputs (use Gemini integration instead)
- speech API
- OpenAI Realtime API (WebRTC-based streaming) — but gpt-audio models ARE supported for voice

## When to Use

- User needs OpenAI AI capabilities (chat, completions)
- User does not want to provide their own API key
- Any AI/LLM request that should use OpenAI

## Agent Stack Note

For "Agent Stack (Agents and Automations)" features, you MUST always set up an LLM provider — regardless of whether the specific implementation appears to need AI/LLM capabilities. DO NOT second-guess. Skipping the LLM provider setup leads to broken code and awful UX.

## Selection Guidelines

If the user already has this integration set up, skip the Setup section and proceed with their request.

Precedence (stop at first match):

Precedence 1 — **Explicit user requests**

- User wants their own API key: Do NOT proceed with this integration
- User asks for OpenAI and capability is supported: Proceed
- User asks for OpenAI but needs a capability or model NOT listed above: This integration CANNOT provide it. You MUST use OpenAI directly with the user's own API key instead

Precedence 2 — **Use-case triggers** (proceed with this integration)

- TTS, voice chat, audiobooks, read-aloud — use OpenAI audio models. NEVER use Web Speech API.
- User needs control of the base response-generation model, or STT/TTS chaining: use ElevenLabs instead.

Precedence 3 — **No provider specified**

- Default to this integration if it supports the use case; else OpenAI direct with user's API key; else another integration or alternative.

First time proposing/using this integration: state all three — (1) internally uses Replit AI Integrations for OpenAI access, (2) no API key required, (3) charges billed to user's credits.

## Setup

### 1. Provision env vars

In the JavaScript sandbox:

```javascript
const result = await setupReplitAIIntegrations({
  providerSlug: "openai",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY",
});
console.log(result);
```

For multiple integrations, call `setupReplitAIIntegrations` sequentially — await each before the next.

### 2. Copy template files

```bash
cp -r .local/skills/ai-integrations-openai/templates/lib/* lib/
```

Copies:

- `lib/integrations-openai-ai-server/` — server package (client, batch, image, audio)
- `lib/integrations-openai-ai-react/` — React client package (voice hooks)
- `lib/db/src/schema/conversations.ts` and `messages.ts` — Drizzle schemas

### 3. Add dependencies and install

Server `package.json`: `"@workspace/integrations-openai-ai-server": "workspace:*"`
Frontend `package.json`: `"@workspace/integrations-openai-ai-react": "workspace:*"`

```bash
pnpm install --no-frozen-lockfile
```

### 4. TypeScript project references

Root `tsconfig.json`:

```json
{ "path": "./lib/integrations-openai-ai-server" },
{ "path": "./lib/integrations-openai-ai-react" }
```

Server `artifacts/api-server/tsconfig.json`: `{ "path": "../../lib/integrations-openai-ai-server" }`
Frontend `artifacts/frontend/tsconfig.json` (or equivalent): `{ "path": "../../lib/integrations-openai-ai-react" }`

### 5. Export DB model

Add to `lib/db/src/schema/index.ts` (do NOT overwrite the existing file):

```typescript
export * from "./conversations";
export * from "./messages";
```

Critical: migrations only create tables exported from `@workspace/db`.

### 6. Add API contract, run codegen + db push

Read `.local/skills/ai-integrations-openai/references/openapi.md` and add paths/schemas/tag to `lib/api-spec/openapi.yaml` (endpoints prefixed with `/openai/`). Then:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
# If column conflicts:
pnpm --filter @workspace/db run push-force
```

### 7. Implement routes

Add routes in `artifacts/api-server/src/routes/openai/`. Validate with `@workspace/api-zod`, query with `@workspace/db`, import SDK client from `@workspace/integrations-openai-ai-server`.

Text endpoint (`POST /openai/conversations/:id/messages`), validated with `SendOpenaiMessageBody`:

```typescript
import { openai } from "@workspace/integrations-openai-ai-server";

res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

let fullResponse = "";
const stream = await openai.chat.completions.create({
  model: "gpt-5.4",
  max_completion_tokens: 8192,
  messages: chatMessages,
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    fullResponse += content;
    res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
}

// Save assistant message to DB, then signal completion
res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
res.end();
```

Voice endpoint (`POST /openai/conversations/:id/voice-messages`), validated with `SendOpenaiVoiceMessageBody`:

```typescript
import { voiceChatStream, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";

res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
const stream = await voiceChatStream(buffer, "alloy", format);

let assistantTranscript = "";
for await (const event of stream) {
  if (event.type === "transcript") assistantTranscript += event.data;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// Persist both sides so voice and text history stay in sync
await db.insert(messages).values([
  { conversationId: id, role: "user", content: userTranscript },
  { conversationId: id, role: "assistant", content: assistantTranscript },
]);

res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
res.end();
```

**Voice context:** `voiceChatStream()` is one-shot — it sends only the current audio turn to `gpt-audio`, no prior messages. For multi-turn, call the OpenAI SDK directly with a custom messages array, passing prior transcripts as **system/user** roles. Always persist both user (from `user_transcript` SSE event or separate STT) and assistant transcripts so voice/text history stay in sync.

**SSE codegen:** Orval can't generate client hooks or response Zod for streaming endpoints. Request-body schemas (`SendOpenaiMessageBody`, `SendOpenaiVoiceMessageBody`) work; response type is `unknown`. On the client, parse with `fetch` + `ReadableStream` — do NOT use generated React Query hooks. The hooks in `@workspace/integrations-openai-ai-react` already handle SSE for voice streams.

Image generation:

```typescript
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
const buffer = await generateImageBuffer(prompt, "1024x1024");
res.json({ b64_json: buffer.toString("base64") });
```

Mount the router in `artifacts/api-server/src/routes/index.ts`.

### 8. Client-side voice UI

```typescript
import { useVoiceRecorder, useVoiceStream } from "@workspace/integrations-openai-ai-react";
```

Copy `audio-playback-worklet.js` to `public/`. Pass `workletPath` matching the deployed artifact base URL (do not assume `/audio-playback-worklet.js`):

```typescript
const stream = useVoiceStream({
  workletPath,
  onTranscript: (_, full) => setTranscript(full),
});

await stream.streamVoiceResponse(
  `/api/openai/conversations/${conversationId}/voice-messages`,
  blob
);
```

### 9. Batch processing

Batch tasks: ALWAYS use `batchProcess`.

```typescript
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
import { openai } from "@workspace/integrations-openai-ai-server";

const results = await batchProcess(
  items,
  async (item) => {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: `Process: ${item.name}` }],
    });
    return response.choices[0]?.message?.content ?? "";
  },
  { concurrency: 2, retries: 5 }
);
```

For SSE progress:

```typescript
import { batchProcessWithSSE } from "@workspace/integrations-openai-ai-server/batch";

await batchProcessWithSSE(
  items,
  async (item) => { /* your processor */ },
  (event) => res.write(`data: ${JSON.stringify(event)}\n\n`)
);
```

## IMPORTANT

- NEVER ask for or modify secrets/env vars. AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY auto-set during setup.
- AI_INTEGRATIONS_OPENAI_API_KEY is a dummy string for SDK compatibility — don't assume misconfigured without testing; works when BASE_URL is also set.
- Setup failed or env vars missing: retry `setupReplitAIIntegrations`, no other measures. After 3 retries, switch to api-key approach.
- DO NOT modify the client setup in `lib/integrations-openai-ai-server/src/client.ts` — env vars auto-configured.
- DO NOT overwrite the existing db schema barrel (`lib/db/src/schema/index.ts`) when copying files.

## Code Generation Guidelines

Use the SDK client from the provided modules, not direct `fetch`.

For client init with env vars, see `lib/integrations-openai-ai-server/src/client.ts`.

Agent Stack features: instantiate the client with AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY.

Multi/many LLM calls: you MUST use retries with backoff and rate limiters — use the batch utilities module.

gpt-5 and newer:

- `temperature` not specifiable (always 1)
- `max_tokens` not supported; use `max_completion_tokens`

gpt-image-1:

- `response_format` not supported; response is always base64
- Supported sizes: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait), auto

gpt-4o-mini-transcribe / gpt-4o-transcribe:

- Use `openai.audio.transcriptions.create()`
- Only supported response format is 'json'

gpt-audio / gpt-audio-mini are combined audio/text input/output models for speech-to-speech with no TTS chaining.

- Simple voice chat: use `voiceChatStream()` with gpt-audio
- Separate text model: STT/TTS-chain via ElevenLabs, not OpenAI
- Always prefer streaming; non-streaming long responses may time out
- ALWAYS convert browser WebM to WAV with ffmpeg before sending
- ALWAYS increase Express body limit for audio payloads (e.g. 50MB)

Separate endpoints for text/voice: `POST /openai/conversations/{id}/messages` (text) vs `POST /openai/conversations/{id}/voice-messages` (speech-to-speech). Do NOT overload a single endpoint with both formats.

Do not eagerly upgrade model on existing code unless user requests it.

If you set a max tokens limit, use 8192. NEVER lower unless explicitly requested.

## Provided Modules

### Server Package (`lib/integrations-openai-ai-server/`)

- **Client** (`src/client.ts`) — pre-configured OpenAI SDK client; throws at startup if `AI_INTEGRATIONS_OPENAI_BASE_URL` or `AI_INTEGRATIONS_OPENAI_API_KEY` missing.
- **Image** (`src/image/`):
  - `generateImageBuffer(prompt, size?)` — generates image with gpt-image-1, returns `Buffer`
  - `editImages(imageFiles, prompt, outputPath?)` — edits one or more image files, returns `Buffer`
- **Audio** (`src/audio/`):
  - `ensureCompatibleFormat(audioBuffer)` — converts unsupported audio to OpenAI-compatible format; returns `{ buffer, format }`
  - `detectAudioFormat(buffer)` / `convertToWav(buffer)` — audio format utilities
  - `voiceChat(audioBuffer, voice?, inputFormat?, outputFormat?)` — voice chat with gpt-audio (non-streaming)
  - `voiceChatStream(audioBuffer, voice?, inputFormat?)` — voice chat with gpt-audio (streaming)
  - `textToSpeech(text, voice?, format?)` / `textToSpeechStream(text, voice?)` — TTS generation
  - `speechToText(audioBuffer, format?)` / `speechToTextStream(audioBuffer, format?)` — STT transcription
- **Batch** (`src/batch/`):
  - `batchProcess<T, R>(items, processor, options)` — generic batch processor with rate limiting and retries
  - `batchProcessWithSSE<T, R>(items, processor, sendEvent, options)` — sequential processor with SSE streaming
  - `isRateLimitError(error)` — detects rate-limit errors

### React Package (`lib/integrations-openai-ai-react/`)

- **Audio hooks** (`src/audio/`):
  - `useVoiceRecorder()` — records audio from microphone; negotiates MIME type across Chrome, Firefox, Safari
  - `useAudioPlayback(workletPath)` — plays PCM16 audio chunks
  - `useVoiceStream({ workletPath, ...options })` — streams voice chat (recording + playback)
  - `decodePCM16ToFloat32(data)` / `createAudioPlaybackContext(workletPath)` — low-level audio utilities
- `audio-playback-worklet.js` — AudioWorklet for smooth playback (copy to `public/`)

### DB Model (`lib/db/src/schema/`)

- Drizzle schema files for `conversations` and `messages` tables
- Zod validation via drizzle-zod
- TypeScript types for `Conversation`, `Message`, and insert types

### API Contract (`.local/skills/ai-integrations-openai/references/openapi.md`)

- OpenAPI spec entries for text chat, voice chat, image endpoints under `/openai/` prefix
- Read and add to `lib/api-spec/openapi.yaml`

## Drizzle Dependency

Uses Drizzle ORM with drizzle-zod for validation. Use the provided schema files as-is.
