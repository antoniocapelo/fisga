# Fisga

Fisga is a flexible command-line tool that helps you organize and execute commands through a configurable interface. It's built on top of [oclif](https://oclif.io/) and it allows you to define command structures in a JSON file and provides an interactive way to execute them.

This can be useful to abstract and document project tasks such as NPM, Maven, Elixir, etc.

## Features

- 🎯 **Interactive Command Selection**: Navigate through nested commands using an interactive CLI
- ⚙️ **User Configuration**: Built-in _setup_ step, which stores user-specific settings in a config file
- 🔍 **Fuzzy Search**: Select files and folders easily with built-in fuzzy search
- 📁 **Directory Context**: Execute commands in specific directories
- 🎛️ **Multiple Input Types**:
  - Text input
  - Single selection
  - Multiple selection (checkbox)
  - Confirmation prompts
  - File/path selection with fuzzy search

## Installation

```bash
npm install -g fisga
```

## Usage

1. Create a config file (e.g., `commands.json`):
```json
{
  "setup": {
    "configFileDirname": "$HOME/.config/fisga",
    "steps": [
      {
        "name": "workspace",
        "description": "Enter your workspace directory",
        "type": "input",
        "default": "$HOME/workspace"
      }
    ]
  },
  "commands": [
    {
      "name": "git",
      "description": "Git operations",
      "commands": [
        {
          "name": "add",
          "description": "Stage files",
          "args": {
            "files": {
              "type": "regexp",
              "description": "Select files to stage",
              "glob": "**/*",
              "multi": true
            }
          },
          "command": "git add {files}"
        }
      ]
    }
  ]
}
```

2. Run fisga:
```bash
fisga path/to/commands.json
```

_Note:_ There's a `schema/fisga-config.schema.json` that can make it faster to create the config file. Just include it like:

```json
{
  "$schema": "../schema/fisga-config.schema.json",
  "setup": { },
  "commands": { }
}
```

You'll now have an interactive CLI with your own commands. Since every user will have their own use settings, this CLI can be shared amongst teams to standardize common command execution.

3. Distribute it to your team/org

3.1. If no user config exists, you'll be prompted to run the setup first.

## Configuration

### User Config
- It's stored in a `config.json`, at the location specified in your config file's `setup.configFileDirname`
- Values can be referenced in commands using `{CONFIG.KEY}` syntax

### Command Types
- **Simple Commands**: Direct execution without arguments
- **Interactive Commands**: Gather user input before execution
- **Nested Commands**: Group related commands together

### Argument Types
- `input`: Text input
- `select`: Single selection from options
- `checkbox`: Multiple selections
- `confirm`: Yes/no confirmation
- `regexp`: File selection with fuzzy search

## Examples

### Basic Command
```json
{
  "name": "hello",
  "description": "Say hello",
  "command": "echo 'Hello, World!'"
}
```

### Command with User Config
```json
{
  "name": "open",
  "description": "Open project",
  "dirname": "{CONFIG.WORKSPACE}/project",
  "command": "{CONFIG.EDITOR} ."
}
```

### Interactive Command
```json
{
  "name": "commit",
  "description": "Commit changes",
  "args": {
    "message": {
      "type": "input",
      "description": "Enter commit message",
      "required": true
    }
  },
  "command": "git commit -m '{message}'"
}
```

### Nested commands
```json
{
  "name": "Front-end",
  "description": "FE tasks",
    "commands": [
      {
        "name": "run",
        "description": "Run app in dev mode",
        "args": {
          "port": {
            "type": "input",
            "description": "Port",
            "default": "3000",
            "required": default
        }
      },
      {
        "name": "build",
        "description": "Build app",
        "command": "npm run build"
      }
  ]
}
```


## License

MIT
