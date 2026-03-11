import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// Load env vars before anything else
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instantiate Gemini AI once — server-side only (key never exposed to browser)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Shared Gemini response schema for reuse
const devStorySchema = {
  type: Type.OBJECT,
  properties: {
    features: { type: Type.ARRAY, items: { type: Type.STRING } },
    narrative: { type: Type.STRING },
    tweet: { type: Type.STRING },
    linkedin: { type: Type.STRING },
    blogDraft: { type: Type.STRING },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          event: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ["feature", "bug", "refactor", "other"],
          },
        },
        required: ["date", "event", "type"],
      },
    },
    weeklySummary: { type: Type.STRING },
  },
  required: [
    "features",
    "narrative",
    "tweet",
    "linkedin",
    "blogDraft",
    "timeline",
    "weeklySummary",
  ],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  // GitHub OAuth credentials
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

  // ─────────────────────────────────────────────────────────────────────────
  // GITHUB: Commits Proxy (server-side, adds auth token to avoid rate limits)
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/github/commits", async (req, res) => {
    const { owner, repo } = req.query as { owner: string; repo: string };
    const token = req.cookies.github_token;

    if (!owner || !repo) {
      return res.status(400).json({ error: "Missing owner or repo parameter." });
    }

    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
      };
      if (token) {
        headers["Authorization"] = `token ${token}`;
      }

      const commitsRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
        { headers }
      );

      // Fetch detailed file info for top 5 commits
      const detailedCommits = await Promise.all(
        commitsRes.data.slice(0, 5).map(async (c: any) => {
          try {
            const detailRes = await axios.get(c.url, { headers });
            return detailRes.data;
          } catch {
            return c;
          }
        })
      );

      res.json({ commits: detailedCommits });
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 403) {
        res.status(403).json({
          error:
            "GitHub API rate limit exceeded. Connect your GitHub account for higher limits.",
        });
      } else if (status === 404) {
        res
          .status(404)
          .json({ error: "Repository not found. Please double-check the URL." });
      } else {
        res.status(500).json({
          error:
            error.response?.data?.message || "Failed to fetch repository commits.",
        });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GEMINI: Generate Dev Story (key stays on server — never in the browser)
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/api/generate", async (req, res) => {
    const { repoName, commits } = req.body;

    if (!repoName || !commits) {
      return res.status(400).json({ error: "Missing repoName or commits." });
    }

    const commitData = commits.map((c: any) => ({
      message: c.commit.message,
      date: c.commit.author.date,
      files: c.files?.map((f: any) => f.filename) || [],
    }));

    const prompt = `
      Analyze the following GitHub activity for the repository "${repoName}" and generate a developer story.
      
      Commit Activity:
      ${JSON.stringify(commitData, null, 2)}
      
      Tasks:
      1. Detect key features implemented based on commit messages and file changes.
      2. Write a human-readable developer narrative of the progress (2-3 sentences).
      3. Generate a short Tweet-style post (STRICTLY max 280 chars including hashtags).
      4. Generate a professional LinkedIn-style post with emojis and line breaks.
      5. Generate a longer developer blog draft in Markdown format with sections.
      6. Create a timeline of events sorted chronologically.
      7. Generate a concise weekly summary report.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: devStorySchema,
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Gemini Generate Error:", error.message);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate story." });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GEMINI: Refine Dev Story
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/api/refine", async (req, res) => {
    const { story, feedback } = req.body;

    if (!story || !feedback) {
      return res.status(400).json({ error: "Missing story or feedback." });
    }

    const prompt = `
      The user wants to refine their developer story.
      
      Current Story:
      ${JSON.stringify(story, null, 2)}
      
      User Feedback / Instructions:
      "${feedback}"
      
      Task:
      Update all fields (features, narrative, tweet, linkedin, blogDraft, timeline, weeklySummary) 
      based on the user's feedback. Maintain the exact same JSON structure.
      For the tweet, keep it STRICTLY under 280 characters.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: devStorySchema,
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Gemini Refine Error:", error.message);
      res
        .status(500)
        .json({ error: error.message || "Failed to refine story." });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GITHUB OAUTH
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/auth/github/url", (req, res) => {
    const redirectUri = `${APP_URL}/api/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "repo",
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const response = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        },
        { headers: { Accept: "application/json" } }
      );

      const { access_token } = response.data;

      res.cookie("github_token", access_token, {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("GitHub OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GITHUB: User & Push
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/github/user", async (req, res) => {
    const token = req.cookies.github_token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    try {
      const response = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `token ${token}` },
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/github/push", async (req, res) => {
    const token = req.cookies.github_token;
    const { owner, repo, path: filePath, content, message } = req.body;

    if (!token) return res.status(401).json({ error: "Not authenticated" });

    try {
      // Check if file exists (to get current SHA for update)
      let sha: string | undefined;
      try {
        const fileRes = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          { headers: { Authorization: `token ${token}` } }
        );
        sha = fileRes.data.sha;
      } catch {
        // File doesn't exist yet — that's fine for creation
      }

      const pushRes = await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          message,
          content: Buffer.from(content).toString("base64"),
          sha,
        },
        { headers: { Authorization: `token ${token}` } }
      );

      res.json({ success: true, url: pushRes.data.content.html_url });
    } catch (error: any) {
      console.error("GitHub Push Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to push to GitHub" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VITE DEV MIDDLEWARE / PRODUCTION STATIC
  // ─────────────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 RepoVoice server running at http://localhost:${PORT}\n`);
  });
}

startServer();
