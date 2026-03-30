"use client";

type ServerStatus = "up" | "down" | "unknown";

type ServerStatusBlobProps = {
  status: ServerStatus;
  label: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<ServerStatusBlobProps["size"]>, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

const colorClasses: Record<ServerStatus, string> = {
  up: "bg-success",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};

export default function ServerStatusBlob({ status, label, size = "md" }: ServerStatusBlobProps) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-block rounded-full ${sizeClasses[size]} ${colorClasses[status]}`}
    />
  );
}
