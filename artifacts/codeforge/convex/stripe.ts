/**
 * stripe.ts — Convex Stripe integration
 *
 * Exports:
 *   createCheckoutSession  (action)   — creates a Stripe checkout session
 *   stripeWebhook          (httpAction) — receives Stripe events, activates plans
 *   getSubByCustomerId     (query)    — lookup by Stripe customer ID
 *   upsertSubscription     (mutation) — create/update subscription record
 */
import { v } from "convex/values";
import { action, httpAction, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

const APP_URL = "https://codeforge-v2-c96b4570.viktor.space";

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TT78bDmDTj65rCTbextWLwt": "weekly",
  "price_1TT78cDmDTj65rCTxe6Beytp": "monthly",
  "price_1TT8YfDmDTj65rCTwMQkha7J": "lifetime",
};

const PLAN_PRICES: Record<string, { priceId: string; mode: "subscription" | "payment" }> = {
  weekly:   { priceId: "price_1TT78bDmDTj65rCTbextWLwt", mode: "subscription" },
  monthly:  { priceId: "price_1TT78cDmDTj65rCTxe6Beytp", mode: "subscription" },
  lifetime: { priceId: "price_1TT8YfDmDTj65rCTwMQkha7J", mode: "payment" },
};

// ────────────────────────────────────────────────────────────────────────────
// createCheckoutSession
// ────────────────────────────────────────────────────────────────────────────

export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal("weekly"), v.literal("monthly"), v.literal("lifetime")),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.object({ url: v.string(), sessionId: v.string(), plan: v.string() }),
  handler: async (_ctx, args) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const planCfg = PLAN_PRICES[args.plan];
    if (!planCfg) throw new Error(`Unknown plan: ${args.plan}`);

    const params = new URLSearchParams({
      "payment_method_types[]": "card",
      "line_items[0][price]": planCfg.priceId,
      "line_items[0][quantity]": "1",
      "mode": planCfg.mode,
      "success_url": `${APP_URL}/dashboard?checkout=success&plan=${args.plan}`,
      "cancel_url": `${APP_URL}/pricing?checkout=cancelled`,
      "allow_promotion_codes": "true",
    });

    if (args.email) params.set("customer_email", args.email);
    if (args.userId) {
      params.set("metadata[userId]", args.userId);
      params.set("metadata[plan]", args.plan);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = (await res.json() as any).error?.message ?? "Stripe error";
      throw new Error(err);
    }

    const session = await res.json() as any;
    return { url: session.url, sessionId: session.id, plan: args.plan };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// stripeWebhook — httpAction for POST /stripe/webhook
// ────────────────────────────────────────────────────────────────────────────

export const stripeWebhook = httpAction(async (ctx, req) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return new Response("Webhook not configured", { status: 500 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: any;
  try {
    event = await verifyStripeSignature(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const obj = event.data.object as any;
  console.log("Stripe event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = obj.metadata?.userId as any;
        const planKey = (obj.metadata?.plan as string) ?? "monthly";
        if (!userId) { console.warn("No userId in metadata"); break; }

        await ctx.runMutation(api.stripe.upsertSubscription, {
          userId,
          planKey,
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.subscription ?? undefined,
          currentPeriodEnd: obj.subscription_details?.expires_at
            ? obj.subscription_details.expires_at * 1000
            : undefined,
          status: "active",
        });
        console.log(`Activated ${planKey} for user ${userId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const customerId = obj.customer as string;
        const subId = obj.subscription as string;
        const periodEnd = obj.lines?.data?.[0]?.period?.end as number | undefined;
        const priceId = obj.lines?.data?.[0]?.price?.id as string | undefined;
        const planKey = priceId ? (PRICE_TO_PLAN[priceId] ?? "monthly") : "monthly";

        const existingSub = await ctx.runQuery(api.stripe.getSubByCustomerId, { customerId });
        if (existingSub) {
          await ctx.runMutation(api.stripe.upsertSubscription, {
            userId: existingSub.userId,
            planKey,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subId,
            currentPeriodEnd: periodEnd ? periodEnd * 1000 : undefined,
            status: "active",
          });
          console.log(`Renewed ${planKey} for customer ${customerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const customerId = obj.customer as string;
        const existingSub = await ctx.runQuery(api.stripe.getSubByCustomerId, { customerId });
        if (existingSub) {
          await ctx.runMutation(api.stripe.upsertSubscription, {
            userId: existingSub.userId,
            planKey: existingSub.planKey,
            stripeCustomerId: customerId,
            status: "past_due",
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = obj.customer as string;
        const existingSub = await ctx.runQuery(api.stripe.getSubByCustomerId, { customerId });
        if (existingSub) {
          await ctx.runMutation(api.stripe.upsertSubscription, {
            userId: existingSub.userId,
            planKey: "free",
            stripeCustomerId: customerId,
            status: "cancelled",
          });
          console.log(`Downgraded to free for customer ${customerId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Return 200 — Stripe should not retry for our internal errors
  }

  return new Response("OK", { status: 200 });
});

// ────────────────────────────────────────────────────────────────────────────
// getSubByCustomerId — query
// ────────────────────────────────────────────────────────────────────────────

export const getSubByCustomerId = query({
  args: { customerId: v.string() },
  handler: async (ctx, { customerId }) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", customerId))
      .first();
  },
});

// ────────────────────────────────────────────────────────────────────────────
// upsertSubscription — mutation
// ────────────────────────────────────────────────────────────────────────────

export const upsertSubscription = mutation({
  args: {
    userId: v.id("users"),
    planKey: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        planKey: args.planKey,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        currentPeriodEnd: args.currentPeriodEnd,
        status: args.status,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        planKey: args.planKey,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        currentPeriodEnd: args.currentPeriodEnd,
        status: args.status,
        updatedAt: Date.now(),
      });
    }

    // Also update the users table plan field if it exists
    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_id", (q: any) => q.eq("_id", args.userId))
        .first() as any;
      if (user) {
        await ctx.db.patch(user._id, { plan: args.planKey, subscriptionStatus: args.status } as any);
      }
    } catch (_) {
      // users table may not have these fields yet — non-fatal
    }
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Stripe HMAC-SHA256 signature verification (no external deps)
// ────────────────────────────────────────────────────────────────────────────

async function verifyStripeSignature(body: string, signature: string, secret: string) {
  const parts: Record<string, string> = {};
  for (const seg of signature.split(",")) {
    const eq = seg.indexOf("=");
    if (eq > 0) parts[seg.slice(0, eq)] = seg.slice(eq + 1);
  }

  const { t: timestamp, v1: expectedSig } = parts;
  if (!timestamp || !expectedSig) throw new Error("Malformed stripe-signature");

  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
    throw new Error("Webhook timestamp too old (replay attack guard)");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const sigBytes = await crypto.subtle.sign(
    "HMAC", key, encoder.encode(`${timestamp}.${body}`)
  );
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  if (computed !== expectedSig) throw new Error("Signature mismatch");
  return JSON.parse(body);
}
