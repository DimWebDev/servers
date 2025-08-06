import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { CodebaseAnalysis, CodeAnalysisResult } from '../types/index.js';

export function formatAnalysis(analysis: CodebaseAnalysis): string {
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

export function summarizeDocument(content: string, filename: string): string {
  const lines = content.split('\n');
  const firstParagraph = lines.find(line => line.trim().length > 20) || lines[0] || '';
  return firstParagraph.trim().slice(0, 150) + (firstParagraph.length > 150 ? '...' : '');
}

export async function processPhase1(projectPath: string, keyDocs: string[]): Promise<string> {
  let analysis = "# Phase 1: Conceptual Understanding\n\n";
  analysis += "Identifying key conceptual and planning documents for project context.\n\n";
  
  analysis += `**Key Documents Found:** ${keyDocs.length}\n\n`;
  
  if (keyDocs.length > 0) {
    analysis += "**Documentation Files Located:**\n";
    for (const docPath of keyDocs) {
      const docName = path.basename(docPath);
      const relativePath = path.relative(projectPath, docPath);
      analysis += `- **${docName}** (${relativePath})\n`;
    }
    analysis += "\n";
  } else {
    analysis += "**Note:** No key documentation files found in standard locations.\n\n";
  }
  
  return analysis;
}

export async function processPhase2(projectPath: string, structure: string): Promise<string> {
  let analysis = "# Phase 2: Structural Scaffolding\n\n";
  analysis += "High-level overview of the codebase's physical layout (like running `tree` command).\n\n";
  
  analysis += "## Project Structure:\n\n";
  analysis += "```\n";
  analysis += structure;  
  analysis += "\n```\n\n";
  
  analysis += "## Key Observations:\n\n";
  
  // Simple pattern detection
  if (structure.includes('src/')) {
    analysis += "- ✅ Source code organized in `src/` directory\n";
  }
  if (structure.includes('package.json')) {
    analysis += "- 📦 Node.js/JavaScript project detected\n";
  }
  if (structure.includes('requirements.txt') || structure.includes('.py')) {
    analysis += "- � Python project detected\n";
  }
  if (structure.includes('Cargo.toml')) {
    analysis += "- 🦀 Rust project detected\n";
  }
  if (structure.includes('test/') || structure.includes('tests/')) {
    analysis += "- 🧪 Testing directories found\n";
  }
  if (structure.includes('docs/') || structure.includes('documentation/')) {
    analysis += "- � Documentation directory present\n";
  }
  
  return analysis;  
}

export async function processPhase3(projectPath: string, codeAnalysis: CodeAnalysisResult): Promise<string> {
  let analysis = "# Phase 3: In-Depth Code Analysis\n\n";
  analysis += "Focusing on file dependencies, relationships, data flow, and component interactions.\n\n";
  
  // Dependencies & Module Relationships
  analysis += "## 🔗 Dependencies & Module Relationships\n\n";
  if (codeAnalysis.dependencies.length > 0) {
    const externalDeps = codeAnalysis.dependencies.filter(dep => !dep.startsWith('.'));
    const internalDeps = codeAnalysis.dependencies.filter(dep => dep.startsWith('.'));
    
    if (externalDeps.length > 0) {
      analysis += "**External Dependencies:**\n";
      externalDeps.slice(0, 30).forEach((dep: string) => {
        analysis += `- ${dep}\n`;
      });
      if (externalDeps.length > 30) {
        analysis += `- ... and ${externalDeps.length - 30} more\n`;
      }
      analysis += "\n";
    }
    
    if (internalDeps.length > 0) {
      analysis += "**Internal Module Imports:**\n";
      internalDeps.slice(0, 30).forEach((dep: string) => {
        analysis += `- ${dep}\n`;
      });
      if (internalDeps.length > 30) {
        analysis += `- ... and ${internalDeps.length - 30} more\n`;
      }
      analysis += "\n";
    }
  } else {
    analysis += "- No dependencies detected\n\n";
  }
  
  // Entry Points
  analysis += "## 🚪 Entry Points\n\n";
  if (codeAnalysis.entryPoints.length > 0) {
    codeAnalysis.entryPoints.forEach((entry: string) => {
      analysis += `- **${entry}**\n`;
    });
  } else {
    analysis += "- No clear entry points identified\n";
  }
  analysis += "\n";
  
  // Code Elements
  analysis += "## ⚙️ Key Code Elements\n\n";
  if (codeAnalysis.functionsAndClasses.length > 0) {
    const functions = codeAnalysis.functionsAndClasses.filter((el: any) => el.type === 'function');
    const classes = codeAnalysis.functionsAndClasses.filter((el: any) => el.type === 'class');
    
    if (functions.length > 0) {
      analysis += `**Functions (${functions.length}):**\n`;
      functions.slice(0, 30).forEach((func: any) => {
        analysis += `- **${func.name}**${func.file ? ` (${func.file})` : ''}${func.isAsync ? ' [async]' : ''}\n`;
      });
      if (functions.length > 30) analysis += `- ... and ${functions.length - 30} more functions\n`;
      analysis += "\n";
    }
    
    if (classes.length > 0) {
      analysis += `**Classes (${classes.length}):**\n`;
      classes.slice(0, 30).forEach((cls: any) => {
        analysis += `- **${cls.name}**${cls.file ? ` (${cls.file})` : ''}\n`;
      });
      if (classes.length > 30) analysis += `- ... and ${classes.length - 30} more classes\n`;
      analysis += "\n";
    }
  } else {
    analysis += "- No code elements detected\n\n";
  }
  
  // Architectural Patterns
  analysis += "## 🏗️ Architectural Patterns\n\n";
  if (codeAnalysis.architecture.length > 0) {
    [...new Set(codeAnalysis.architecture)].forEach((pattern) => {
      analysis += `- ${pattern}\n`;
    });
  } else {
    analysis += "- No specific patterns detected\n";
  }
  analysis += "\n";
  
  // Basic Code Statistics
  analysis += "## 📊 Code Statistics\n\n";
  analysis += `- **Total Files:** ${codeAnalysis.codeStructure.totalFiles}\n`;
  analysis += `- **Total Lines:** ${codeAnalysis.codeStructure.totalLines.toLocaleString()}\n`;
  analysis += `- **Complexity:** ${codeAnalysis.codeStructure.complexity}\n`;
  
  return analysis;
}

export async function processPhase4(projectPath: string, analysisHistory: CodebaseAnalysis[]): Promise<string> {
  let analysis = "# Phase 4: Synthesis and Reporting\n\n";
  analysis += "Presenting insights for developers new to the project who need to quickly grasp the overall structure and file-to-file connectivity.\n\n";
  
  analysis += "## 📝 Summary for New Developers\n\n";
  analysis += `**Project:** ${path.basename(projectPath)}\n`;
  analysis += `**Analysis completed:** ${analysisHistory.length} phases\n\n`;
  
  analysis += "## 🎯 Key Insights\n\n";
  
  const conceptualAnalysis = analysisHistory.find(a => a.phase === 'conceptual');
  const structuralAnalysis = analysisHistory.find(a => a.phase === 'structural');
  const codeAnalysis = analysisHistory.find(a => a.phase === 'analysis');
  
  // Documentation status
  const hasKeyDocs = conceptualAnalysis?.findings.includes('Key Documents Found:') && 
                   !conceptualAnalysis.findings.includes('Key Documents Found: 0');
  analysis += `- **Documentation:** ${hasKeyDocs ? 'Key documents available for context' : 'Limited documentation found'}\n`;
  
  // Project organization
  const hasStructure = structuralAnalysis?.findings.includes('src/');
  analysis += `- **Organization:** ${hasStructure ? 'Well-structured with src/ directory' : 'Custom or flat structure'}\n`;
  
  // Entry points
  const hasEntryPoints = codeAnalysis?.findings.includes('Entry Points') && 
                        !codeAnalysis.findings.includes('No clear entry points');
  analysis += `- **Entry Points:** ${hasEntryPoints ? 'Clear entry points identified' : 'Entry points need investigation'}\n`;
  
  analysis += "\n## 🚀 Quick Start Recommendations\n\n";
  analysis += "1. **Start with documentation** - Review any README or key docs found\n";
  analysis += "2. **Understand the structure** - Navigate the directory layout\n";
  analysis += "3. **Find entry points** - Look for main files or startup scripts\n";
  analysis += "4. **Trace dependencies** - Follow import/require statements between files\n";
  analysis += "5. **Identify patterns** - Look for consistent architectural approaches\n";
  
  return analysis;
}

export async function generateComprehensiveReport(
  projectPath: string, 
  allPhaseFindings: string,
  analysisHistory: CodebaseAnalysis[],
  keyDocs: string[]
): Promise<string> {
  let report = `# 📊 CODEBASE OVERVIEW AND CONTEXT\n\n`;
  report += `**Project:** ${path.basename(projectPath)}\n`;
  report += `**Analysis Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
  
  report += `---\n\n`;
  
  // Include all phase findings
  report += allPhaseFindings;
  
  report += `\n---\n\n`;
  
  // Add instruction section for Copilot
  if (keyDocs.length > 0) {
    report += `## 📖 Next Steps for Complete Understanding\n\n`;
    report += `For comprehensive project context, please read the following key documentation files:\n\n`;
    
    for (const docPath of keyDocs) {
      const relativePath = path.relative(projectPath, docPath);
      report += `- **${path.basename(docPath)}** - \`${relativePath}\`\n`;
    }
    
    report += `\nThese files contain important project goals, requirements, architecture decisions, and implementation details that complement this structural analysis.\n\n`;
  }
  
  report += `*Analysis completed by Codebase Navigator*\n`;
  
  return report;
}
