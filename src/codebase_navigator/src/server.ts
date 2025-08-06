import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { CodebaseAnalysis, CodeAnalysisResult, FileContent } from './types/index.js';
import { findKeyDocs, findRepositoryRoot, getProjectStructure, findCodeFiles } from './utils/fileSystem.js';
import { 
  extractImports, 
  isEntryPoint, 
  detectPatterns, 
  extractCodeElements, 
  analyzeArchitecture, 
  buildCodeStructureMap 
} from './utils/codeAnalyzer.js';
import { 
  formatAnalysis, 
  processPhase1, 
  processPhase2, 
  processPhase3, 
  processPhase4, 
  generateComprehensiveReport 
} from './utils/reportGenerator.js';

export class CodebaseNavigatorServer {
  private analysisHistory: CodebaseAnalysis[] = [];
  private disableAnalysisLogging: boolean;

  constructor() {
    this.disableAnalysisLogging = (process.env.DISABLE_ANALYSIS_LOGGING || "").toLowerCase() === "true";
  }

  private async analyzeCodeFiles(projectPath: string): Promise<CodeAnalysisResult> {
    const analysis: CodeAnalysisResult = {
      dependencies: [],
      entryPoints: [],
      patterns: [],
      codeStructure: {} as any,
      functionsAndClasses: [],
      fileContents: [],
      architecture: []
    };

    try {
      const codeFiles = findCodeFiles(projectPath);
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
        const imports = extractImports(content, path.extname(filePath));
        analysis.dependencies.push(...imports);
        
        // Identify entry points
        if (isEntryPoint(content, relativePath)) {
          analysis.entryPoints.push(relativePath);
        }
        
        // Detect patterns
        const filePatterns = detectPatterns(content, relativePath);
        analysis.patterns.push(...filePatterns);
        
        // Extract functions and classes with detailed info
        const codeElements = extractCodeElements(content, relativePath);
        analysis.functionsAndClasses.push(...codeElements);
        
        // Analyze file architecture
        const archPatterns = analyzeArchitecture(content, relativePath);
        analysis.architecture.push(...archPatterns);
      }
      
      // Build code structure map
      analysis.codeStructure = buildCodeStructureMap(analysis.fileContents);
      
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

  public async processCodebaseAnalysis(input: unknown): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    try {
      const data = input as Record<string, unknown>;
      const providedPath = data.projectPath as string;
      const requestedPhase = (data.phase as string) || 'all';

      if (!providedPath || !fs.existsSync(providedPath)) {
        throw new Error('Invalid or non-existent project path');
      }

      // 🔥 AUTO-DETECT REPOSITORY ROOT
      const repositoryRoot = await findRepositoryRoot(providedPath);
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
      let keyDocs: string[] = []; // Declare keyDocs outside the loop
      
      console.error(chalk.blue('🚀 Starting comprehensive codebase analysis...'));
      
      for (const phase of allPhases) {
        console.error(chalk.yellow(`📋 Running ${phase} phase...`));
        
        let phaseFindings = '';
        
        switch (phase) {
          case 'conceptual':
            keyDocs = await findKeyDocs(projectPath); // Assign to the outer variable
            phaseFindings = await processPhase1(projectPath, keyDocs);
            break;

          case 'structural':
            const structure = await getProjectStructure(projectPath);
            phaseFindings = await processPhase2(projectPath, structure);
            break;

          case 'analysis':
            const codeAnalysis = await this.analyzeCodeFiles(projectPath);
            phaseFindings = await processPhase3(projectPath, codeAnalysis);
            break;

          case 'synthesis':
            phaseFindings = await processPhase4(projectPath, this.analysisHistory);
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
          const formattedAnalysis = formatAnalysis(analysis);
          console.error(formattedAnalysis);
        }
      }

      // Generate final comprehensive report
      const finalReport = await generateComprehensiveReport(projectPath, comprehensiveReport, this.analysisHistory, keyDocs);
      
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
        const keyDocs = await findKeyDocs(projectPath);
        findings = await processPhase1(projectPath, keyDocs);
        break;

      case 'structural':
        const structure = await getProjectStructure(projectPath);
        findings = await processPhase2(projectPath, structure);
        break;

      case 'analysis':
        const codeAnalysis = await this.analyzeCodeFiles(projectPath);
        findings = await processPhase3(projectPath, codeAnalysis);
        break;

      case 'synthesis':
        findings = await processPhase4(projectPath, this.analysisHistory);
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
      const formattedAnalysis = formatAnalysis(analysis);
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

  private getSuggestedNextPhase(currentPhase: string): string {
    const phaseOrder = ['conceptual', 'structural', 'analysis', 'synthesis'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return currentIndex < phaseOrder.length - 1 ? phaseOrder[currentIndex + 1] : 'complete';
  }
}
