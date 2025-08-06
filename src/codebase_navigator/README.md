# Codebase Navigator MCP Server

An MCP server implementation that provides comprehensive 4-phase codebase analysis and navigation for developers joining new projects.

## Features

- **Phase 1: Conceptual Understanding** - Extract and analyze key documentation files
- **Phase 2: Structural Scaffolding** - Map the physical codebase layout and organization
- **Phase 3: In-Depth Code Analysis** - Analyze dependencies, relationships, and patterns
- **Phase 4: Synthesis and Reporting** - Generate structured insights for new developers
- Systematic approach to understanding unfamiliar codebases
- Cross-language support for multiple programming environments
- Intelligent document discovery and analysis

## Tool

### analyze_codebase

Facilitates comprehensive 4-phase codebase analysis for systematic project understanding.

**Inputs:**
- `projectPath` (string): Absolute path to the project root directory to analyze
- `phase` (string, optional): Analysis phase to execute - `conceptual`, `structural`, `analysis`, or `synthesis` (defaults to 'conceptual')

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
        "@dimwebdev/code_navigator"
      ]
    }
  }
}
```

#### docker

```json
{
  "mcpServers": {
    "codebase-navigator": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "mcp/codebase-navigator"
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
          "@dimwebdev/code_navigator"
        ]
      }
    }
  }
}
```

For Docker installation:

```json
{
  "mcp": {
    "servers": {
      "codebase-navigator": {
        "command": "docker",
        "args": [
          "run",
          "--rm",
          "-i",
          "mcp/codebase-navigator"
        ]
      }
    }
  }
}
```

## Example Usage

To analyze a project, call the tool with the project path:

```json
// Start with Phase 1: Conceptual Understanding
{
  "analyze_codebase": {
    "projectPath": "/path/to/your/project",
    "phase": "conceptual"
  }
}

// Then proceed through the remaining phases
// Phase 2: structural
// Phase 3: analysis  
// Phase 4: synthesis
```

The tool will guide you through each phase systematically, building comprehensive understanding of the codebase.

## Building

Docker:

```bash
docker build -t mcp/codebase-navigator -f src/code_navigator/Dockerfile .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

