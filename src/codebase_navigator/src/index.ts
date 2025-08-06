#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { CodebaseNavigatorServer } from './server.js';

const CODEBASE_NAVIGATOR_TOOL: Tool = {
  name: "analyze_codebase",
  description: `A comprehensive codebase analysis tool that automatically runs through a systematic 4-phase approach for complete understanding of any software project.

This tool provides deep insights into unfamiliar codebases through structured analysis that runs ALL phases by default:

**Phase 1: Conceptual Understanding**
- Identifies and analyzes key documentation files (README, ARCHITECTURE, etc.)
- Extracts project goals, requirements, and high-level design decisions
- Builds foundational understanding of project purpose and scope

**Phase 2: Structural Scaffolding** 
- Maps the physical layout and organization of the codebase
- Provides tree view of directories and files
- Identifies key structural patterns and conventions

**Phase 3: In-Depth Code Analysis**
- Analyzes dependencies, imports, and module relationships  
- Identifies entry points and data flow patterns
- Detects architectural patterns and coding conventions
- Maps component interactions and communication

**Phase 4: Synthesis and Reporting**
- Combines insights from all phases into actionable intelligence
- Provides recommendations for new developers
- Summarizes key findings and next steps

**COMPREHENSIVE FINAL REPORT**
- Executive summary with project health indicators
- Developer onboarding guide with quick start checklist
- Detailed findings summary with recommendations
- Project type identification and complexity assessment

By default, the tool runs ALL phases automatically and generates a complete analysis report. You can optionally specify a single phase if needed.`,
  inputSchema: {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "Absolute path to the project root directory to analyze"
      },
      phase: {
        type: "string",
        enum: ["conceptual", "structural", "analysis", "synthesis", "all"],
        description: "Analysis phase to execute. Use 'all' (default) for complete analysis, or specify individual phase"
      }
    },
    required: ["projectPath"]
  }
};

const server = new Server(
  {
    name: "codebase-navigator-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const navigatorServer = new CodebaseNavigatorServer();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CODEBASE_NAVIGATOR_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "analyze_codebase") {
    return navigatorServer.processCodebaseAnalysis(request.params.arguments);
  }

  return {
    content: [{
      type: "text",
      text: `Unknown tool: ${request.params.name}`
    }],
    isError: true
  };
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebase Navigator MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
