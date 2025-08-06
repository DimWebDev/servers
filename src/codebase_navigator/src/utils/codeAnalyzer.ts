import * as path from 'path';
import { CodeElement, FileContent, CodeStructure } from '../types/index.js';

export function extractImports(content: string, extension: string): string[] {
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

export function isEntryPoint(content: string, filePath: string): boolean {
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

export function detectPatterns(content: string, filePath: string): string[] {
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

export function extractCodeElements(content: string, filePath: string): CodeElement[] {
  const elements: CodeElement[] = [];
  
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

export function analyzeArchitecture(content: string, filePath: string): string[] {
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

export function buildCodeStructureMap(fileContents: FileContent[]): CodeStructure {
  const structure: CodeStructure = {
    totalFiles: fileContents.length,
    totalLines: fileContents.reduce((sum, file) => sum + file.lines, 0),
    totalSize: fileContents.reduce((sum, file) => sum + file.size, 0),
    filesByExtension: {},
    largestFiles: [],
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
