// actions/version.js
"use server"; // Marks the function as a Server Action

const GITHUB_VERSION_URL =
  "https://raw.githubusercontent.com/dhernos/Simple-Grades/refs/heads/master/public/version.txt";

export async function getRemoteVersion() {
  try {
    const response = await fetch(GITHUB_VERSION_URL, {
      // Optional: Add a cache-buster if needed
      cache: "no-store",
    });

    if (!response.ok) {
      // Throw a specific error for better debugging
      throw new Error(
        `Failed to fetch remote version: HTTP Status ${response.status}`
      );
    }

    const remoteVersion = (await response.text()).trim();
    return remoteVersion;
  } catch (error) {
    console.error("Server failed to get GitHub version:", error.message);
    // Return a known fallback value
    return null;
  }
}
