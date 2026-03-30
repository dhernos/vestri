import type { GoUser } from "@/lib/auth-client";

type StepUpUserContext =
  | Pick<GoUser, "email" | "isTwoFactorEnabled" | "twoFactorMethod">
  | null
  | undefined;

export function shouldSendStepUpEmailCode(user: StepUpUserContext): user is NonNullable<StepUpUserContext> {
  if (!user?.email) return false;
  return Boolean(user.isTwoFactorEnabled && user.twoFactorMethod === "email");
}

type StepUpCodeResponse = {
  ok: boolean;
  status: number;
  code?: string;
};

type StepUpPrepareResult = {
  ok: boolean;
  code?: string;
  status?: number;
};

const isMessageCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_]+$/.test(value);

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendStepUpEmailCodeWithResult(
  user: StepUpUserContext
): Promise<StepUpCodeResponse> {
  if (!shouldSendStepUpEmailCode(user)) {
    return { ok: false, status: 0, code: "EMAIL_REQUIRED" };
  }
  try {
    const res = await fetch("/api/two-factor/send-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: user.email }),
    });
    const data = await safeJson(res);
    const code = isMessageCode(data?.message)
      ? data.message
      : isMessageCode(data?.error)
        ? data.error
        : undefined;
    return { ok: res.ok, status: res.status, code };
  } catch {
    return { ok: false, status: 0, code: "UNEXPECTED_ERROR" };
  }
}

async function tryStepUpChallengeTrigger(purpose: string): Promise<StepUpCodeResponse> {
  try {
    const res = await fetch("/api/two-factor/step-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ purpose }),
    });
    const data = await safeJson(res);
    const code = isMessageCode(data?.message)
      ? data.message
      : isMessageCode(data?.error)
        ? data.error
        : undefined;
    if (res.ok) {
      return { ok: true, status: res.status, code };
    }
    if (res.status === 403 && code === "STEP_UP_REQUIRED") {
      return { ok: true, status: res.status, code };
    }
    return { ok: false, status: res.status, code };
  } catch {
    return { ok: false, status: 0, code: "UNEXPECTED_ERROR" };
  }
}

export async function prepareStepUpCode(
  user: StepUpUserContext,
  purpose?: string
): Promise<StepUpPrepareResult> {
  if (user?.isTwoFactorEnabled && user.twoFactorMethod === "app") {
    return { ok: true };
  }
  if (purpose) {
    const triggerResult = await tryStepUpChallengeTrigger(purpose);
    if (!triggerResult.ok) {
      return {
        ok: false,
        code: triggerResult.code || "SEND_CODE_ERROR",
        status: triggerResult.status,
      };
    }
    // Challenge delivery is handled by /api/two-factor/step-up for step-up purposes.
    return { ok: true };
  }

  if (!shouldSendStepUpEmailCode(user)) {
    return { ok: true };
  }

  const sendResult = await sendStepUpEmailCodeWithResult(user);
  if (sendResult.ok) {
    return { ok: true };
  }

  return {
    ok: false,
    code: sendResult.code || "SEND_CODE_ERROR",
    status: sendResult.status,
  };
}

export async function sendStepUpEmailCode(user: StepUpUserContext): Promise<boolean> {
  const result = await sendStepUpEmailCodeWithResult(user);
  return result.ok;
}
