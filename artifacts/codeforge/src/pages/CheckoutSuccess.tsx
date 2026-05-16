import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function CheckoutSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plan = params.get("plan") ?? "pro";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); navigate("/dashboard"); }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [navigate]);

  const planNames: Record<string, string> = {
    weekly: "Weekly Pro", monthly: "Monthly Pro", lifetime: "Lifetime Founder"
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          </div>
        </div>
        <h1 className="text-3xl font-black mb-2">You're in! 🎉</h1>
        <p className="text-muted-foreground mb-2">
          Welcome to <span className="text-foreground font-semibold">{planNames[plan] ?? "CodeForge Pro"}</span>.
          Your plan is active.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Redirecting to dashboard in {countdown}s…
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
