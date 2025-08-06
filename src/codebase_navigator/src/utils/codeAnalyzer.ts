import * as path from 'path';
import { CodeElement, FileContent, CodeStructure } from '../types/index.js';

export function extractImports(content: string, extension: string): string[] {
  const imports: string[] = [];
  
  switch (extension) {
    case '.js':
    case '.ts':
    case '.tsx':
    case '.jsx':
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
      
    case '.java':
      const javaImports = content.match(/import\s+(static\s+)?([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*(?:\.\*)?)\s*;/g) || [];
      javaImports.forEach(match => {
        const moduleMatch = match.match(/import\s+(?:static\s+)?([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/);
        if (moduleMatch) imports.push(moduleMatch[1]);
      });
      break;
      
    case '.go':
      const goImports = content.match(/import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g) || [];
      goImports.forEach(match => {
        if (match.includes('(')) {
          // Multi-line imports
          const multiImports = match.match(/"([^"]+)"/g) || [];
          multiImports.forEach(imp => {
            const cleaned = imp.replace(/"/g, '');
            if (cleaned) imports.push(cleaned);
          });
        } else {
          // Single import
          const moduleMatch = match.match(/"([^"]+)"/);
          if (moduleMatch) imports.push(moduleMatch[1]);
        }
      });
      break;
      
    case '.rs':
      const rustImports = content.match(/use\s+([a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)*(?:::(?:\{[^}]+\}|\*|[a-zA-Z_][a-zA-Z0-9_]*))?)(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?;/g) || [];
      rustImports.forEach(match => {
        const moduleMatch = match.match(/use\s+([a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)*)/);
        if (moduleMatch) imports.push(moduleMatch[1]);
      });
      break;
      
    case '.cpp':
    case '.c':
    case '.h':
    case '.hpp':
      const cppImports = content.match(/#include\s*[<"]([^>"]+)[>"]/g) || [];
      cppImports.forEach(match => {
        const moduleMatch = match.match(/#include\s*[<"]([^>"]+)[>"]/);
        if (moduleMatch) imports.push(moduleMatch[1]);
      });
      break;
      
    case '.php':
      const phpImports = content.match(/(?:require|include)(?:_once)?\s*\(?['"]([^'"]+)['"]|use\s+([a-zA-Z_\\][a-zA-Z0-9_\\]*)/g) || [];
      phpImports.forEach(match => {
        const requireMatch = match.match(/(?:require|include)(?:_once)?\s*\(?['"]([^'"]+)['"]/);
        const useMatch = match.match(/use\s+([a-zA-Z_\\][a-zA-Z0-9_\\]*)/);
        if (requireMatch) imports.push(requireMatch[1]);
        if (useMatch) imports.push(useMatch[1]);
      });
      break;
      
    case '.rb':
      const rubyImports = content.match(/require\s*['"]([^'"]+)['"]|require_relative\s*['"]([^'"]+)['"]/g) || [];
      rubyImports.forEach(match => {
        const moduleMatch = match.match(/require(?:_relative)?\s*['"]([^'"]+)['"]/);
        if (moduleMatch) imports.push(moduleMatch[1]);
      });
      break;
  }
  
  return imports.filter(imp => imp && !imp.startsWith('.'));
}

export function isEntryPoint(content: string, filePath: string): boolean {
  const entryPatterns = [
    // JavaScript/TypeScript/Node.js
    /main\s*\(/,
    /express\(\)/,
    /createApp\(/,
    /ReactDOM\.render/,
    /new\s+Server\(/,
    
    // Python
    /if\s+__name__\s*==\s*['"]__main__['"]/,
    
    // Java
    /public\s+static\s+void\s+main\s*\(/,
    
    // C/C++
    /int\s+main\s*\(/,
    /void\s+main\s*\(/,
    
    // Go
    /func\s+main\s*\(\s*\)/,
    
    // Rust
    /fn\s+main\s*\(\s*\)/,
    
    // C#
    /static\s+void\s+Main\s*\(/,
    
    // PHP
    /namespace\s+|<\?php/,
    
    // Ruby
    /if\s+__FILE__\s*==\s*\$0/
  ];
  
  const isMainFile = ['index', 'main', 'app', 'server', 'program'].some(name => 
    filePath.toLowerCase().includes(name)
  );
  
  const hasEntryPattern = entryPatterns.some(pattern => pattern.test(content));
  
  return isMainFile || hasEntryPattern;
}

export function detectPatterns(content: string, filePath: string): string[] {
  const patterns: string[] = [];
  
  // Universal patterns
  if (/class\s+\w+|struct\s+\w+|interface\s+\w+/i.test(content)) patterns.push('OOP/Classes');
  if (/function\s+\w+|def\s+\w+|fn\s+\w+|func\s+\w+|const\s+\w+\s*=.*=>|\w+\s*\(/i.test(content)) patterns.push('Functions');
  if (/\.then\(|async\s+|await\s+|Promise|Future|Task/i.test(content)) patterns.push('Async/Promises');
  if (/try\s*{|\btry:\s*$|catch\s*\(|except\s*:/m.test(content)) patterns.push('Error Handling');
  if (/test\s*\(|describe\s*\(|it\s*\(|@Test|unittest|pytest/i.test(content)) patterns.push('Testing');
  
  // Language-specific patterns
  // JavaScript/TypeScript
  if (/export\s+(default\s+)?|module\.exports/i.test(content)) patterns.push('ES6 Modules');
  if (/React\.|useState|useEffect|Component/i.test(content)) patterns.push('React');
  if (/express\(\)|app\.get|app\.post|router\./i.test(content)) patterns.push('Express.js/Web Server');
  
  // Database/SQL
  if (/SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE/i.test(content)) patterns.push('SQL/Database');
  if (/mongoose\.|sequelize\.|prisma\.|TypeORM|Hibernate/i.test(content)) patterns.push('ORM');
  
  // Python
  if (/__init__\.py|if\s+__name__\s*==|import\s+\w+|from\s+\w+/i.test(content)) patterns.push('Python Modules');
  if (/django|flask|fastapi|@app\.|@router\./i.test(content)) patterns.push('Python Web Framework');
  if (/numpy|pandas|matplotlib|sklearn|tensorflow|pytorch/i.test(content)) patterns.push('Data Science/ML');
  
  // Java
  if (/package\s+\w+|import\s+java\.|@Override|@Component/i.test(content)) patterns.push('Java/JVM');
  if (/Spring|@Autowired|@Service|@Repository|@Controller/i.test(content)) patterns.push('Spring Framework');
  if (/JUnit|@Test|Mockito/i.test(content)) patterns.push('Java Testing');
  
  // Go
  if (/package\s+\w+|import\s+\(|func\s+\w+|go\s+func|chan\s+/i.test(content)) patterns.push('Go Language');
  if (/gorilla\/mux|gin\.|echo\.|http\.Handle/i.test(content)) patterns.push('Go Web Server');
  
  // Rust
  if (/use\s+\w+|mod\s+\w+|impl\s+\w+|#\[derive|cargo/i.test(content)) patterns.push('Rust Language');
  if (/actix|warp|rocket|axum/i.test(content)) patterns.push('Rust Web Framework');
  
  // C/C++
  if (/#include|#define|#ifndef|std::|using namespace/i.test(content)) patterns.push('C/C++');
  if (/iostream|vector|string|map|set|algorithm/i.test(content)) patterns.push('C++ STL');
  
  // DevOps/Infrastructure
  if (/docker|dockerfile|kubernetes|helm|terraform/i.test(content)) patterns.push('DevOps/Infrastructure');
  if (/\.yml|\.yaml|ansible|pipeline/i.test(filePath.toLowerCase())) patterns.push('Configuration as Code');
  
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
