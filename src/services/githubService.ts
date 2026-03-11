// ──────────────────────────────────────────────────────────────────────────────
// GitHub Service — Frontend API Client
// Commit fetching goes through /api/github/commits (backend proxy) so that:
//   1. The user's GitHub auth token is automatically included if connected.
//   2. Rate limit errors are caught and returned with helpful messages.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parses a GitHub repo URL or "owner/repo" shorthand into { owner, repo }.
 */
function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  let owner = "";
  let repo = "";

  const cleaned = repoUrl.trim().replace(/\/$/, ""); // remove trailing slash

  if (cleaned.includes("github.com")) {
    const parts = cleaned
      .replace("https://github.com/", "")
      .replace("http://github.com/", "")
      .split("/");
    owner = parts[0];
    repo = parts[1];
  } else {
    const parts = cleaned.split("/");
    owner = parts[0];
    repo = parts[1];
  }

  if (!owner || !repo) {
    throw new Error(
      "Invalid GitHub URL. Use the format: owner/repo or https://github.com/owner/repo"
    );
  }

  return { owner, repo };
}

/**
 * Fetches commits for a GitHub repo via the backend proxy.
 * The backend adds the user's auth token (if connected) to avoid rate limits.
 */
export async function fetchRepoCommits(repoUrl: string) {
  const { owner, repo } = parseRepoUrl(repoUrl);

  const response = await fetch(
    `/api/github/commits?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch repository commits.");
  }

  const { commits } = await response.json();
  return { owner, repo, commits };
}

/**
 * Gets the GitHub OAuth redirect URL from the backend.
 */
export async function getGitHubAuthUrl(): Promise<string> {
  const response = await fetch("/api/auth/github/url");
  if (!response.ok) throw new Error("Failed to get GitHub auth URL.");
  const { url } = await response.json();
  return url;
}

/**
 * Fetches the currently authenticated GitHub user (via cookie on server).
 * Returns null if not authenticated.
 */
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  id: number;
}

export async function fetchGitHubUser(): Promise<GitHubUser | null> {
  const response = await fetch("/api/github/user");
  if (!response.ok) return null;
  return response.json();
}

export interface PushToGitHubOptions {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
}

/**
 * Pushes a file to a GitHub repository via the backend.
 */
export async function pushToGitHub(
  data: PushToGitHubOptions
): Promise<{ success: boolean; url: string }> {
  const response = await fetch("/api/github/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to push to GitHub.");
  }

  return response.json();
}
