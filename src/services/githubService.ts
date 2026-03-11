export async function fetchRepoCommits(repoUrl: string) {
  try {
    // Extract owner and repo from URL
    // Expected formats: https://github.com/owner/repo or owner/repo
    let owner = "";
    let repo = "";

    if (repoUrl.includes("github.com")) {
      const parts = repoUrl.replace("https://github.com/", "").split("/");
      owner = parts[0];
      repo = parts[1];
    } else {
      const parts = repoUrl.split("/");
      owner = parts[0];
      repo = parts[1];
    }

    if (!owner || !repo) throw new Error("Invalid GitHub URL");

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`);
    if (!response.ok) throw new Error("Failed to fetch commits");
    
    const commits = await response.json();
    
    // For each commit, we might want to fetch file details if we had more rate limit/time
    // But for MVP, we'll stick to the commit messages and maybe the first few file lists if possible
    // Actually, let's try to get file details for the latest 3 commits to improve AI quality
    const detailedCommits = await Promise.all(commits.slice(0, 5).map(async (c: any) => {
      try {
        const detailRes = await fetch(c.url);
        if (detailRes.ok) return await detailRes.json();
      } catch (e) {
        console.error("Error fetching commit details", e);
      }
      return c;
    }));

    return { owner, repo, commits: detailedCommits };
  } catch (error) {
    console.error("GitHub Fetch Error:", error);
    throw error;
  }
}

export async function getGitHubAuthUrl() {
  const response = await fetch("/api/auth/github/url");
  if (!response.ok) throw new Error("Failed to get auth URL");
  const { url } = await response.json();
  return url;
}

export async function fetchGitHubUser() {
  const response = await fetch("/api/github/user");
  if (!response.ok) return null;
  return await response.json();
}

export async function pushToGitHub(data: {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
}) {
  const response = await fetch("/api/github/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to push to GitHub");
  }
  return await response.json();
}
