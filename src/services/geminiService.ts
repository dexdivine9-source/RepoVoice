import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export interface DevStory {
  features: string[];
  narrative: string;
  tweet: string;
  linkedin: string;
  blogDraft: string;
  timeline: {
    date: string;
    event: string;
    type: 'feature' | 'bug' | 'refactor' | 'other';
  }[];
  weeklySummary: string;
}

export async function generateDevStory(repoName: string, commits: GitHubCommit[]): Promise<DevStory> {
  const commitData = commits.map(c => ({
    message: c.commit.message,
    date: c.commit.author.date,
    files: c.files?.map(f => f.filename) || []
  }));

  const prompt = `
    Analyze the following GitHub activity for the repository "${repoName}" and generate a developer story.
    
    Activity:
    ${JSON.stringify(commitData, null, 2)}
    
    Tasks:
    1. Detect key features implemented based on commit messages and file changes.
    2. Write a human-readable developer narrative of the progress.
    3. Generate a short Tweet-style post (max 280 chars).
    4. Generate a professional LinkedIn-style post.
    5. Generate a longer developer blog draft (Markdown format).
    6. Create a timeline of events.
    7. Generate a weekly summary report.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
                type: { type: Type.STRING, enum: ['feature', 'bug', 'refactor', 'other'] }
              },
              required: ['date', 'event', 'type']
            }
          },
          weeklySummary: { type: Type.STRING }
        },
        required: ['features', 'narrative', 'tweet', 'linkedin', 'blogDraft', 'timeline', 'weeklySummary']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function refineDevStory(currentStory: DevStory, feedback: string): Promise<DevStory> {
  const prompt = `
    The user wants to refine the developer story generated previously.
    
    Current Story:
    ${JSON.stringify(currentStory, null, 2)}
    
    User Feedback:
    "${feedback}"
    
    Task:
    Update the features, narrative, tweet, linkedin, blogDraft, timeline, and weeklySummary based on this feedback.
    Maintain the same JSON structure.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
                type: { type: Type.STRING, enum: ['feature', 'bug', 'refactor', 'other'] }
              },
              required: ['date', 'event', 'type']
            }
          },
          weeklySummary: { type: Type.STRING }
        },
        required: ['features', 'narrative', 'tweet', 'linkedin', 'blogDraft', 'timeline', 'weeklySummary']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
