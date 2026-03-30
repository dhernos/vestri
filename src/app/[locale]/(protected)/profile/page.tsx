// src/app/profile/page.tsx
"use client";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ServerWorkspaceShell } from "@/components/servers/server-workspace-shell";
import { ProfileImageUploader } from "@/components/profile_page/profilePictureUpload";
import TwoFactorAuthSection from "@/components/profile_page/2FA";
import ChangePasswordSection from "@/components/profile_page/changePassword";
import AcitveSessionsSection from "@/components/profile_page/activeSessions";
import UpdateProfileSection from "@/components/profile_page/updateProfile";
import ChangeEmailSection from "@/components/profile_page/changeEmail";
import DeleteProfileSection from "@/components/profile_page/deleteProfile";
import PasskeySection from "@/components/profile_page/passkeys";
import { useAuth } from "@/hooks/useAuth";

export default function ProfilePage() {
  const { data: session, status } = useAuth();
  const router = useRouter();

  const t = useTranslations("ProfilePage");
  const tCommon = useTranslations("Common");

  if (status === "loading") {
    return <p>{tCommon("loading")}</p>;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <ServerWorkspaceShell
      currentNodeRef=""
      showServerNavigation={false}
      pageTitle={t("profilePageHeader")}
    >
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">
          <span className="flex items-center justify-between">
            {t("profilePageHeader")} {session?.user?.name}
            <ProfileImageUploader />
          </span>
        </h1>

        <UpdateProfileSection />

        <hr className="my-8" />

        <TwoFactorAuthSection />

        <PasskeySection />

        <ChangeEmailSection />

        <ChangePasswordSection />

        <AcitveSessionsSection />

        <DeleteProfileSection />
      </div>
    </ServerWorkspaceShell>
  );
}
