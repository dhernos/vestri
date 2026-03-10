"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateNodeCardProps = {
  name: string;
  ip: string;
  apiKey: string;
  submitting: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onIpChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export default function CreateNodeCard({
  name,
  ip,
  apiKey,
  submitting,
  error,
  onNameChange,
  onIpChange,
  onApiKeyChange,
  onSubmit,
}: CreateNodeCardProps) {
  const t = useTranslations("NodesPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("createNode.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="node-name">{t("createNode.fields.name")}</Label>
            <Input
              id="node-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t("createNode.fields.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-ip">{t("createNode.fields.host")}</Label>
            <Input
              id="node-ip"
              value={ip}
              onChange={(event) => onIpChange(event.target.value)}
              placeholder={t("createNode.fields.hostPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-api-key">{t("createNode.fields.apiKey")}</Label>
            <Input
              id="node-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder={t("createNode.fields.apiKeyPlaceholder")}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("createNode.buttons.creating") : t("createNode.buttons.create")}
            </Button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
