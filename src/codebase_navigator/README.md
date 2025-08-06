# Codebase Navigator MCP Server

An MCP server implementation that provides comprehensive 4-phase codebase analysis and navigation for developers joining new projects.

## 🚀 Overview

The Codebase Navigator automatically analyzes any software project through a structured 4-phase approach, providing developers with comprehensive insights about code structure, dependencies, architectural patterns, and onboarding recommendations.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Multi-Language Support](#multi-language-support)
  - [Comprehensive Analysis](#comprehensive-analysis)
  - [Rich Reporting](#rich-reporting)
  - [Example Output](#example-output)
- [Architecture](#architecture)
  - [Key Components](#key-components)
- [Analysis Phases](#analysis-phases)
- [Language Support](#language-support)
- [Tool](#tool)
  - [analyze_codebase](#analyze_codebase)
- [Usage](#usage)
- [Configuration](#configuration)
  - [Usage with Claude Desktop](#usage-with-claude-desktop)
  - [Usage with VS Code](#usage-with-vs-code)
- [License](#license)

## ✨ Features

### 🔍 **Multi-Language Support**
- **25+ Programming Languages**: JavaScript, TypeScript, Python, Java, Go, Rust, C/C++, PHP, Ruby, Swift, Kotlin, and more
- **Smart Import Parsing**: Understands language-specific import/dependency syntax
- **Framework Detection**: Recognizes popular frameworks (React, Express, Django, Spring, etc.)

### 📊 **Comprehensive Analysis**
- **4-Phase Analysis**: Conceptual → Structural → Code Analysis → Synthesis
- **Auto-Root Detection**: Automatically finds project root from any nested directory
- **Architecture Patterns**: Identifies MVC, Repository, Service Layer, and other patterns
- **Entry Point Detection**: Locates main application entry points across languages

### 📋 **Rich Reporting**
- **Executive Summary**: Project health indicators and complexity assessment
- **Developer Onboarding**: Quick start checklist and recommendations
- **Detailed Metrics**: Lines of code, file breakdowns, dependency analysis
- **Visual Structure**: Directory tree and file organization insights

### Example Output

```
📊 COMPREHENSIVE CODEBASE ANALYSIS REPORT

Project: my-app
Analysis Date: 2025-08-06
Total Phases Completed: 4

🎯 EXECUTIVE SUMMARY
Project Type: Node.js/TypeScript Application
Documentation Quality: Well Documented ✅
Code Organization: Well Organized ✅
Complexity Level: Medium (Moderate Dependencies) 🟡

🚀 DEVELOPER ONBOARDING GUIDE
- [x] Clone the repository
- [x] Run `npm install` to install dependencies
- [x] Check `package.json` for available scripts
- [x] Start by examining the main entry points identified
```

## 🏗 Architecture

The codebase is organized into focused, testable modules:

```
src/codebase_navigator/
├── index.ts              # MCP server entry point
├── server.ts             # Main orchestration logic
├── types/
│   └── index.ts          # Shared TypeScript interfaces
└── utils/
    ├── fileSystem.ts     # File operations & repository detection
    ├── codeAnalyzer.ts   # Code parsing & pattern detection
    └── reportGenerator.ts # Report formatting & generation
```

### Key Components

- **File System Utils**: Auto-detect project roots, find source files, locate documentation
- **Code Analyzer**: Parse imports, detect patterns, extract functions/classes, analyze architecture
- **Report Generator**: Format findings, generate comprehensive reports, create onboarding guides
- **Server Orchestrator**: Coordinate analysis phases, manage state, handle MCP protocol

## 🎯 Analysis Phases

### Phase 1: Conceptual Understanding
- Identifies key documentation files (README, ARCHITECTURE, etc.)
- Extracts project goals and requirements
- Builds foundational understanding of project purpose

### Phase 2: Structural Scaffolding
- Maps physical layout and organization
- Provides directory tree view
- Identifies structural patterns and conventions

### Phase 3: In-Depth Code Analysis
- Analyzes dependencies and module relationships
- Identifies entry points and data flow
- Detects architectural and programming patterns
- Maps component interactions

### Phase 4: Synthesis and Reporting
- Combines insights into actionable intelligence
- Provides developer onboarding recommendations
- Summarizes key findings and next steps
- Generates comprehensive final report

## 🌍 Language Support

### Fully Supported (Import Parsing + Patterns)
- JavaScript/TypeScript (.js, .ts, .tsx, .jsx)
- Python (.py)
- Java (.java)
- Go (.go)
- Rust (.rs)
- C/C++ (.c, .cpp, .h, .hpp)
- PHP (.php)
- Ruby (.rb)

### Additional File Types Recognized
- Mobile: Swift, Kotlin, Dart
- Functional: Haskell, Elm, Clojure
- Data: SQL, JSON, YAML, TOML, XML
- Scripts: Shell, PowerShell, Batch


## Tool

### analyze_codebase

Facilitates comprehensive 4-phase codebase analysis for systematic project understanding.

**Inputs:**
- `projectPath` (string): Absolute path to the project root directory to analyze
- `phase` (string, optional): Analysis phase to execute - `conceptual`, `structural`, `analysis`, `synthesis`, or `all` (defaults to 'all' for complete analysis)

**Phases:**
1. **Conceptual Understanding**: Identifies key documentation (README, ARCHITECTURE, etc.) and extracts project context
2. **Structural Scaffolding**: Generates project tree view and identifies organizational patterns  
3. **In-Depth Code Analysis**: Maps dependencies, entry points, and architectural patterns
4. **Synthesis and Reporting**: Combines insights into actionable intelligence for new developers

## Usage

The Codebase Navigator tool is designed for:
- Onboarding new developers to existing projects
- Understanding large, unfamiliar codebases quickly
- Analyzing project architecture and dependencies
- Identifying entry points and key components
- Extracting insights from project documentation
- Getting oriented in complex software systems

## Configuration

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

#### npx

```json
{
  "mcpServers": {
    "codebase-navigator": {
      "command": "npx",
      "args": [
        "-y",
        "@dimwebdev/codebase_navigator"
      ]
    }
  }
}
```


To disable logging of analysis information set env var: `DISABLE_ANALYSIS_LOGGING` to `true`.

### Usage with VS Code
For manual installation, add the following JSON block to your User Settings (JSON) file in VS Code.

To add an MCP to your user configuration, run the **MCP: Open User Configuration** command. This opens the `mcp.json` file in your user profile. If the file does not exist, VS Code will create it for you.

For detailed instructions, refer to the [official documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers).

Optionally, you can add the configuration to a `.vscode/mcp.json` file in your workspace. This allows you to share the configuration with others.

> Note: The `mcp` key is not needed in the `.vscode/mcp.json` file.

For NPX installation:

```json
{
  "mcp": {
    "servers": {
      "codebase-navigator": {
        "command": "npx",
        "args": [
          "-y",
          "@dimwebdev/codebase_navigator"
        ]
      }
    }
  }
}
```


## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

