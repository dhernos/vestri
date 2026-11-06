export async function deleteNotifications(id?: string): Promise<void> {
  const path =
    id === undefined
      ? "/api/notifications"
      : `/api/notifications/${encodeURIComponent(id)}`;
  const response = await fetch(path, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Notification deletion failed");
}
