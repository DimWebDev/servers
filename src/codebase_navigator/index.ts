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
    codeStructure: any;
    functionsAndClasses: any[];
    fileContents: any[];
    architecture: string[];
  }> {
    const analysis = {
      dependencies: [] as string[],
      entryPoints: [] as string[],
      patterns: [] as string[],
      codeStructure: {} as any,
      functionsAndClasses: [] as any[],
      fileContents: [] as any[],
      architecture: [] as string[]
    };

    try {
      const codeFiles = this.findCodeFiles(projectPath);
      console.error(chalk.cyan(`🔍 Analyzing ${codeFiles.length} code files...`));
      
      // Analyze ALL files, not just 20
      for (const filePath of codeFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectPath, filePath);
        const fileSize = content.length;
        const lineCount = content.split('\n').length;
        
        console.error(chalk.gray(`  📄 Analyzing ${relativePath} (${lineCount} lines, ${fileSize} chars)`));
        
        // Store full file content for comprehensive analysis
        analysis.fileContents.push({
          path: relativePath,
          content: content,
          size: fileSize,
          lines: lineCount,
          extension: path.extname(filePath)
        });
        
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
        
        // Extract functions and classes with detailed info
        const codeElements = this.extractCodeElements(content, relativePath);
        analysis.functionsAndClasses.push(...codeElements);
        
        // Analyze file architecture
        const archPatterns = this.analyzeArchitecture(content, relativePath);
        analysis.architecture.push(...archPatterns);
      }
      
      // Build code structure map
      analysis.codeStructure = this.buildCodeStructureMap(analysis.fileContents);
      
      // Remove duplicates
      analysis.dependencies = [...new Set(analysis.dependencies)];
      analysis.entryPoints = [...new Set(analysis.entryPoints)];
      analysis.patterns = [...new Set(analysis.patterns)];
      analysis.architecture = [...new Set(analysis.architecture)];
      
    } catch (error) {
      console.error(chalk.red(`Error during code analysis: ${error}`));
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

  private extractCodeElements(content: string, filePath: string): any[] {
    const elements: any[] = [];
    
    // Extract classes
    const classMatches = content.match(/class\s+(\w+)[\s\S]*?{([\s\S]*?)^}/gm) || [];
    classMatches.forEach((match, index) => {
      const nameMatch = match.match(/class\s+(\w+)/);
      if (nameMatch) {
        const className = nameMatch[1];
        const methods = (match.match(/^\s*(public|private|protected)?\s*(\w+)\s*\(/gm) || [])
          .map(m => m.trim().replace(/[()]/g, ''));
        
        elements.push({
          type: 'class',
          name: className,
          file: filePath,
          methods: methods,
          lineEstimate: index * 50 // rough estimate
        });
      }
    });
    
    // Extract standalone functions
    const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
    functionMatches.forEach(match => {
      const nameMatch = match.match(/function\s+(\w+)/);
      if (nameMatch) {
        elements.push({
          type: 'function',
          name: nameMatch[1],
          file: filePath,
          isAsync: match.includes('async'),
          isExported: match.includes('export')
        });
      }
    });
    
    // Extract arrow functions assigned to const/let
    const arrowFunctionMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g) || [];
    arrowFunctionMatches.forEach(match => {
      const nameMatch = match.match(/const\s+(\w+)/);
      if (nameMatch) {
        elements.push({
          type: 'arrow_function',
          name: nameMatch[1],
          file: filePath,
          isAsync: match.includes('async'),
          isExported: match.includes('export')
        });
      }
    });
    
    // Extract interfaces and types (TypeScript)
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const interfaceMatches = content.match(/(?:export\s+)?interface\s+(\w+)/g) || [];
      interfaceMatches.forEach(match => {
        const nameMatch = match.match(/interface\s+(\w+)/);
        if (nameMatch) {
          elements.push({
            type: 'interface',
            name: nameMatch[1],
            file: filePath,
            isExported: match.includes('export')
          });
        }
      });
      
      const typeMatches = content.match(/(?:export\s+)?type\s+(\w+)/g) || [];
      typeMatches.forEach(match => {
        const nameMatch = match.match(/type\s+(\w+)/);
        if (nameMatch) {
          elements.push({
            type: 'type',
            name: nameMatch[1],
            file: filePath,
            isExported: match.includes('export')
          });
        }
      });
    }
    
    return elements;
  }

  private analyzeArchitecture(content: string, filePath: string): string[] {
    const patterns: string[] = [];
    
    // Detect architectural patterns
    if (/server\s*=\s*new\s+Server|createServer|express\(\)/.test(content)) {
      patterns.push('Server Architecture');
    }
    if (/router\.|Router\(|app\.use/.test(content)) {
      patterns.push('Routing Pattern');
    }
    if (/middleware|app\.use\(/.test(content)) {
      patterns.push('Middleware Pattern');
    }
    if (/class\s+\w+.*Controller|Controller.*{/.test(content)) {
      patterns.push('Controller Pattern');
    }
    if (/class\s+\w+.*Service|Service.*{/.test(content)) {
      patterns.push('Service Layer Pattern');
    }
    if (/class\s+\w+.*Repository|Repository.*{/.test(content)) {
      patterns.push('Repository Pattern');
    }
    if (/Observable|Subject|pipe\(/.test(content)) {
      patterns.push('Reactive Programming');
    }
    if (/useState|useEffect|useContext/.test(content)) {
      patterns.push('React Hooks Pattern');
    }
    if (/try\s*{[\s\S]*catch\s*\(/.test(content)) {
      patterns.push('Error Handling');
    }
    if (/logger\.|console\.|log\(/.test(content)) {
      patterns.push('Logging');
    }
    if (/process\.env|config\.|Config/.test(content)) {
      patterns.push('Configuration Management');
    }
    if (/Tool\[\]|tools:|setRequestHandler/.test(content)) {
      patterns.push('MCP Server Pattern');
    }
    
    return patterns;
  }

  private buildCodeStructureMap(fileContents: any[]): any {
    const structure = {
      totalFiles: fileContents.length,
      totalLines: fileContents.reduce((sum, file) => sum + file.lines, 0),
      totalSize: fileContents.reduce((sum, file) => sum + file.size, 0),
      filesByExtension: {} as any,
      largestFiles: [] as any[],
      complexity: 'unknown'
    };
    
    // Group by extension
    fileContents.forEach(file => {
      const ext = file.extension || 'no-extension';
      if (!structure.filesByExtension[ext]) {
        structure.filesByExtension[ext] = { count: 0, totalLines: 0 };
      }
      structure.filesByExtension[ext].count++;
      structure.filesByExtension[ext].totalLines += file.lines;
    });
    
    // Find largest files
    structure.largestFiles = fileContents
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 5)
      .map(file => ({
        path: file.path,
        lines: file.lines,
        size: file.size
      }));
    
    // Determine complexity
    if (structure.totalLines > 5000) {
      structure.complexity = 'High';
    } else if (structure.totalLines > 1000) {
      structure.complexity = 'Medium';
    } else {
      structure.complexity = 'Low';
    }
    
    return structure;
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
    const requestedPhase = (data.phase as string) || 'all';

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

    // If a specific phase is requested, run only that phase
    if (requestedPhase !== 'all') {
      return this.runSinglePhase(projectPath, requestedPhase, repositoryRoot !== providedPath ? repositoryRoot : undefined, repositoryRoot !== providedPath ? providedPath : undefined);
    }

    // Run all phases sequentially for comprehensive analysis
    const allPhases = ['conceptual', 'structural', 'analysis', 'synthesis'];
    let comprehensiveReport = '';
    
    console.error(chalk.blue('🚀 Starting comprehensive codebase analysis...'));
    
    for (const phase of allPhases) {
      console.error(chalk.yellow(`📋 Running ${phase} phase...`));
      
      let phaseFindings = '';
      
      switch (phase) {
        case 'conceptual':
          const keyDocs = await this.findKeyDocs(projectPath);
          phaseFindings = await this.processPhase1(projectPath, keyDocs);
          break;

        case 'structural':
          const structure = await this.getProjectStructure(projectPath);
          phaseFindings = await this.processPhase2(projectPath, structure);
          break;

        case 'analysis':
          const codeAnalysis = await this.analyzeCodeFiles(projectPath);
          phaseFindings = await this.processPhase3(projectPath, codeAnalysis);
          break;

        case 'synthesis':
          phaseFindings = await this.processPhase4(projectPath);
          break;
      }

      const analysis: CodebaseAnalysis = {
        projectPath,
        phase: phase as any,
        findings: phaseFindings,
        nextPhaseNeeded: phase !== 'synthesis',
        timestamp: new Date().toISOString()
      };

      this.analysisHistory.push(analysis);
      comprehensiveReport += phaseFindings + '\n\n';

      if (!this.disableAnalysisLogging) {
        const formattedAnalysis = this.formatAnalysis(analysis);
        console.error(formattedAnalysis);
      }
    }

    // Generate final comprehensive report
    const finalReport = await this.generateComprehensiveReport(projectPath, comprehensiveReport);
    
    console.error(chalk.green('✅ Comprehensive analysis complete!'));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          phase: 'comprehensive',
          projectPath,
          repositoryRoot: repositoryRoot !== providedPath ? repositoryRoot : undefined,
          providedPath: repositoryRoot !== providedPath ? providedPath : undefined,
          findings: finalReport,
          nextPhaseNeeded: false,
          analysisHistoryLength: this.analysisHistory.length,
          completedPhases: allPhases
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

private async runSinglePhase(projectPath: string, phase: string, repositoryRoot?: string, providedPath?: string): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
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
        repositoryRoot,
        providedPath,
        findings,
        nextPhaseNeeded,
        analysisHistoryLength: this.analysisHistory.length,
        suggestedNextPhase: this.getSuggestedNextPhase(phase)
      }, null, 2)
    }]
  };
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
    analysis += "```\n";
    analysis += structure;  
    analysis += "\n```\n\n";
    
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
    codeStructure: any;
    functionsAndClasses: any[];
    fileContents: any[];
    architecture: string[];
  }): Promise<string> {
    let analysis = "## Phase 3: In-Depth Code Analysis\n\n";
    
    // Code Structure Overview
    analysis += "**📊 Code Structure Overview:**\n";
    analysis += `- **Total Files:** ${codeAnalysis.codeStructure.totalFiles}\n`;
    analysis += `- **Total Lines of Code:** ${codeAnalysis.codeStructure.totalLines.toLocaleString()}\n`;
    analysis += `- **Total Size:** ${(codeAnalysis.codeStructure.totalSize / 1024).toFixed(1)} KB\n`;
    analysis += `- **Complexity Level:** ${codeAnalysis.codeStructure.complexity}\n\n`;
    
    // File breakdown by extension
    analysis += "**📁 Files by Type:**\n";
    Object.entries(codeAnalysis.codeStructure.filesByExtension).forEach(([ext, data]: [string, any]) => {
      analysis += `- **${ext}**: ${data.count} files, ${data.totalLines} lines\n`;
    });
    analysis += "\n";
    
    // Largest files
    if (codeAnalysis.codeStructure.largestFiles.length > 0) {
      analysis += "**📋 Largest Files:**\n";
      codeAnalysis.codeStructure.largestFiles.forEach((file: any) => {
        analysis += `- **${file.path}**: ${file.lines} lines (${(file.size / 1024).toFixed(1)} KB)\n`;
      });
      analysis += "\n";
    }
    
    // Dependencies & Imports
    analysis += "**🔗 Dependencies & Imports:**\n";
    if (codeAnalysis.dependencies.length > 0) {
      const externalDeps = codeAnalysis.dependencies.filter(dep => !dep.startsWith('.'));
      const internalDeps = codeAnalysis.dependencies.filter(dep => dep.startsWith('.'));
      
      if (externalDeps.length > 0) {
        analysis += "*External Dependencies:*\n";
        externalDeps.slice(0, 15).forEach((dep: string) => {
          analysis += `- ${dep}\n`;
        });
        if (externalDeps.length > 15) {
          analysis += `- ... and ${externalDeps.length - 15} more external dependencies\n`;
        }
      }
      
      if (internalDeps.length > 0) {
        analysis += "*Internal Imports:*\n";
        internalDeps.slice(0, 10).forEach((dep: string) => {
          analysis += `- ${dep}\n`;
        });
        if (internalDeps.length > 10) {
          analysis += `- ... and ${internalDeps.length - 10} more internal imports\n`;
        }
      }
    } else {
      analysis += "- No external dependencies detected\n";
    }
    analysis += "\n";
    
    // Entry Points
    analysis += "**🚪 Entry Points:**\n";
    if (codeAnalysis.entryPoints.length > 0) {
      codeAnalysis.entryPoints.forEach((entry: string) => {
        analysis += `- **${entry}**\n`;
      });
    } else {
      analysis += "- No clear entry points identified\n";
    }
    analysis += "\n";
    
    // Code Elements (Functions, Classes, etc.)
    analysis += "**⚙️ Code Elements Detected:**\n";
    if (codeAnalysis.functionsAndClasses.length > 0) {
      const elementsByType = codeAnalysis.functionsAndClasses.reduce((acc: any, element: any) => {
        if (!acc[element.type]) acc[element.type] = [];
        acc[element.type].push(element);
        return acc;
      }, {});
      
      Object.entries(elementsByType).forEach(([type, elements]: [string, any]) => {
        analysis += `*${type.charAt(0).toUpperCase() + type.slice(1)}s (${elements.length}):*\n`;
        elements.slice(0, 10).forEach((element: any) => {
          let details = `- **${element.name}**`;
          if (element.file) details += ` (${element.file})`;
          if (element.isAsync) details += ` [async]`;
          if (element.isExported) details += ` [exported]`;
          if (element.methods && element.methods.length > 0) {
            details += ` - Methods: ${element.methods.slice(0, 3).join(', ')}`;
            if (element.methods.length > 3) details += `, +${element.methods.length - 3} more`;
          }
          analysis += `${details}\n`;
        });
        if (elements.length > 10) {
          analysis += `- ... and ${elements.length - 10} more ${type}s\n`;
        }
        analysis += "\n";
      });
    } else {
      analysis += "- No code elements detected\n\n";
    }
    
    // Architectural Patterns
    analysis += "**🏗️ Architectural Patterns:**\n";
    if (codeAnalysis.architecture.length > 0) {
      [...new Set(codeAnalysis.architecture)].forEach((pattern) => {
        analysis += `- ${pattern}\n`;
      });
    } else {
      analysis += "- No specific architectural patterns detected\n";
    }
    analysis += "\n";
    
    // Programming Patterns
    analysis += "**🎨 Programming Patterns:**\n";
    if (codeAnalysis.patterns.length > 0) {
      [...new Set(codeAnalysis.patterns)].forEach((pattern) => {
        analysis += `- ${pattern}\n`;
      });
    } else {
      analysis += "- No specific programming patterns detected\n";
    }
    analysis += "\n";
    
    // Detailed File Content Analysis
    if (codeAnalysis.fileContents.length > 0) {
      analysis += "**📄 Detailed File Analysis:**\n";
      codeAnalysis.fileContents.forEach((file: any) => {
        if (file.lines > 50) { // Only detail larger files
          analysis += `*${file.path}* (${file.lines} lines):\n`;
          
          // Get a meaningful excerpt from the file
          const lines = file.content.split('\n');
          const firstMeaningfulLines = lines
            .filter((line: string) => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*'))
            .slice(0, 5);
          
          if (firstMeaningfulLines.length > 0) {
            analysis += `  Preview: ${firstMeaningfulLines[0].trim()}\n`;
            if (firstMeaningfulLines.length > 1) {
              analysis += `           ${firstMeaningfulLines[1].trim()}\n`;
            }
          }
          analysis += "\n";
        }
      });
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

  private async generateComprehensiveReport(projectPath: string, allPhaseFindings: string): Promise<string> {
    let report = `# 📊 COMPREHENSIVE CODEBASE ANALYSIS REPORT\n\n`;
    report += `**Project:** ${path.basename(projectPath)}\n`;
    report += `**Analysis Date:** ${new Date().toISOString().split('T')[0]}\n`;
    report += `**Total Phases Completed:** 4\n\n`;
    
    report += `---\n\n`;
    
    // Include all phase findings
    report += allPhaseFindings;
    
    // Add executive summary
    report += `## 🎯 EXECUTIVE SUMMARY\n\n`;
    
    const conceptualAnalysis = this.analysisHistory.find(a => a.phase === 'conceptual');
    const structuralAnalysis = this.analysisHistory.find(a => a.phase === 'structural');
    const codeAnalysis = this.analysisHistory.find(a => a.phase === 'analysis');
    
    report += `**Project Type:** `;
    if (structuralAnalysis?.findings.includes('Node.js/JavaScript')) {
      report += `Node.js/TypeScript Application\n`;
    } else if (structuralAnalysis?.findings.includes('Python')) {
      report += `Python Application\n`;
    } else if (structuralAnalysis?.findings.includes('Java')) {
      report += `Java Application\n`;
    } else if (structuralAnalysis?.findings.includes('Rust')) {
      report += `Rust Application\n`;
    } else {
      report += `Multi-language or Unknown Type\n`;
    }
    
    report += `**Documentation Quality:** `;
    const hasKeyDocs = conceptualAnalysis?.findings.includes('Key Documents Found:') && 
                     !conceptualAnalysis.findings.includes('Key Documents Found: 0');
    report += hasKeyDocs ? `Well Documented ✅\n` : `Needs Improvement ⚠️\n`;
    
    report += `**Code Organization:** `;
    const hasStructure = structuralAnalysis?.findings.includes('src/') || 
                        structuralAnalysis?.findings.includes('Standard source code organization');
    report += hasStructure ? `Well Organized ✅\n` : `Could Be Improved ⚠️\n`;
    
    report += `**Complexity Level:** `;
    const dependencyCount = (codeAnalysis?.findings.match(/- /g) || []).length;
    if (dependencyCount > 15) {
      report += `High (Many Dependencies) 🔴\n`;
    } else if (dependencyCount > 5) {
      report += `Medium (Moderate Dependencies) 🟡\n`;
    } else {
      report += `Low (Few Dependencies) 🟢\n`;
    }
    
    report += `\n## 🚀 DEVELOPER ONBOARDING GUIDE\n\n`;
    report += `### Quick Start Checklist:\n`;
    report += `- [ ] Clone the repository\n`;
    
    if (structuralAnalysis?.findings.includes('package.json')) {
      report += `- [ ] Run \`npm install\` to install dependencies\n`;
      report += `- [ ] Check \`package.json\` for available scripts\n`;
    } else if (structuralAnalysis?.findings.includes('requirements.txt')) {
      report += `- [ ] Run \`pip install -r requirements.txt\`\n`;
    } else if (structuralAnalysis?.findings.includes('Cargo.toml')) {
      report += `- [ ] Run \`cargo build\` to compile\n`;
    }
    
    const entryPoints = codeAnalysis?.findings.match(/Entry Points:\*\*\n([\s\S]*?)\n\*\*/);
    if (entryPoints && entryPoints[1] && !entryPoints[1].includes('No clear entry points')) {
      report += `- [ ] Start by examining the main entry points identified\n`;
    }
    
    report += `- [ ] Read the key documentation files\n`;
    report += `- [ ] Understand the project structure\n`;
    report += `- [ ] Set up your development environment\n`;
    
    report += `\n## 📈 PROJECT HEALTH INDICATORS\n\n`;
    
    const indicators = [];
    
    if (hasKeyDocs) indicators.push('✅ Good Documentation');
    if (hasStructure) indicators.push('✅ Organized Structure');
    
    const hasTests = codeAnalysis?.findings.includes('Testing');
    if (hasTests) indicators.push('✅ Testing Framework');
    
    const hasAsync = codeAnalysis?.findings.includes('Async/Promises');
    if (hasAsync) indicators.push('✅ Modern Async Patterns');
    
    indicators.forEach(indicator => {
      report += `${indicator}\n`;
    });
    
    // Add warnings
    if (!hasKeyDocs) report += `⚠️ Missing Key Documentation\n`;
    if (!hasStructure) report += `⚠️ Unclear Project Organization\n`;
    if (!hasTests) report += `⚠️ No Testing Framework Detected\n`;
    
    report += `\n## 🔍 DETAILED FINDINGS SUMMARY\n\n`;
    report += `This comprehensive analysis examined your codebase through four systematic phases:\n\n`;
    report += `1. **Conceptual Understanding** - Analyzed documentation and project goals\n`;
    report += `2. **Structural Scaffolding** - Mapped project organization and file structure\n`;
    report += `3. **In-Depth Code Analysis** - Examined dependencies, patterns, and entry points\n`;
    report += `4. **Synthesis & Reporting** - Compiled insights and recommendations\n\n`;
    
    report += `**Total Analysis Time:** ${this.analysisHistory.length} phases completed\n`;
    report += `**Recommendation:** This codebase is ${hasKeyDocs && hasStructure ? 'ready for development' : 'suitable for development with some improvements needed'}\n\n`;
    
    report += `---\n`;
    report += `*Analysis generated by Codebase Navigator v0.1.0*\n`;
    
    return report;
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
