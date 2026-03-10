"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvitePermission, ServerGuestListItem, ServerInviteListItem } from "@/components/servers/cards/types";

type AccessCardProps = {
  inviteEmail: string;
  invitePermission: InvitePermission;
  inviteSubmitting: boolean;
  inviteError: string;
  invitesLoading: boolean;
  invites: ServerInviteListItem[];
  revokingInviteId: string;
  guestsLoading: boolean;
  guests: ServerGuestListItem[];
  removingGuestUserId: string;
  invitePermissionLabel: (permission: InvitePermission) => string;
  onInviteEmailChange: (value: string) => void;
  onInvitePermissionChange: (permission: InvitePermission) => void;
  onCreateInvite: () => void;
  onRevokeInvite: (inviteId: string) => void;
  onRemoveGuest: (userId: string) => void;
};

export default function AccessCard({
  inviteEmail,
  invitePermission,
  inviteSubmitting,
  inviteError,
  invitesLoading,
  invites,
  revokingInviteId,
  guestsLoading,
  guests,
  removingGuestUserId,
  invitePermissionLabel,
  onInviteEmailChange,
  onInvitePermissionChange,
  onCreateInvite,
  onRevokeInvite,
  onRemoveGuest,
}: AccessCardProps) {
  const t = useTranslations("ServerPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.title")}</CardTitle>
        <CardDescription>{t("access.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="invite-email">{t("access.fields.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(event) => onInviteEmailChange(event.target.value)}
              placeholder={t("access.fields.emailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-permission">{t("access.fields.role")}</Label>
            <select
              id="invite-permission"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={invitePermission}
              onChange={(event) => onInvitePermissionChange(event.target.value as InvitePermission)}
            >
              <option value="admin">{invitePermissionLabel("admin")}</option>
              <option value="operator">{invitePermissionLabel("operator")}</option>
              <option value="viewer">{invitePermissionLabel("viewer")}</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCreateInvite} disabled={inviteSubmitting || inviteEmail.trim() === ""}>
            {inviteSubmitting ? t("access.buttons.sendingInvite") : t("access.buttons.createInvite")}
          </Button>
        </div>
        {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}

        <div className="space-y-2">
          <h3 className="font-medium">{t("access.pendingInvites.title")}</h3>
          {invitesLoading ? <p className="text-sm">{t("access.loading")}</p> : null}
          {!invitesLoading && invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("access.pendingInvites.empty")}</p>
          ) : null}
          {!invitesLoading &&
            invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p>
                    {invite.email} - {invitePermissionLabel(invite.permission)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("access.pendingInvites.meta", {
                      inviter: invite.inviterMail,
                      expiresAt: new Date(invite.expiresAt).toLocaleString(),
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onRevokeInvite(invite.id)}
                  disabled={revokingInviteId === invite.id}
                >
                  {revokingInviteId === invite.id ? t("access.buttons.revoking") : t("access.buttons.revoke")}
                </Button>
              </div>
            ))}
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">{t("access.guests.title")}</h3>
          {guestsLoading ? <p className="text-sm">{t("access.loading")}</p> : null}
          {!guestsLoading && guests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("access.guests.empty")}</p>
          ) : null}
          {!guestsLoading &&
            guests.map((guest) => (
              <div
                key={guest.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p>
                    {guest.name || guest.email} - {invitePermissionLabel(guest.permission)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("access.guests.meta", {
                      email: guest.email,
                      createdAt: new Date(guest.createdAt).toLocaleString(),
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onRemoveGuest(guest.userId)}
                  disabled={removingGuestUserId === guest.userId}
                >
                  {removingGuestUserId === guest.userId
                    ? t("access.buttons.removing")
                    : t("access.buttons.remove")}
                </Button>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
