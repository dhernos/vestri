// src/app/dashboard/layout.tsx
"use client";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import LoadingPage from "@/components/loading-page"; // A simple loading component
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data: session } = useAuth();
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(false);

  // Debounce the loading indicator to avoid flicker on very fast transitions
  useEffect(() => {
    if (status === "loading") {
      const timer = setTimeout(() => setShowLoading(true), 200);
      return () => clearTimeout(timer);
    }
    setShowLoading(false);
  }, [status]);

  useEffect(() => {
    // If the session becomes invalid, we redirect
    if (status === "unauthenticated" || session?.error) {
      console.log("ProtectedLayout: Session invalid, redirecting.");
      router.push("/logout");
    }
  }, [status, session?.error, router]);

  // Show a loading page until the status is determined
  if (status === "loading" && showLoading) {
    return <LoadingPage />;
  }

  if (status === "loading") {
    return null;
  }

  // Render the page only if the user is authenticated
  if (status === "authenticated") {
    return <>{children}</>;
  }

  // Default case if something is wrong (should be rarely reached)
  return null;
}
