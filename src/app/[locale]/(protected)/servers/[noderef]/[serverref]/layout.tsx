import { ServerWorkspaceShell } from "@/components/servers/server-workspace-shell";

export default async function ServerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ noderef: string; serverref: string }>;
}) {
  const { noderef, serverref } = await params;

  return (
    <ServerWorkspaceShell currentNodeRef={noderef} currentServerRef={serverref}>
      {children}
    </ServerWorkspaceShell>
  );
}
