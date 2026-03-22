import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import ToggleLanguage from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";

type GuideSectionId =
  | "connectNode"
  | "createServer"
  | "operateServer"
  | "teamAndAccess"
  | "updateRoutine";

type GuideSection = {
  id: GuideSectionId;
  title: string;
  description: string;
  steps: string[];
  screenshotLabel: string;
};

type EnvVarGuideEntry = {
  variable: string;
  required: "required" | "recommended" | "optional";
  defaultValue: string;
  scope: string;
  description: string;
};

type WorkerSettingGuideEntry = {
  keyName: string;
  defaultValue: string;
  description: string;
};

export default async function HowToPage() {
  const t = await getTranslations("HowToPage");
  const workerServiceSnippet = `[Unit]
Description=Vestri Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vestri-worker
ExecStart=/usr/local/bin/vestri-worker
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target`;

  const envVariables: EnvVarGuideEntry[] = [
    {
      variable: "GO_API_URL",
      required: "required",
      defaultValue: "http://localhost:8080",
      scope: "frontend",
      description: "Backend base URL used by rewrites, proxy middleware, and API proxy routes.",
    },
    {
      variable: "NODE_ENV",
      required: "optional",
      defaultValue: "framework default",
      scope: "frontend",
      description: "Runtime mode (`production` in container images).",
    },
    {
      variable: "NEXT_TELEMETRY_DISABLED",
      required: "optional",
      defaultValue: "unset",
      scope: "frontend",
      description: "Set `1` to disable Next.js telemetry.",
    },
    {
      variable: "PORT",
      required: "optional",
      defaultValue: "8080",
      scope: "backend",
      description: "Backend listen port.",
    },
    {
      variable: "APP_BASE_URL",
      required: "recommended",
      defaultValue: "NEXTAUTH_URL or http://localhost:3000",
      scope: "backend",
      description: "Base URL for callbacks and generated links.",
    },
    {
      variable: "NEXTAUTH_URL",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "Fallback source for APP_BASE_URL.",
    },
    {
      variable: "DATABASE_URL",
      required: "required",
      defaultValue: "none",
      scope: "backend + migrate CLI",
      description: "PostgreSQL connection string.",
    },
    {
      variable: "REDIS_URL",
      required: "optional",
      defaultValue: "redis://localhost:6379",
      scope: "backend",
      description: "Redis connection for sessions and rate limits.",
    },
    {
      variable: "UPLOAD_DIR",
      required: "optional",
      defaultValue: "../auth_template/public/uploads",
      scope: "backend",
      description: "Profile image upload directory.",
    },
    {
      variable: "LOG_FILE",
      required: "optional",
      defaultValue: "logs/server.log",
      scope: "backend",
      description: "Backend log output file.",
    },
    {
      variable: "LOG_MAX_SIZE_MB",
      required: "optional",
      defaultValue: "5",
      scope: "backend",
      description: "Max log file size before rotation.",
    },
    {
      variable: "LOG_MAX_BACKUPS",
      required: "optional",
      defaultValue: "1",
      scope: "backend",
      description: "Number of rotated log backups.",
    },
    {
      variable: "NO_EMAIL_VERIFY",
      required: "optional",
      defaultValue: "true",
      scope: "backend",
      description: "Disable email verification checks.",
    },
    {
      variable: "TOTP_ISSUER",
      required: "optional",
      defaultValue: "Vestri",
      scope: "backend",
      description: "Issuer name for authenticator apps.",
    },
    {
      variable: "WORKER_TLS_CA_CERT_FILE",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "Additional trusted worker CA certificate file.",
    },
    {
      variable: "WORKER_TLS_CA_CERT_DIR",
      required: "optional",
      defaultValue: "./certs/worker-cas",
      scope: "backend",
      description: "Directory with trusted worker CA certs.",
    },
    {
      variable: "NODE_API_KEY_ENCRYPTION_KEY",
      required: "recommended",
      defaultValue: "unset",
      scope: "backend",
      description: "Encryption key for stored worker node API keys.",
    },
    {
      variable: "TRUSTED_PROXIES",
      required: "optional",
      defaultValue: "empty list",
      scope: "backend",
      description: "Comma-separated list of trusted proxy IPs/CIDRs.",
    },
    {
      variable: "EMAIL_SERVER_HOST",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "SMTP host.",
    },
    {
      variable: "EMAIL_SERVER_PORT",
      required: "optional",
      defaultValue: "587",
      scope: "backend",
      description: "SMTP port.",
    },
    {
      variable: "EMAIL_SERVER_USER",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "SMTP username.",
    },
    {
      variable: "EMAIL_SERVER_PASSWORD",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "SMTP password.",
    },
    {
      variable: "EMAIL_FROM",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "SMTP sender address.",
    },
    {
      variable: "EMAIL_SERVER_SECURE",
      required: "optional",
      defaultValue: "false",
      scope: "backend",
      description: "Enable secure SMTP mode.",
    },
    {
      variable: "WEB_AUTHN_ORIGIN",
      required: "optional",
      defaultValue: "APP_BASE_URL",
      scope: "backend",
      description: "Primary WebAuthn origin.",
    },
    {
      variable: "WEB_AUTHN_RP_ID",
      required: "optional",
      defaultValue: "host from WEB_AUTHN_ORIGIN",
      scope: "backend",
      description: "WebAuthn relying-party ID.",
    },
    {
      variable: "WEB_AUTHN_RP_NAME",
      required: "optional",
      defaultValue: "Auth Service",
      scope: "backend",
      description: "WebAuthn relying-party display name.",
    },
    {
      variable: "WEB_AUTHN_ORIGINS",
      required: "optional",
      defaultValue: "WEB_AUTHN_ORIGIN",
      scope: "backend",
      description: "Comma-separated allowed WebAuthn origins.",
    },
    {
      variable: "GITHUB_CLIENT_ID",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "GitHub OAuth client ID.",
    },
    {
      variable: "GITHUB_CLIENT_SECRET",
      required: "optional",
      defaultValue: "unset",
      scope: "backend",
      description: "GitHub OAuth client secret.",
    },
    {
      variable: "GITHUB_REDIRECT_URL",
      required: "optional",
      defaultValue: "<APP_BASE_URL>/api/oauth/github/callback",
      scope: "backend",
      description: "GitHub OAuth callback URL.",
    },
    {
      variable: "AUTO_MIGRATE",
      required: "optional",
      defaultValue: "true",
      scope: "backend",
      description: "Auto-apply SQL migrations during backend startup.",
    },
    {
      variable: "MIGRATIONS_DIR",
      required: "optional",
      defaultValue: "./migrations",
      scope: "backend + migrate CLI",
      description: "Directory containing `*.up.sql` migration files.",
    },
    {
      variable: "POSTGRES_USER",
      required: "optional",
      defaultValue: "vestri",
      scope: "docker compose / postgres",
      description: "PostgreSQL user for the bundled stack.",
    },
    {
      variable: "POSTGRES_PASSWORD",
      required: "optional",
      defaultValue: "vestri",
      scope: "docker compose / postgres",
      description: "PostgreSQL password for the bundled stack.",
    },
    {
      variable: "POSTGRES_DB",
      required: "optional",
      defaultValue: "vestri",
      scope: "docker compose / postgres",
      description: "PostgreSQL database name for the bundled stack.",
    },
  ];

  const workerSettingsOptions: WorkerSettingGuideEntry[] = [
    { keyName: "useTLS", defaultValue: "true", description: "Enable HTTPS/TLS listener." },
    { keyName: "TLSCert", defaultValue: "/etc/vestri/certs/worker.crt", description: "Worker TLS certificate path." },
    { keyName: "TLSKey", defaultValue: "/etc/vestri/certs/worker.key", description: "Worker TLS private key path." },
    { keyName: "tls_ca_cert", defaultValue: "/etc/vestri/certs/ca.crt", description: "Worker CA certificate path." },
    { keyName: "tls_ca_key", defaultValue: "/etc/vestri/certs/ca.key", description: "Worker CA private key path." },
    { keyName: "tls_auto_generate", defaultValue: "true", description: "Auto-generate missing TLS CA/server cert assets." },
    { keyName: "tls_sans", defaultValue: "[\"localhost\",\"127.0.0.1\",\"::1\"]", description: "Extra SAN entries for generated server cert." },
    { keyName: "http_port", defaultValue: ":8031", description: "Worker listen address/port." },
    { keyName: "worker_name", defaultValue: "", description: "Optional worker name included in cert SAN generation." },
    { keyName: "fs_base_path", defaultValue: "/etc/vestri/servers", description: "Safe base path for all worker filesystem operations." },
    { keyName: "replay_window_seconds", defaultValue: "300", description: "Allowed request timestamp skew for signed API requests." },
    { keyName: "rate_limit_rps", defaultValue: "10", description: "Rate limiter token refill rate." },
    { keyName: "rate_limit_burst", defaultValue: "20", description: "Rate limiter burst bucket size." },
    { keyName: "max_archive_request_bytes", defaultValue: "1048576", description: "Max request body for archive endpoints." },
    { keyName: "max_inline_write_bytes", defaultValue: "10485760", description: "Max request body for inline file writes." },
    { keyName: "max_upload_bytes", defaultValue: "1073741824", description: "Max upload size (`/fs/upload`)." },
    { keyName: "max_unzip_bytes", defaultValue: "10737418240", description: "Max extracted size for unzip operations." },
    { keyName: "max_zip_entries", defaultValue: "100000", description: "Max zip entry count." },
    { keyName: "require_tls", defaultValue: "true", description: "Reject non-TLS requests unless trusted proxy headers indicate HTTPS." },
    { keyName: "trust_proxy_headers", defaultValue: "false", description: "Trust forwarded proxy headers for TLS/IP handling." },
    { keyName: "health_requires_auth", defaultValue: "false", description: "Require auth for `/health` endpoint." },
  ];

  const requiredLabels: Record<EnvVarGuideEntry["required"], string> = {
    required: t("configReference.required.required"),
    recommended: t("configReference.required.recommended"),
    optional: t("configReference.required.optional"),
  };

  const sections: Record<GuideSectionId, GuideSection> = {
    connectNode: {
      id: "connectNode",
      title: t("sections.connectNode.title"),
      description: t("sections.connectNode.description"),
      steps: [
        t("sections.connectNode.steps.1"),
        t("sections.connectNode.steps.2"),
        t("sections.connectNode.steps.3"),
        t("sections.connectNode.steps.4"),
      ],
      screenshotLabel: t("sections.connectNode.screenshotLabel"),
    },
    createServer: {
      id: "createServer",
      title: t("sections.createServer.title"),
      description: t("sections.createServer.description"),
      steps: [
        t("sections.createServer.steps.1"),
        t("sections.createServer.steps.2"),
        t("sections.createServer.steps.3"),
        t("sections.createServer.steps.4"),
      ],
      screenshotLabel: t("sections.createServer.screenshotLabel"),
    },
    operateServer: {
      id: "operateServer",
      title: t("sections.operateServer.title"),
      description: t("sections.operateServer.description"),
      steps: [
        t("sections.operateServer.steps.1"),
        t("sections.operateServer.steps.2"),
        t("sections.operateServer.steps.3"),
        t("sections.operateServer.steps.4"),
      ],
      screenshotLabel: t("sections.operateServer.screenshotLabel"),
    },
    teamAndAccess: {
      id: "teamAndAccess",
      title: t("sections.teamAndAccess.title"),
      description: t("sections.teamAndAccess.description"),
      steps: [
        t("sections.teamAndAccess.steps.1"),
        t("sections.teamAndAccess.steps.2"),
        t("sections.teamAndAccess.steps.3"),
        t("sections.teamAndAccess.steps.4"),
      ],
      screenshotLabel: t("sections.teamAndAccess.screenshotLabel"),
    },
    updateRoutine: {
      id: "updateRoutine",
      title: t("sections.updateRoutine.title"),
      description: t("sections.updateRoutine.description"),
      steps: [
        t("sections.updateRoutine.steps.1"),
        t("sections.updateRoutine.steps.2"),
        t("sections.updateRoutine.steps.3"),
        t("sections.updateRoutine.steps.4"),
      ],
      screenshotLabel: t("sections.updateRoutine.screenshotLabel"),
    },
  };

  const renderSection = (sectionId: GuideSectionId, stepNumber: number) => {
    const section = sections[sectionId];
    return (
      <article key={section.id} className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">
          {t("stepPrefix")} {stepNumber}
        </p>
        <h3 className="mt-1 text-xl font-semibold md:text-2xl">{section.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{section.description}</p>

        <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
          {section.steps.map((step, stepIndex) => (
            <li key={`${section.id}-step-${stepIndex + 1}`}>{step}</li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center">
          <p className="text-sm font-semibold">{section.screenshotLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("screenshotPlaceholder")}</p>
        </div>
      </article>
    );
  };

  return (
    <div id="top" className="relative min-h-screen overflow-hidden">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <ToggleLanguage compact />
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 md:gap-8">
        <section className="rounded-2xl border bg-card/88 p-6 backdrop-blur-sm md:p-8">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/25 bg-card shadow-sm shadow-primary/20 md:size-20">
              <Image
                src="/logos/vestri/vestri_transparent.svg"
                alt="Vestri logo"
                width={58}
                height={58}
                className="size-11 object-contain md:size-14 dark:invert dark:brightness-125"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-primary">{t("hero.kicker")}</p>
              <p className="text-sm text-muted-foreground">{t("hero.tagline")}</p>
            </div>
          </div>

          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground md:text-lg">{t("hero.subtitle")}</p>

          <p className="mt-7 text-xs font-semibold tracking-[0.2em] text-primary">{t("chapters.title")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <a
              href="#node-onboarding"
              className="rounded-lg border bg-background/55 px-3 py-2 text-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {t("chapters.nodeOnboarding")}
            </a>
            <a
              href="#server-lifecycle"
              className="rounded-lg border bg-background/55 px-3 py-2 text-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {t("chapters.serverLifecycle")}
            </a>
            <a
              href="#access-security"
              className="rounded-lg border bg-background/55 px-3 py-2 text-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {t("chapters.accessSecurity")}
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/register">{t("hero.actions.register")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">{t("hero.actions.login")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">{t("hero.actions.home")}</Link>
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
          <h2 className="text-xl font-semibold md:text-2xl">{t("prerequisites.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("prerequisites.description")}</p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li>{t("prerequisites.items.1")}</li>
            <li>{t("prerequisites.items.2")}</li>
            <li>{t("prerequisites.items.3")}</li>
          </ul>
        </section>

        <section className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
          <h2 className="text-xl font-semibold md:text-2xl">{t("configReference.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("configReference.description")}</p>

          <article className="mt-6 rounded-xl border bg-background/40 p-4 md:p-5">
            <h3 className="text-base font-semibold md:text-lg">{t("configReference.environment.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("configReference.environment.description")}</p>

            <div className="mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs md:text-sm">
                <thead className="bg-background/70 text-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.variable")}</th>
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.required")}</th>
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.default")}</th>
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.scope")}</th>
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.description")}</th>
                  </tr>
                </thead>
                <tbody>
                  {envVariables.map((entry) => (
                    <tr key={entry.variable} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2 font-mono text-[11px] md:text-xs">{entry.variable}</td>
                      <td className="px-3 py-2">{requiredLabels[entry.required]}</td>
                      <td className="px-3 py-2 font-mono text-[11px] md:text-xs">{entry.defaultValue}</td>
                      <td className="px-3 py-2">{entry.scope}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="mt-6 rounded-xl border bg-background/40 p-4 md:p-5">
            <h3 className="text-base font-semibold md:text-lg">{t("configReference.workerSettings.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("configReference.workerSettings.description")}</p>

            <div className="mt-4 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs md:text-sm">
                <thead className="bg-background/70 text-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.key")}</th>
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.default")}</th>
                    <th className="px-3 py-2 font-semibold">{t("configReference.columns.description")}</th>
                  </tr>
                </thead>
                <tbody>
                  {workerSettingsOptions.map((entry) => (
                    <tr key={entry.keyName} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2 font-mono text-[11px] md:text-xs">{entry.keyName}</td>
                      <td className="px-3 py-2 font-mono text-[11px] md:text-xs">{entry.defaultValue}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <p className="mt-4 text-xs text-muted-foreground">{t("configReference.parsingHint")}</p>
        </section>

        <section id="node-onboarding" className="space-y-5 scroll-mt-24">
          <header className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
            <h2 className="text-2xl font-semibold">{t("chapters.nodeOnboarding")}</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("chapters.nodeOnboardingDescription")}</p>
          </header>

          <article className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">
              {t("stepPrefix")} 1
            </p>
            <h3 className="mt-1 text-xl font-semibold md:text-2xl">{t("bootstrap.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("bootstrap.description")}</p>

            <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
              <li>{t("bootstrap.steps.1")}</li>
              <li>{t("bootstrap.steps.2")}</li>
              <li>{t("bootstrap.steps.3")}</li>
              <li>{t("bootstrap.steps.4")}</li>
            </ol>

            <p className="mt-5 text-sm font-semibold">{t("bootstrap.pathsTitle")}</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
              <li>{t("bootstrap.paths.settings")}</li>
              <li>{t("bootstrap.paths.apiKey")}</li>
              <li>{t("bootstrap.paths.workerCA")}</li>
              <li>{t("bootstrap.paths.backendCADir")}</li>
            </ul>

            <p className="mt-5 text-sm font-semibold">{t("bootstrap.rulesTitle")}</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
              <li>{t("bootstrap.rules.1")}</li>
              <li>{t("bootstrap.rules.2")}</li>
              <li>{t("bootstrap.rules.3")}</li>
              <li>{t("bootstrap.rules.4")}</li>
            </ul>

            <div className="mt-5 rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center">
              <p className="text-sm font-semibold">{t("bootstrap.screenshotLabel")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("screenshotPlaceholder")}</p>
            </div>
          </article>

          {renderSection("connectNode", 2)}

          <article className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">
              {t("stepPrefix")} 3
            </p>
            <h3 className="mt-1 text-xl font-semibold md:text-2xl">{t("systemd.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("systemd.description")}</p>

            <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
              <li>{t("systemd.steps.1")}</li>
              <li>{t("systemd.steps.2")}</li>
              <li>{t("systemd.steps.3")}</li>
              <li>{t("systemd.steps.4")}</li>
            </ol>

            <div className="mt-5">
              <div className="rounded-xl border bg-background/40 p-4">
                <p className="text-sm font-semibold">{t("systemd.workerServiceTitle")}</p>
                <pre className="mt-2 overflow-x-auto rounded-md border bg-background/70 p-3 text-xs text-muted-foreground">
                  <code>{workerServiceSnippet}</code>
                </pre>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-background/40 p-4 text-sm text-muted-foreground">
              <p>{t("systemd.enableHint")}</p>
              <pre className="mt-2 overflow-x-auto rounded-md border bg-background/70 p-3 text-xs">
                <code>
                  sudo systemctl daemon-reload{"\n"}
                  sudo systemctl enable --now vestri-stack{"\n"}
                  sudo systemctl enable --now vestri-worker
                </code>
              </pre>
            </div>

            <div className="mt-5 rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center">
              <p className="text-sm font-semibold">{t("systemd.screenshotLabel")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("screenshotPlaceholder")}</p>
            </div>
          </article>
        </section>

        <section id="server-lifecycle" className="space-y-5 scroll-mt-24">
          <header className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
            <h2 className="text-2xl font-semibold">{t("chapters.serverLifecycle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("chapters.serverLifecycleDescription")}</p>
          </header>

          {renderSection("createServer", 4)}
          {renderSection("operateServer", 5)}
          {renderSection("updateRoutine", 6)}
        </section>

        <section id="access-security" className="space-y-5 scroll-mt-24">
          <header className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
            <h2 className="text-2xl font-semibold">{t("chapters.accessSecurity")}</h2>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("chapters.accessSecurityDescription")}</p>
          </header>

          {renderSection("teamAndAccess", 7)}
        </section>

        <section className="rounded-2xl border bg-card/82 p-6 backdrop-blur-sm md:p-8">
          <h2 className="text-xl font-semibold md:text-2xl">{t("nextSteps.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{t("nextSteps.description")}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/login">{t("nextSteps.actions.login")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/register">{t("nextSteps.actions.register")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <Button asChild variant="outline" size="sm" className="fixed bottom-4 right-4 z-30 shadow-md">
        <a href="#top" aria-label={t("backToTop")}>
          <span aria-hidden="true">↑</span>
          {t("backToTop")}
        </a>
      </Button>
    </div>
  );
}
