#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CodebaseAnalysis {
  projectPath: string;
  phase: 'conceptual' | 'structural' | 'analysis' | 'synthesis';
  findings: string;
  nextPhaseNeeded: boolean;
  timestamp: string;
}

class CodebaseNavigatorServer {
  private analysisHistory: CodebaseAnalysis[] = [];
  private disableAnalysisLogging: boolean;

  constructor() {
    this.disableAnalysisLogging = (process.env.DISABLE_ANALYSIS_LOGGING || "").toLowerCase() === "true";
  }

  private async findKeyDocs(projectPath: string): Promise<string[]> {
    const keyPatterns = [
      /^readme\.md$/i,
      /^architecture\.md$/i,
      /^planning\.md$/i,
      /^design\.md$/i,
      /^prd\.md$/i,
      /^contributing\.md$/i,
      /^agents\.md$/i,
      /^tasks\.md$/i,
      /copilot-instructions\.md$/i,
      /claude\.md$/i
    ];

    const keyDocs: string[] = [];
    
    try {
      const scanDir = (dir: string, depth: number = 0): void => {
        if (depth > 2) return; // Limit depth
        
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(item)) {
            scanDir(itemPath, depth + 1);
          } else if (stat.isFile() && item.endsWith('.md')) {
            if (keyPatterns.some(pattern => pattern.test(item))) {
              keyDocs.push(itemPath);
            }
          }
        }
      };
      
      scanDir(projectPath);
    } catch (error) {
      // Handle error silently
    }
    
    return keyDocs;
  }

  private async findRepositoryRoot(startPath: string): Promise<string> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;
    
    // Repository indicators in order of priority
    const repositoryMarkers = [
      '.git',           // Git repository
      'package.json',   // Node.js project root
      'pyproject.toml', // Python project
      'Cargo.toml',     // Rust project
      'pom.xml',        // Java Maven project
      'build.gradle',   // Java Gradle project
      'go.mod',         // Go module
      'composer.json',  // PHP project
      'Gemfile',        // Ruby project
      '.gitignore',     // Often indicates project root
      'README.md'       // Common in project roots
    ];
    
    while (currentPath !== rootPath) {
      // Check for repository markers
      for (const marker of repositoryMarkers) {
        const markerPath = path.join(currentPath, marker);
        if (fs.existsSync(markerPath)) {
          return currentPath;
        }
      }
      
      // Move up one directory
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) break; // Reached root
      currentPath = parentPath;
    }
    
    // If no repository root found, return the original path
    return startPath;
  }


  private async getProjectStructure(projectPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `cd "${projectPath}" && tree -I 'node_modules|__pycache__|dist|build|.git' -L 3 || find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.java" | head -20`
      );
      return stdout;
    } catch (error) {
      return "Unable to generate project structure";
    }
  }

  private async analyzeCodeFiles(projectPath: string): Promise<{
    dependencies: string[];
    entryPoints: string[];
    patterns: string[];
  }> {
    const analysis = {
      dependencies: [] as string[],
      entryPoints: [] as string[],
      patterns: [] as string[]
    };

    try {
      const codeFiles = this.findCodeFiles(projectPath);
      
      for (const filePath of codeFiles.slice(0, 20)) { // Limit analysis
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectPath, filePath);
        
        // Find dependencies
        const imports = this.extractImports(content, path.extname(filePath));
        analysis.dependencies.push(...imports);
        
        // Identify entry points
        if (this.isEntryPoint(content, relativePath)) {
          analysis.entryPoints.push(relativePath);
        }
        
        // Detect patterns
        const filePatterns = this.detectPatterns(content, relativePath);
        analysis.patterns.push(...filePatterns);
      }
      
      // Remove duplicates
      analysis.dependencies = [...new Set(analysis.dependencies)];
      analysis.entryPoints = [...new Set(analysis.entryPoints)];
      analysis.patterns = [...new Set(analysis.patterns)];
      
    } catch (error) {
      // Handle error silently
    }
    
    return analysis;
  }

  private findCodeFiles(projectPath: string): string[] {
    const codeFiles: string[] = [];
    const extensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs'];
    
    const walkDir = (dir: string, depth: number = 0): void => {
      if (depth > 4) return; // Limit depth
      
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(item)) {
            walkDir(itemPath, depth + 1);
          } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
            codeFiles.push(itemPath);
          }
        }
      } catch (error) {
        // Handle error silently
      }
    };
    
    walkDir(projectPath);
    return codeFiles;
  }

  private extractImports(content: string, extension: string): string[] {
    const imports: string[] = [];
    
    switch (extension) {
      case '.js':
      case '.ts':
        // ES6 imports and require statements
        const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g) || [];
        const requireMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g) || [];
        
        importMatches.forEach(match => {
          const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
          if (moduleMatch) imports.push(moduleMatch[1]);
        });
        
        requireMatches.forEach(match => {
          const moduleMatch = match.match(/require\(['"`]([^'"`]+)['"`]\)/);
          if (moduleMatch) imports.push(moduleMatch[1]);
        });
        break;
        
      case '.py':
        const pythonImports = content.match(/(?:from\s+(\S+)\s+import|import\s+(\S+))/g) || [];
        pythonImports.forEach(match => {
          const moduleMatch = match.match(/(?:from\s+(\S+)\s+import|import\s+(\S+))/);
          if (moduleMatch) imports.push(moduleMatch[1] || moduleMatch[2]);
        });
        break;
    }
    
    return imports.filter(imp => imp && !imp.startsWith('.'));
  }

  private isEntryPoint(content: string, filePath: string): boolean {
    const entryPatterns = [
      /main\s*\(/,
      /if\s+__name__\s*==\s*['"]__main__['"]/,
      /express\(\)/,
      /createApp\(/,
      /ReactDOM\.render/,
      /new\s+Server\(/
    ];
    
    const isMainFile = ['index', 'main', 'app', 'server'].some(name => 
      filePath.toLowerCase().includes(name)
    );
    
    const hasEntryPattern = entryPatterns.some(pattern => pattern.test(content));
    
    return isMainFile || hasEntryPattern;
  }

  private detectPatterns(content: string, filePath: string): string[] {
    const patterns: string[] = [];
    
    // Detect common patterns
    if (/class\s+\w+.*{/.test(content)) patterns.push('OOP/Classes');
    if (/function\s+\w+|const\s+\w+\s*=.*=>/.test(content)) patterns.push('Functions');
    if (/export\s+(default\s+)?/.test(content)) patterns.push('ES6 Modules');
    if (/\.then\(|async\s+|await\s+/.test(content)) patterns.push('Async/Promises');
    if (/React\.|useState|useEffect/.test(content)) patterns.push('React');
    if (/express\(\)|app\.get|app\.post/.test(content)) patterns.push('Express.js');
    if (/SELECT|INSERT|UPDATE|DELETE/i.test(content)) patterns.push('SQL/Database');
    if (/test\(|describe\(|it\(/.test(content)) patterns.push('Testing');
    
    return patterns;
  }

  private formatAnalysis(analysis: CodebaseAnalysis): string {
    const phaseColors = {
      conceptual: chalk.blue,
      structural: chalk.green,
      analysis: chalk.yellow,
      synthesis: chalk.magenta
    };
    
    const phaseIcons = {
      conceptual: '📚',
      structural: '🏗️',
      analysis: '🔍',
      synthesis: '📊'
    };
    
    const color = phaseColors[analysis.phase];
    const icon = phaseIcons[analysis.phase];
    
    const header = `${icon} Phase ${analysis.phase.charAt(0).toUpperCase() + analysis.phase.slice(1)}`;
    const border = '═'.repeat(Math.max(header.length, 50));
    
    return color(`
╔${border}╗
║ ${header.padEnd(border.length - 2)} ║
╠${border}╣
║ Project: ${path.basename(analysis.projectPath).padEnd(border.length - 12)} ║
║ Time: ${analysis.timestamp.padEnd(border.length - 9)} ║
╚${border}╝

${analysis.findings}
`);
  }

public async processCodebaseAnalysis(input: unknown): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const data = input as Record<string, unknown>;
    const providedPath = data.projectPath as string;
    const phase = (data.phase as string) || 'conceptual';

    if (!providedPath || !fs.existsSync(providedPath)) {
      throw new Error('Invalid or non-existent project path');
    }

    // 🔥 AUTO-DETECT REPOSITORY ROOT
    const repositoryRoot = await this.findRepositoryRoot(providedPath);
    const projectPath = repositoryRoot;

    // Log the detection for transparency
    if (repositoryRoot !== providedPath) {
      console.error(chalk.cyan(`📁 Auto-detected repository root: ${repositoryRoot}`));
      console.error(chalk.gray(`   (from provided path: ${providedPath})`));
    }

    let findings = '';
    let nextPhaseNeeded = true;

    switch (phase) {
      case 'conceptual':
        const keyDocs = await this.findKeyDocs(projectPath);
        findings = await this.processPhase1(projectPath, keyDocs);
        break;

      case 'structural':
        const structure = await this.getProjectStructure(projectPath);
        findings = await this.processPhase2(projectPath, structure);
        break;

      case 'analysis':
        const codeAnalysis = await this.analyzeCodeFiles(projectPath);
        findings = await this.processPhase3(projectPath, codeAnalysis);
        break;

      case 'synthesis':
        findings = await this.processPhase4(projectPath);
        nextPhaseNeeded = false;
        break;

      default:
        throw new Error(`Invalid phase: ${phase}`);
    }

    const analysis: CodebaseAnalysis = {
      projectPath,
      phase: phase as any,
      findings,
      nextPhaseNeeded,
      timestamp: new Date().toISOString()
    };

    this.analysisHistory.push(analysis);

    if (!this.disableAnalysisLogging) {
      const formattedAnalysis = this.formatAnalysis(analysis);
      console.error(formattedAnalysis);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          phase,
          projectPath,
          repositoryRoot: repositoryRoot !== providedPath ? repositoryRoot : undefined,
          providedPath: repositoryRoot !== providedPath ? providedPath : undefined,
          findings,
          nextPhaseNeeded,
          analysisHistoryLength: this.analysisHistory.length,
          suggestedNextPhase: this.getSuggestedNextPhase(phase)
        }, null, 2)
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          status: 'failed'
        }, null, 2)
      }],
      isError: true
    };
  }
}


  private async processPhase1(projectPath: string, keyDocs: string[]): Promise<string> {
    let analysis = "## Phase 1: Conceptual Understanding\n\n";
    
    analysis += `**Key Documents Found:** ${keyDocs.length}\n`;
    
    if (keyDocs.length > 0) {
      analysis += "\n**Document Analysis:**\n";
      for (const docPath of keyDocs.slice(0, 5)) { // Limit to first 5 docs
        const docName = path.basename(docPath);
        try {
          const content = fs.readFileSync(docPath, 'utf-8');
          const summary = this.summarizeDocument(content, docName);
          analysis += `- **${docName}**: ${summary}\n`;
        } catch (error) {
          analysis += `- **${docName}**: Could not read file\n`;
        }
      }
      
      analysis += "\n**Project Understanding:**\n";
      analysis += "- Project appears to have structured documentation\n";
      analysis += "- Key architectural decisions likely documented\n";
      analysis += "- Development guidelines and processes defined\n";
    } else {
      analysis += "\n**Note:** No key documentation files found. Project may lack comprehensive documentation.\n";
    }
    
    return analysis;
  }

  private async processPhase2(projectPath: string, structure: string): Promise<string> {
    let analysis = "## Phase 2: Structural Scaffolding\n\n";
    
    analysis += "**Project Structure:**\n";
    analysis += "``````\n\n";
    
    analysis += "**Structural Insights:**\n";
    
    // Analyze structure patterns
    if (structure.includes('src/')) {
      analysis += "- Standard source code organization with `src/` directory\n";
    }
    if (structure.includes('package.json')) {
      analysis += "- Node.js/JavaScript project with npm package management\n";
    }
    if (structure.includes('requirements.txt') || structure.includes('.py')) {
      analysis += "- Python project detected\n";
    }
    if (structure.includes('Cargo.toml')) {
      analysis += "- Rust project detected\n";
    }
    if (structure.includes('pom.xml') || structure.includes('build.gradle')) {
      analysis += "- Java project with build system\n";
    }
    
    return analysis;
  }

  private async processPhase3(projectPath: string, codeAnalysis: {
    dependencies: string[];
    entryPoints: string[];
    patterns: string[];
  }): Promise<string> {
    let analysis = "## Phase 3: In-Depth Code Analysis\n\n";
    
    analysis += "**Dependencies & Imports:**\n";
    if (codeAnalysis.dependencies.length > 0) {
      codeAnalysis.dependencies.slice(0, 10).forEach((dep: string) => {
        analysis += `- ${dep}\n`;
      });
      if (codeAnalysis.dependencies.length > 10) {
        analysis += `- ... and ${codeAnalysis.dependencies.length - 10} more\n`;
      }
    } else {
      analysis += "- No external dependencies detected\n";
    }
    
    analysis += "\n**Entry Points:**\n";
    if (codeAnalysis.entryPoints.length > 0) {
      codeAnalysis.entryPoints.forEach((entry: string) => {
        analysis += `- ${entry}\n`;
      });
    } else {
      analysis += "- No clear entry points identified\n";
    }
    
    analysis += "\n**Detected Patterns:**\n";
    if (codeAnalysis.patterns.length > 0) {
      [...new Set(codeAnalysis.patterns)].forEach((pattern) => {
        analysis += `- ${pattern}\n`;
      });
    } else {
      analysis += "- No specific patterns detected\n";
    }
    
    return analysis;
  }

  private async processPhase4(projectPath: string): Promise<string> {
    let analysis = "## Phase 4: Synthesis and Reporting\n\n";
    
    analysis += "**Project Summary:**\n";
    analysis += `- **Project**: ${path.basename(projectPath)}\n`;
    analysis += `- **Analysis Phases Completed**: ${this.analysisHistory.length}\n`;
    
    const recentAnalyses = this.analysisHistory.slice(-3);
    
    analysis += "\n**Key Findings:**\n";
    recentAnalyses.forEach(a => {
      analysis += `- **${a.phase.charAt(0).toUpperCase() + a.phase.slice(1)} Phase**: Completed successfully\n`;
    });
    
    analysis += "\n**Recommendations for New Developers:**\n";
    analysis += "- Start by reviewing the key documentation files identified\n";
    analysis += "- Understand the project structure before diving into code\n";
    analysis += "- Focus on entry points to understand application flow\n";
    analysis += "- Pay attention to the architectural patterns in use\n";
    
    analysis += "\n**Next Steps:**\n";
    analysis += "- Set up development environment according to project requirements\n";
    analysis += "- Run the application and explore its functionality\n";
    analysis += "- Identify areas for contribution or improvement\n";
    
    return analysis;
  }

  private summarizeDocument(content: string, filename: string): string {
    const lines = content.split('\n').slice(0, 10);
    const firstParagraph = lines.find(line => line.trim().length > 20) || lines[0] || '';
    return firstParagraph.trim().slice(0, 100) + (firstParagraph.length > 100 ? '...' : '');
  }

  private getSuggestedNextPhase(currentPhase: string): string {
    const phaseOrder = ['conceptual', 'structural', 'analysis', 'synthesis'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return currentIndex < phaseOrder.length - 1 ? phaseOrder[currentIndex + 1] : 'complete';
  }
}

const CODEBASE_NAVIGATOR_TOOL: Tool = {
  name: "analyze_codebase",
  description: `A comprehensive codebase analysis tool that follows a systematic 4-phase approach for understanding any software project.

This tool helps developers quickly gain deep insights into unfamiliar codebases through structured analysis:

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

Each phase builds upon the previous one to create comprehensive understanding suitable for developers new to the project.`,
  inputSchema: {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "Absolute path to the project root directory to analyze"
      },
      phase: {
        type: "string",
        enum: ["conceptual", "structural", "analysis", "synthesis"],
        description: "Analysis phase to execute (defaults to 'conceptual')"
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
