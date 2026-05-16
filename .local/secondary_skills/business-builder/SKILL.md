---
name: business-builder
description: Build a complete business-in-a-box from a single idea.
---

# Business Builder

Take a business idea from concept to a full 4-artifact deliverable stack: full stack web app, mobile app, slide deck, and animation.

## Phase 1: Planning

Conduct a focused discovery conversation before building anything. Use the `user_query` tool for each round — do not ask questions via plain text.

Query type guidance for `user_query`:

- **Open-ended questions** (name, description, details): send `{question: "..."}` only — no `options` field. This renders as a free text input.
- **Multiple-choice questions** (style, features, monetization): include `options` with a list of choices. Always add "Something else (type below):" as the last option.

Example `user_query` call:

```json
{
  "queries": [
    {"question": "What's the name of your business?"},
    {"question": "How will it make money?", "options": ["Subscription", "One-time purchase", "Freemium", "Ads", "Something else (type below):"]}
  ]
}
```

### Round 1 — The Idea

- What's the business idea in one sentence?
- Who is the target customer? (Be specific — age, role, lifestyle)
- What problem does this solve?
- How will it make money? (Subscription, one-time, freemium, ads, marketplace)

### Round 2 — Shape & Style

- Any brand preferences? (Colors, vibe, tone — e.g., "bold and playful" vs "clean and professional")
- Name 1-2 apps or sites you admire and why
- What's the single most important feature your app should have?
- What should the pitch emphasize? (Market size, traction, team, tech differentiation)

**Do not proceed until you have clear answers.** Push back on vague responses — "everyone" is not a target customer.

Once you have enough context, summarize the plan back to the user and get explicit approval before moving to Phase 2.

## Phase 2: Build

Build the full 4-artifact stack. Follow the multi-artifact creation guide for delegation and parallelism strategy.

### Budget Constraints

- **Images**: Max 5 generated images across all artifacts. Reuse brand visuals everywhere.
- **Animation**: 15-30 seconds, one scene. Keep it simple and impactful.
- **Slides**: 8-12 slides max.

### Asset Reuse

Generate brand assets (logo, color palette, hero image) once and share them across all 4 deliverables. Do not regenerate per artifact.

### Build Priority

If credits or context get tight, build in this order:

1. **Full stack web app** — the core product
1. **Mobile app** — companion experience
1. **Slide deck** — pitch-ready slides
1. **Animation** — short animated promo

### Deliverables

1. **Full Stack Web App** — A functional app with the core feature, styled with the brand identity.
1. **Mobile App** — A responsive mobile companion app sharing the same backend/data where applicable.
1. **Slide Deck** — 8-12 slide pitch deck covering: problem, solution, market, business model, traction/roadmap, team, ask.
1. **Animation** — 15-30 second animation showcasing the product's value proposition.
