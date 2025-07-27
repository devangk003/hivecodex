import { X } from "lucide-react";

interface TabItem {
  name: string;
  type: string;
  active?: boolean;
}

const tabs: TabItem[] = [
  { name: "bot.py", type: "py", active: true },
  { name: ".env", type: "env" },
  { name: "App.js", type: "js" },
  { name: "routes.tsx", type: "tsx" },
  { name: "server.js", type: "js" },
];

const codeContent = `from discord.ext import commands

bot = commands.Bot(":")

@bot.command("ping")
async def ping(ctx: commands.Context):
    await ctx.

bot.run("TOKEN")`;

export const CodeEditor = () => {
  return (
    <div className="flex-1 bg-discord-editor flex flex-col">
      {/* Tabs */}
      <div className="flex bg-discord-sidebar border-b border-border">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-border cursor-pointer transition-colors ${
              tab.active
                ? "bg-discord-editor text-foreground"
                : "bg-discord-sidebar text-muted-foreground hover:bg-discord-sidebar-hover"
            }`}
          >
            <span>{tab.name}</span>
            <X className="w-3 h-3 opacity-50 hover:opacity-100" />
          </div>
        ))}
      </div>

      {/* Editor Header */}
      <div className="px-4 py-2 bg-discord-editor border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>README.md - API Docs - Diamond</span>
        </div>
      </div>

      {/* Code Content */}
      <div className="flex-1 p-4 bg-discord-code font-mono text-sm overflow-auto custom-scrollbar">
        <div className="space-y-1">
          {codeContent.split("\n").map((line, index) => (
            <div key={index} className="flex">
              <span className="text-muted-foreground mr-6 select-none w-6 text-right">
                {index + 1}
              </span>
              <div className="flex-1">
                {line.includes("from") && (
                  <span className="text-pink-400">from</span>
                )}
                {line.includes("import") && (
                  <span className="text-pink-400"> import</span>
                )}
                {line.includes("discord.ext") && (
                  <span className="text-green-400"> discord.ext</span>
                )}
                {line.includes("commands") && (
                  <span className="text-blue-400"> commands</span>
                )}

                {line.includes("bot =") && (
                  <>
                    <span className="text-blue-300">bot</span>
                    <span className="text-foreground"> = </span>
                    <span className="text-blue-400">commands</span>
                    <span className="text-foreground">.</span>
                    <span className="text-yellow-300">Bot</span>
                    <span className="text-foreground">(</span>
                    <span className="text-green-400">":"</span>
                    <span className="text-foreground">)</span>
                  </>
                )}

                {line.includes("@bot.command") && (
                  <>
                    <span className="text-yellow-300">@bot.command</span>
                    <span className="text-foreground">(</span>
                    <span className="text-green-400">"ping"</span>
                    <span className="text-foreground">)</span>
                  </>
                )}

                {line.includes("async def") && (
                  <>
                    <span className="text-pink-400">async def</span>
                    <span className="text-blue-300"> ping</span>
                    <span className="text-foreground">(</span>
                    <span className="text-blue-300">ctx</span>
                    <span className="text-foreground">: </span>
                    <span className="text-blue-400">commands</span>
                    <span className="text-foreground">.</span>
                    <span className="text-yellow-300">Context</span>
                    <span className="text-foreground">):</span>
                  </>
                )}

                {line.includes("await ctx.") && (
                  <>
                    <span className="text-foreground"> </span>
                    <span className="text-pink-400">await</span>
                    <span className="text-blue-300"> ctx</span>
                    <span className="text-foreground">.</span>
                  </>
                )}

                {line.includes("bot.run") && (
                  <>
                    <span className="text-blue-300">bot</span>
                    <span className="text-foreground">.</span>
                    <span className="text-yellow-300">run</span>
                    <span className="text-foreground">(</span>
                    <span className="text-green-400">"TOKEN"</span>
                    <span className="text-foreground">)</span>
                  </>
                )}

                {!line.includes("from") &&
                  !line.includes("bot") &&
                  !line.includes("@") &&
                  !line.includes("async") &&
                  !line.includes("await") &&
                  line.trim() && (
                    <span className="text-foreground">{line}</span>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
