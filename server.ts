import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // GitHub OAuth URLs
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  const APP_URL = process.env.APP_URL;

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
      
      // Set cookie for the iframe context
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
      // Check if file exists to get its SHA
      let sha: string | undefined;
      try {
        const fileRes = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          { headers: { Authorization: `token ${token}` } }
        );
        sha = fileRes.data.sha;
      } catch (e) {
        // File doesn't exist, which is fine for creation
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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
