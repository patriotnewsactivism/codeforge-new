---
name: clerk-auth
description: "User authentication via a Replit-managed Clerk tenant. Default solution for user authentication; prefer the replit-auth skill only when the user explicitly asks for Replit Auth / Replit SSO / \"Sign in with Replit\". Load whenever Clerk appears in the conversation or codebase — even if it's unclear whether the project uses Replit-managed or external Clerk; the skill detects and routes accordingly. Prefer recall over precision. Do not rely on generic Clerk knowledge or send the user to dashboard.clerk.com without loading this skill — Replit-managed Clerk is configured very differently from external Clerk. Example use cases include: setup, customization (login providers, branding such as 'continue with <app_name>' on the Google login page, email verification), key configuration, feature or pricing questions, troubleshooting, and migrations to or from Replit Auth."
---

# Clerk Auth

## Overview

Clerk Auth gives the user's app its own dedicated authentication system, powered by a Replit-provisioned Clerk tenant. End users sign up in the app and the builder gets full control over branding and login methods.
- **Replit-managed**: Replit provisions the Clerk tenants and key automatically. No need to touch accounts/secrets manually and no Clerk dashboard access.
- **Two isolated environments**: Development and Production have separate user stores — accounts/data do not cross over. Test keys are used during development and automatically swapped to live keys when the app is published.

  **Expected during development — do NOT treat as a problem and do NOT try to "fix" it:**
  - A `pk_test` Clerk publishable key in `.replit` config or environment
  - Console logs that say things like "Clerk has been loaded with development keys" or otherwise warn about development keys
- **Login methods**: email/password (with email verification) and SSO via Google, GitHub, Apple, and X; custom OAuth credentials supported in Production for branded consent screens
- **Managed from the Auth pane**: user management and consent screen configuration managed from the builtin Auth pane
- **Not supported today**: SMS/phone sign-in, MFA, organization tenants

## When to Use

- User wants authentication, login, signup, or user accounts (this is the default)
- User wants custom branding on login/signup screens
- User wants their own user database
- Any generic auth request that does not explicitly mention "Replit Auth", "Sign in with Replit", or "Replit SSO"

## Step 1: Check Clerk Management Status

ALWAYS call `checkClerkManagementStatus` before taking any action. Failing to do so can cause extreme user confusion and lead the user to get into a bad state with their app.

```javascript
const status = await checkClerkManagementStatus();
console.log(status);
```

DO NOT proceed with steps 2 and 3 until you have done step 1 and know if the user is using Replit-managed clerk or their own external clerk account.

## Step 2: Route Based on Status

**`external`**: The user is managing their own Clerk instance. This skill does not apply — stop here.

**`unknown`**: DO NOT proceed to Step 3. Ask the user: "Are you using Replit-managed Clerk (set up automatically) or your own external Clerk account? Check if the Clerk publishable key stored in secrets matches your own personal Clerk account. If so, it is external." DO NOT say anything more than just this question.

**`not_configured`**: Neither Replit-managed or external Clerk has been set up — continue to step 3.

**`managed`**: Replit-managed Clerk already set up — continue to step 3.

## Step 3: Route Based on Request Type

IMPORTANT: DO NOT start this step if the management status you found was unknown or external.

Identify the user's intent and follow the matching section below.

### Intent: Inquiry, Configuration, Login Providers, and Setup Questions

The user is asking a factual or conceptual question about Clerk Auth (how something works, whether a feature is supported, pricing, setup requirements, configuration options, environment behavior, etc.) or is asking you to change their login providers, OAuth credentials, or consent screen branding. ALWAYS call `searchReplitDocs` first — do not answer from prior knowledge.

```javascript
const result = await searchReplitDocs({ query: "<query>" });
console.log(result.response);
```

Common question categories and example queries:

- **Login providers, OAuth credentials, SSO, consent screen branding, or Auth pane questions**
  - Example question: "How do I add Apple login?"
  - Example query: `"Configure custom <provider_name> OAuth credentials for Clerk Auth"`
  - After the search, direct the user to the **Auth pane** in the workspace toolbar.
- **Clerk DNS, custom domain, email verification, DKIM, or SPF setup questions**
  - Example question: "How do I set up Clerk DNS for email verification?"
  - Example query: `"Set up Clerk DNS for email verification"`
- **Clerk Auth feature support (e.g. MFA, organizations, passkeys, magic links, webhooks)**
  - Example question: "Does Clerk Auth support passkeys?"
  - Example query: `"Does Clerk Auth support <feature>"`
- **Clerk Auth pricing, MAU limits, quotas, or plan tier questions**
  - Example question: "Does Clerk Auth have a MAU limit?"
  - Example query: `"Clerk Auth MAU limit and pricing"`
- **Live vs test keys (`pk_test` / `sk_test` vs `pk_live` / `sk_live`)**
  - Example question: "My Clerk publishable key starts with `pk_test` — how do I switch to a live key?"
  - Example query: `"Clerk Auth test vs live keys for development and production"`
- **Sign-in, sign-up, or user management questions (e.g. missing accounts or data)**
  - Example question: "Why can't I sign in to my published app with the account I made during development?"
  - Example query: `"Clerk Auth development vs production environment user separation"`

### Intent: Implementation & Changes

The user wants to set up Clerk, integrate it into their code, or customize the sign-in page. Read `.local/skills/clerk-auth/references/setup-and-customization.md` for guidance.

### Intent: Troubleshooting

The user reports that Clerk Auth is broken, misbehaving, or not doing what they expect, or handling Clerk-related errors surfaced in the console logs while addressing the user's requests. Re-load the clerk-auth skill before reading the references — even if it is already open in this conversation — so you pick up the latest canonical snippets, then read **both** of the following together before taking any action:

1. `.local/skills/clerk-auth/references/troubleshoot.md` — generic troubleshooting guidance.
2. `.local/skills/clerk-auth/references/setup-and-customization.md` — the ground-truth guidance for Replit-managed Clerk setup and coding.

Example user inputs:

- "The preview / app / homepage isn't loading" (when Clerk is used)
- "Failed to load Clerk JS"
- "Auth is broken" / "login doesn't work" / "I cannot login"

### Intent: Migrating from Replit Auth

Migrating an app from Replit Auth to Clerk is not currently supported. Tell the user that automated migration is not yet available and stop — do not attempt a manual migration.

