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
  const lines = content.split('\n').slice(0, 10);
  const firstParagraph = lines.find(line => line.trim().length > 20) || lines[0] || '';
  return firstParagraph.trim().slice(0, 100) + (firstParagraph.length > 100 ? '...' : '');
}

export async function processPhase1(projectPath: string, keyDocs: string[]): Promise<string> {
  let analysis = "## Phase 1: Conceptual Understanding\n\n";
  
  analysis += `**Key Documents Found:** ${keyDocs.length}\n`;
  
  if (keyDocs.length > 0) {
    analysis += "\n**Document Analysis:**\n";
    for (const docPath of keyDocs.slice(0, 5)) { // Limit to first 5 docs
      const docName = path.basename(docPath);
      try {
        const content = fs.readFileSync(docPath, 'utf-8');
        const summary = summarizeDocument(content, docName);
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

export async function processPhase2(projectPath: string, structure: string): Promise<string> {
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

export async function processPhase3(projectPath: string, codeAnalysis: CodeAnalysisResult): Promise<string> {
  let analysis = "## Phase 3: In-Depth Code Analysis\n\n";
  
  // Code Structure Overview
  analysis += "**📊 Code Structure Overview:**\n";
  analysis += `- **Total Files:** ${codeAnalysis.codeStructure.totalFiles}\n`;
  analysis += `- **Total Lines of Code:** ${codeAnalysis.codeStructure.totalLines.toLocaleString()}\n`;
  analysis += `- **Total Size:** ${(codeAnalysis.codeStructure.totalSize / 1024).toFixed(1)} KB\n`;
  analysis += `- **Complexity Level:** ${codeAnalysis.codeStructure.complexity}\n\n`;
  
  // File breakdown by extension
  analysis += "**📁 Files by Type:**\n";
  Object.entries(codeAnalysis.codeStructure.filesByExtension).forEach(([ext, data]) => {
    analysis += `- **${ext}**: ${data.count} files, ${data.totalLines} lines\n`;
  });
  analysis += "\n";
  
  // Largest files
  if (codeAnalysis.codeStructure.largestFiles.length > 0) {
    analysis += "**📋 Largest Files:**\n";
    codeAnalysis.codeStructure.largestFiles.forEach((file) => {
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

export async function processPhase4(projectPath: string, analysisHistory: CodebaseAnalysis[]): Promise<string> {
  let analysis = "## Phase 4: Synthesis and Reporting\n\n";
  
  analysis += "**Project Summary:**\n";
  analysis += `- **Project**: ${path.basename(projectPath)}\n`;
  analysis += `- **Analysis Phases Completed**: ${analysisHistory.length}\n`;
  
  const recentAnalyses = analysisHistory.slice(-3);
  
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

export async function generateComprehensiveReport(
  projectPath: string, 
  allPhaseFindings: string,
  analysisHistory: CodebaseAnalysis[]
): Promise<string> {
  let report = `# 📊 COMPREHENSIVE CODEBASE ANALYSIS REPORT\n\n`;
  report += `**Project:** ${path.basename(projectPath)}\n`;
  report += `**Analysis Date:** ${new Date().toISOString().split('T')[0]}\n`;
  report += `**Total Phases Completed:** 4\n\n`;
  
  report += `---\n\n`;
  
  // Include all phase findings
  report += allPhaseFindings;
  
  // Add executive summary
  report += `## 🎯 EXECUTIVE SUMMARY\n\n`;
  
  const conceptualAnalysis = analysisHistory.find(a => a.phase === 'conceptual');
  const structuralAnalysis = analysisHistory.find(a => a.phase === 'structural');
  const codeAnalysis = analysisHistory.find(a => a.phase === 'analysis');
  
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
  
  report += `**Total Analysis Time:** ${analysisHistory.length} phases completed\n`;
  report += `**Recommendation:** This codebase is ${hasKeyDocs && hasStructure ? 'ready for development' : 'suitable for development with some improvements needed'}\n\n`;
  
  report += `---\n`;
  report += `*Analysis generated by Codebase Navigator v0.1.0*\n`;
  
  return report;
}
