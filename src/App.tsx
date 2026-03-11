import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Github, 
  Sparkles, 
  Twitter, 
  Linkedin, 
  FileText, 
  Calendar, 
  ChevronRight, 
  Copy, 
  Check,
  Loader2,
  ArrowRight,
  History,
  LayoutDashboard,
  ExternalLink,
  Send
} from 'lucide-react';
import { fetchRepoCommits, getGitHubAuthUrl, fetchGitHubUser, pushToGitHub } from './services/githubService';
import { generateDevStory, refineDevStory, DevStory } from './services/geminiService';

export default function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [story, setStory] = useState<DevStory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [githubUser, setGithubUser] = useState<any>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);

  const loadingMessages = [
    "Analyzing repository structure...",
    "Decoding commit messages...",
    "Identifying feature patterns...",
    "Crafting your developer narrative...",
    "Polishing social media updates...",
    "Almost there, finalizing the timeline..."
  ];

  useEffect(() => {
    // Check if user is already authenticated with GitHub
    fetchGitHubUser().then(setGithubUser);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        fetchGitHubUser().then(setGithubUser);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    let interval: any;
    if (loading) {
      let step = 0;
      setLoadingStep(loadingMessages[0]);
      interval = setInterval(() => {
        step = (step + 1) % loadingMessages.length;
        setLoadingStep(loadingMessages[step]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleConnectGitHub = async () => {
    try {
      const url = await getGitHubAuthUrl();
      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (err) {
      setError("Failed to start GitHub authentication");
    }
  };

  const handlePushToGitHub = async () => {
    if (!story || !githubUser) return;
    
    setPushing(true);
    setError(null);
    setPushSuccess(null);

    try {
      // Extract owner and repo from current repoUrl or ask user?
      // For MVP, we'll try to parse from the input repoUrl
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

      const date = new Date().toISOString().split('T')[0];
      const fileName = `stories/dev-story-${date}.md`;
      
      const result = await pushToGitHub({
        owner,
        repo,
        path: fileName,
        content: story.blogDraft,
        message: `Add DevStory for ${date}`
      });

      setPushSuccess(result.url);
    } catch (err: any) {
      setError(err.message || "Failed to push to GitHub. Make sure you have write access to the repo.");
    } finally {
      setPushing(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setLoading(true);
    setError(null);
    setStory(null);
    setPushSuccess(null);

    try {
      const { repo, commits } = await fetchRepoCommits(repoUrl);
      const generatedStory = await generateDevStory(repo, commits);
      setStory(generatedStory);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput || !story || refining) return;

    setRefining(true);
    try {
      const refinedStory = await refineDevStory(story, chatInput);
      setStory(refinedStory);
      setChatInput('');
    } catch (err: any) {
      setError("Failed to refine story. Please try again.");
    } finally {
      setRefining(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] font-sans selection:bg-emerald-500/30">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">DevStory</h1>
          </div>
          <div className="flex items-center gap-4">
            {githubUser ? (
              <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <img src={githubUser.avatar_url} alt={githubUser.login} className="w-5 h-5 rounded-full" />
                <span className="text-sm font-medium">{githubUser.login}</span>
              </div>
            ) : (
              <button 
                onClick={handleConnectGitHub}
                className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10"
              >
                <Github className="w-4 h-4" /> Connect GitHub
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 pb-32">
        {/* Hero Section */}
        {!story && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h2 className="text-5xl font-bold mb-6 tracking-tight leading-tight">
              Turn your code into <span className="text-emerald-500">stories.</span>
            </h2>
            <p className="text-white/60 text-lg mb-10">
              DevStory analyzes your GitHub activity and generates ready-to-publish social posts, 
              developer insights, and visual timelines. Stop worrying about documentation.
            </p>

            <form onSubmit={handleAnalyze} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center bg-[#141414] rounded-xl border border-white/10 p-2">
                <Github className="w-6 h-6 ml-4 text-white/40" />
                <input 
                  type="text" 
                  placeholder="Paste GitHub Repository URL (e.g. owner/repo)"
                  className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-white placeholder:text-white/20"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
                <button 
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-lg transition-all flex items-center gap-2"
                >
                  Analyze <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
            
            {error && (
              <p className="mt-4 text-red-400 text-sm">{error}</p>
            )}
          </motion.div>
        )}

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-20 h-20 mb-8">
                <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-xl font-medium text-emerald-500 animate-pulse">{loadingStep}</p>
              <p className="text-white/40 mt-2">This might take a few seconds...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Dashboard */}
        {story && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar: Features & Timeline */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-[#141414] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <LayoutDashboard className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-lg">Detected Features</h3>
                </div>
                <ul className="space-y-3">
                  {story.features.map((feature, i) => (
                    <motion.li 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i} 
                      className="flex items-start gap-3 text-sm text-white/70"
                    >
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                      {feature}
                    </motion.li>
                  ))}
                </ul>
              </section>

              <section className="bg-[#141414] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <History className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-lg">Dev Timeline</h3>
                </div>
                <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
                  {story.timeline.map((item, i) => (
                    <div key={i} className="relative pl-6">
                      <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-[#141414] z-10 ${
                        item.type === 'feature' ? 'bg-emerald-500' : 
                        item.type === 'bug' ? 'bg-red-500' : 
                        item.type === 'refactor' ? 'bg-blue-500' : 'bg-white/30'
                      }`}></div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-mono">
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-sm font-medium">{item.event}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Main Content: Posts */}
            <div className="lg:col-span-8 space-y-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-bold tracking-tight">Generated Content</h3>
                <button 
                  onClick={() => { setStory(null); setRepoUrl(''); }}
                  className="text-sm text-white/40 hover:text-white transition-colors"
                >
                  Analyze New Repo
                </button>
              </div>

              {/* Narrative Card */}
              <section className="bg-[#141414] border border-white/10 rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-4 text-emerald-500">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">The Narrative</span>
                </div>
                <textarea 
                  className="w-full bg-transparent border-none focus:ring-0 text-lg leading-relaxed text-white/90 italic resize-none"
                  rows={3}
                  value={story.narrative}
                  onChange={(e) => setStory({ ...story, narrative: e.target.value })}
                />
              </section>

              {/* Social Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Twitter */}
                <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                    <button 
                      onClick={() => copyToClipboard(story.tweet, 'tweet')}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
                    >
                      {copied === 'tweet' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <textarea 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-white/80 flex-1 resize-none"
                    rows={4}
                    value={story.tweet}
                    onChange={(e) => setStory({ ...story, tweet: e.target.value })}
                  />
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30 font-mono uppercase tracking-widest">
                    <span>X / Twitter Post</span>
                    <span className={story.tweet.length > 280 ? 'text-red-400' : ''}>{story.tweet.length} / 280</span>
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                    <button 
                      onClick={() => copyToClipboard(story.linkedin, 'linkedin')}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
                    >
                      {copied === 'linkedin' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <textarea 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-white/80 flex-1 resize-none"
                    rows={6}
                    value={story.linkedin}
                    onChange={(e) => setStory({ ...story, linkedin: e.target.value })}
                  />
                  <div className="mt-4 pt-4 border-t border-white/5 text-[10px] text-white/30 font-mono uppercase tracking-widest">
                    LinkedIn Update
                  </div>
                </div>
              </div>

              {/* Blog Draft */}
              <section className="bg-[#141414] border border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold">Developer Blog Draft</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {githubUser ? (
                      <button 
                        onClick={handlePushToGitHub}
                        disabled={pushing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors text-xs font-bold"
                      >
                        {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {pushing ? 'Pushing...' : 'Push to GitHub'}
                      </button>
                    ) : (
                      <button 
                        onClick={handleConnectGitHub}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs font-medium"
                      >
                        <Github className="w-3 h-3" /> Connect to Push
                      </button>
                    )}
                    <button 
                      onClick={() => copyToClipboard(story.blogDraft, 'blog')}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs font-medium"
                    >
                      {copied === 'blog' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copied === 'blog' ? 'Copied' : 'Copy Markdown'}
                    </button>
                  </div>
                </div>
                
                {pushSuccess && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-emerald-500 font-medium">Successfully pushed to GitHub!</span>
                    <a href={pushSuccess} target="_blank" rel="noreferrer" className="text-xs text-emerald-500 underline flex items-center gap-1">
                      View File <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {error && error.includes("GitHub") && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                    {error}
                  </div>
                )}

                <textarea 
                  className="w-full bg-black/30 p-6 rounded-xl border border-white/5 font-mono text-sm text-white/70 focus:ring-1 focus:ring-emerald-500/50 outline-none min-h-[300px] resize-y"
                  value={story.blogDraft}
                  onChange={(e) => setStory({ ...story, blogDraft: e.target.value })}
                />
              </section>

              {/* Weekly Report */}
              <section className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-4 text-emerald-500">
                  <Calendar className="w-5 h-5" />
                  <h3 className="font-bold">Weekly Dev Report</h3>
                </div>
                <textarea 
                  className="w-full bg-transparent border-none focus:ring-0 text-white/80 leading-relaxed resize-none"
                  rows={5}
                  value={story.weeklySummary}
                  onChange={(e) => setStory({ ...story, weeklySummary: e.target.value })}
                />
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Floating Chat Box */}
      {story && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6">
          <form onSubmit={handleRefine} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center bg-[#1A1A1A] rounded-xl border border-white/20 p-2 shadow-2xl backdrop-blur-xl">
              <input 
                type="text" 
                placeholder="Ask AI to refine your story... (e.g. 'Make it more professional', 'Add more emojis')"
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-white placeholder:text-white/30"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={refining}
              />
              <button 
                type="submit"
                disabled={refining || !chatInput}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/20 text-black font-bold px-6 py-3 rounded-lg transition-all flex items-center gap-2 min-w-[100px] justify-center"
              >
                {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refine'}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="relative z-10 border-t border-white/10 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-white/20 text-sm">
            Powered by Google Gemini & GitHub API. Built for the Hackathon.
          </p>
        </div>
      </footer>
    </div>
  );
}
