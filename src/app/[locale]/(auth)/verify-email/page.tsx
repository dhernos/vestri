// src/app/(auth)/verify-email/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl"; // <-- Import für next-intl
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function VerifyEmailPage() {
  // Initialisiere die Übersetzungsfunktionen
  const t = useTranslations("VerifyEmail");
  const tErrors = useTranslations("Errors");
  const tCommon = useTranslations("Common");
  const { push } = useToast();

  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const initialCode = searchParams.get("code") || "";

  const locale = useLocale();

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Function to handle the verification process
  const verifyAccount = useCallback(
    async (verificationCode: string) => {
      setLoading(true);

      if (!verificationCode || verificationCode.length !== 6) {
        push({ variant: "error", description: tErrors("INVALID_CODE_LENGTH") });
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": locale,
          },
          body: JSON.stringify({ email, code: verificationCode }),
        });

        const data = await response.json();

        if (response.ok) {
          push({ variant: "success", description: t("messages.success") });
          setTimeout(() => {
            router.push("/login?verificationSuccess=true");
          }, 2000);
        } else {
          push({
            variant: "error",
            description: data.message || tErrors("VERIFICATION_FAILED"),
          });
        }
      } catch (err) {
        push({ variant: "error", description: tErrors("UNEXPECTED_ERROR") });
        console.error("Verification error:", err);
      } finally {
        setLoading(false);
      }
    },
    [router, locale, email, t, tErrors, push]
  );

  useEffect(() => {
    // If no email is in the query parameters, redirect to register
    if (!email) {
      router.push("/register");
    }

    // Automatically verify if both email and code are in the URL
    if (email && initialCode) {
      verifyAccount(initialCode);
    }
  }, [email, router, initialCode, verifyAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAccount(code);
  };

  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    if (!email || resendLoading || cooldown > 0) return;
    setResendLoading(true);

    try {
      const response = await fetch("/api/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        push({ variant: "success", description: t("messages.resendSuccess") }); // Lokalisierte Erfolgsmeldung
        // Start the client-side countdown
        setCooldown(60);
      } else if (response.status === 429) {
        setCooldown(data.cooldown);
        push({
          variant: "error",
          description: t("messages.cooldownError", {
            cooldown: data.cooldown,
            seconds: tCommon("seconds"),
          }),
        });
      } else {
        push({ variant: "error", description: tErrors("RESEND_FAILED") }); // Lokalisierter Fallback-Fehler
      }
    } catch (err) {
      push({
        variant: "error",
        description: tErrors("UNEXPECTED_ERROR_RESEND"),
      });
      console.error("Resend error:", err);
    } finally {
      setResendLoading(false);
    }
  };

  // Add a useEffect to manage the countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md mx-auto p-4 space-y-4 shadow-lg rounded-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>
            {t.rich("description", {
              b: (chunks) => <b>{chunks}</b>,
              email: email ?? "",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="code" className="mb-2 block text-sm font-bold">
                {t("form.codeInputLabel")}
              </label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={loading}
                maxLength={6}
                pattern="\d{6}"
                inputMode="numeric"
                className="text-center text-lg font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={loading || code.length !== 6}
            >
              {loading ? t("form.loadingButton") : t("form.verifyButton")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            {t("resend.noCodeReceived")}{" "}
            <Button
              variant="link"
              onClick={handleResend}
              disabled={resendLoading || !email || cooldown > 0}
              className="text-blue-600 hover:text-blue-500 cursor-pointer"
            >
              {resendLoading
                ? t("resend.resendingButton")
                : cooldown > 0
                ? t.rich("resend.cooldownButton", {
                    cooldown: cooldown,
                    seconds: tCommon("seconds"),
                  })
                : t("resend.resendButton")}
            </Button>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link
              href="/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {t("backToRegister")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
