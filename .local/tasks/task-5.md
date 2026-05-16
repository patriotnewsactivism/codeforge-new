---
title: Set up push notifications and deep linking
---
# Set up push notifications and deep linking

  ## What & Why
  The mobile companion app currently has no way to re-engage users or let them share links to specific projects. Adding Expo push notifications and deep links makes the app feel complete — users get notified when AI finishes building their project, and project URLs open directly in the app.

  This extends the mobile companion only (artifacts/codeforge-mobile/). It requires additive backend support: a new token registration endpoint in the Convex backend so the server can target specific devices.

  ## Done looks like
  - Push notification permissions requested on first launch (expo-notifications)
  - Device token registered to the user's account via an additive Convex mutation (e.g. `api.users.registerPushToken`)
  - Notification sent when a long-running AI build completes
  - Deep links of the form `codeforge-mobile://project/<id>` open the correct project detail screen
  - No existing Convex functions or web app behavior changed

  ## Relevant files
  - `artifacts/codeforge-mobile/app/_layout.tsx` — add notification permission + deep link handler
  - `artifacts/codeforge-mobile/app/project/[id].tsx` — deep link target screen
  - `artifacts/codeforge/convex/schema.ts` — additive: add pushTokens field to users table
  - `artifacts/codeforge/convex/users.ts` — additive: registerPushToken mutation