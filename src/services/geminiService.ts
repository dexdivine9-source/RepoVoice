// ──────────────────────────────────────────────────────────────────────────────
// Gemini Service — Frontend API Client
// All AI calls go through the backend (/api/generate, /api/refine)
// so the Gemini API key is NEVER exposed in the browser bundle.
// ──────────────────────────────────────────────────────────────────────────────

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  files?: {
    filename: string;
    status: string;
    patch?: string;
  }[];
}

export interface TimelineItem {
  date: string;
  event: string;
  type: "feature" | "bug" | "refactor" | "other";
}

export interface DevStory {
  features: string[];
  narrative: string;
  tweet: string;
  linkedin: string;
  blogDraft: string;
  timeline: TimelineItem[];
  weeklySummary: string;
}

/**
 * Sends commits to the backend, which securely calls Gemini AI and returns
 * the generated developer story.
 */
export async function generateDevStory(
  repoName: string,
  commits: GitHubCommit[]
): Promise<DevStory> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoName, commits }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate story from AI.");
  }

  return response.json();
}

/**
 * Sends the current story + user feedback to the backend for AI refinement.
 */
export async function refineDevStory(
  currentStory: DevStory,
  feedback: string
): Promise<DevStory> {
  const response = await fetch("/api/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ story: currentStory, feedback }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to refine story.");
  }

  return response.json();
}
