import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { stripeWebhook } from "./stripe";

const http = httpRouter();
auth.addHttpRoutes(http);

// Stripe webhook — receives payment events from Stripe
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: stripeWebhook,
});

export default http;
