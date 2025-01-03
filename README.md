# Fisga

Fisga is a flexible command-line tool that helps you organize and execute commands through a configurable interface. It's built on top of [oclif](https://oclif.io/) and it allows you to define command structures in a JSON file and provides an interactive way to execute them. Alternatively, it can also be fed a path to a `package.json` file and present its scripts in a friendly UI (with built-in nesting).

This can be useful to standardize and document project tasks such as NPM, Maven, Elixir, etc.

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

### Using a `config` file

Using a config file is the best way to run `fisga`. It allows you to version your commands, display custom notifications, use user-specific settings, and more. 

1. Create a config file (e.g., `config.json`) - you can follow the `config-example.json` file as a template:

```json
{
  // Setup is optional, only needed if your commands will depend on user settings
  "setup": {
    // This is the path where the user config.json file will be stored
    "configFileDirname": "$HOME/.config/fisga",
    // These are the steps that a user will be presented, to setup their local environment
    "steps": [
      {
        // this name can then be referenced in your commands (eg: {CONFIG.workspace}) later on
        "name": "workspace",
        "description": "Enter your workspace directory",
        "type": "input",
        "default": "$HOME/workspace"
      }
    ]
  },
  // These are the commands that will be presented to your users when they run the CLI
  "commands": [
    {
      "name": "git",
      "description": "Git operations",
      // By having a "commands" (plural) property, we can created nested commands
      "commands": [
        {
          "name": "add",
          "description": "Stage files",
          "args": {
            "files": {
              "type": "regexp",
              "description": "Select files to stage",
              "glob": "**/*",
              "ignore":["deps/", ".dist/"]
            }
          },
          // A "command" (singular) property is what defines the final command to be run
          "command": "git add {files}"
        }
      ]
    }
  ]
}
```

_Note:_ There's a `schema/fisga-config.schema.json` that can make it faster to create the config file. Just include it like:

```json
{
  "$schema": "../schema/fisga-config.schema.json",
  "setup": { },
  "commands": [ ]
}
```

**Alternatively**, if have a `package.json` file available, you can use it to generate a config file. Just run `fisga` without any arguments and you'll be prompted for a `package.json` path.

2. Distribute it to your team/org

You'll now have an interactive CLI with your own commands. If user-specific values are needed (tokens, paths, etc), the setup step should gather them for each user, so a single CLI config can be shared amongst teams to standardize common command execution.


2.1. You can distrubute it by packaging your CLI in a NPM package that calls `fisga` with your custoom config. Users would then call

```bash
$ my-custom-cli # which underneath calls fisga with your pre-defined config
```

2.2. Another option is just sharing your `config` file with the team members. With this option, users would run their fisga CLI like:

```bash
fisga --config path/to/config.json
```

### Running it on top of a `package.json` file



## Configuration

### User Config
- When a `setup` property is defined in `config.json`, users are required to go through the setup steps to create the file. If no user config exists, they'll be prompted to run the setup first.
- It's stored in a `config.json`, at the location specified in your config file's `setup.configFileDirname`
- User config values can be referenced in commands using `{CONFIG.settingName}` syntax

### Command Types
**Simple Commands**: Direct execution without arguments

```json
{
  "name": "simple-command",
  "description": "Builds and runs project",
  "command": "npm run build && npm run start",
}
```


**Interactive Commands**: Gather user input as arguments before execution
```json
{
  "name": "Docker build",
  "description": "Build docker container",
  "args": {
    // We can then reference "tag" in our command
    "tag": {
      "type": "input",
      "description": "Container tag",
      "required": true
    }
  },
  "command": "docker build -t {tag} ."
}
```

**Nested Commands**: Group related commands together

```json
{
  "name": "Test",
  "description": "Test tasks",
  "commands": [
    {
      "name": "Unit",
      "description": "Jest tests",
      "command": "jest ..."
    },
    {
      "name": "E2E",
      "description": "Playwright tests",
      "command": "playwright ..."
    },
  ],
}
```

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
            "name": "git",
            "description": "Git related commands",
            "dirname": "{CONFIG.WORKSPACE}/fisga",
            "commands": [
                {
                    "name": "add",
                    "description": "Stage changes",
                    "args": {
                        "files": {
                            "type": "regexp",
                            "glob": "**/*",
                            "description": "files to stage",
                            "includeDirectories": true,
                            "required": true
                        }
                    },
                    "command": "git add {files}"
                },
                {
                    "name": "push",
                    "description": "Push changes",
                    "command": "git push"
                }
            ]
        },
        {
            "name": "docker",
            "description": "Docker related commands",
            "commands": [
                {
                    "name": "build",
                    "description": "Build container",
                    "args": {
                        "tag": {
                            "type": "input",
                            "description": "Container tag",
                            "required": true
                        }
                    },
                    "command": "docker build -t {tag} ."
                }
            ]
        }
    ]
}
```


## License

MIT
