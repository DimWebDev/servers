export interface CodebaseAnalysis {
  projectPath: string;
  phase: 'conceptual' | 'structural' | 'analysis' | 'synthesis';
  findings: string;
  nextPhaseNeeded: boolean;
  timestamp: string;
}

export interface CodeAnalysisResult {
  dependencies: string[];
  entryPoints: string[];
  patterns: string[];
  codeStructure: CodeStructure;
  functionsAndClasses: CodeElement[];
  fileContents: FileContent[];
  architecture: string[];
}

export interface CodeStructure {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  filesByExtension: Record<string, { count: number; totalLines: number }>;
  largestFiles: Array<{ path: string; lines: number; size: number }>;
  complexity: 'Low' | 'Medium' | 'High' | 'unknown';
}

export interface CodeElement {
  type: 'class' | 'function' | 'arrow_function' | 'interface' | 'type';
  name: string;
  file: string;
  methods?: string[];
  lineEstimate?: number;
  isAsync?: boolean;
  isExported?: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  lines: number;
  extension: string;
}
