import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { ClipboardList } from "lucide-react";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Authentication error:", err);
      // Handle standard pop-up closed or blocked errors gracefully
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completing.");
      } else if (err.code === "auth/blocked-by-client") {
        setError("Sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.");
      } else {
        setError(err.message || "An unexpected authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-screen-container"
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-brand-bg select-none"
    >
      <div
        id="login-card"
        className="w-full max-w-md p-8 text-center bg-brand-white rounded-lg border border-brand-border shadow-xs transition-all"
      >
        {/* Decorative App Icon */}
        <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-md bg-brand-accent/10 mb-6">
          <ClipboardList className="text-brand-accent w-6 h-6" />
        </div>

        {/* Title & Slogan */}
        <h1 className="text-3xl font-bold tracking-tight text-brand-dark mb-2">
          Triage
        </h1>
        <p className="text-sm text-brand-muted max-w-xs mx-auto mb-8">
          A minimalist task prioritization tool. Do less, but finish what matters.
        </p>

        {error && (
          <div className="mb-6 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md p-3 text-left">
            {error}
          </div>
        )}

        {/* Sign In Button */}
        <button
          id="google-signin-btn"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full py-3 px-4 inline-flex items-center justify-center gap-3 rounded-md border border-brand-border bg-brand-white hover:bg-brand-bg text-brand-dark hover:text-brand-dark font-medium text-sm transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-[0.99]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-brand-accent"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Connecting...
            </span>
          ) : (
            <>
              {/* Simple Google G Logo */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.5-.1.14 1.14 2.5l3.15-2.43c1.85-1.7 2.84-4.22 2.84-7.22z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.15-2.43c-.9.6-2.04.97-3.31.97-3.13 0-5.78-2.11-6.73-4.96L3.54 17.63C5.52 21.52 9.51 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.67c-.25-.7-.39-1.45-.39-2.22s.14-1.52.39-2.22L1.81 7.42C.66 9.72 0 12.28 0 14.67s.66 4.95 1.81 7.25l3.46-2.85z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.96 1.19 15.24 0 12 0 9.51 0 5.52 2.48 3.54 6.37l3.46 2.85c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="mt-8 text-[11px] text-brand-muted/70 tracking-wide uppercase">
          Secured by Firebase Authentication
        </div>
      </div>
    </div>
  );
}
