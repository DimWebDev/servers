import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function findKeyDocs(projectPath: string): Promise<string[]> {
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
      if (depth > 10) return; // Increased depth to 10 for very deep nested package structures
      
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

export async function findRepositoryRoot(startPath: string): Promise<string> {
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

export async function getProjectStructure(projectPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `cd "${projectPath}" && tree -I 'node_modules|__pycache__|dist|build|.git' -L 10 || find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.java" | head -20`
    );
    return stdout;
  } catch (error) {
    return "Unable to generate project structure";
  }
}

export function findCodeFiles(projectPath: string): string[] {
  const codeFiles: string[] = [];
  const extensions = [
    // Web Technologies
    '.ts', '.js', '.tsx', '.jsx', '.vue', '.svelte',
    
    // Backend Languages
    '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs', '.php', '.rb',
    
    // Mobile
    '.swift', '.kt', '.dart',
    
    // Functional Languages
    '.hs', '.elm', '.clj', '.ml', '.fs',
    
    // Data & Config
    '.sql', '.json', '.yaml', '.yml', '.toml', '.xml',
    
    // Shell & Scripts
    '.sh', '.bash', '.ps1', '.bat',
    
    // Headers
    '.h', '.hpp', '.hxx'
  ];
  
  const walkDir = (dir: string, depth: number = 0): void => {
    if (depth > 10) return; // Increased depth to 10 for very deep package structures like Java/Python
    
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory() && ![
          'node_modules', '.git', 'dist', 'build', '__pycache__', 
          'target', 'bin', 'obj', '.vscode', '.idea', 
          'vendor', '.gradle', '.maven', 'cmake-build-debug'
        ].includes(item)) {
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
