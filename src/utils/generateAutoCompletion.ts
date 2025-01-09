import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, ICommand } from '../types.js';

type ShellType = 'bash' | 'zsh' | 'fish';

export const supportedShells: ShellType[] = ['bash', 'zsh', 'fish']

function generateBashCompletions(config: Config): string {
  const cliName = config.name.toLowerCase();
  let completion = `
#/usr/bin/env bash

_${cliName}_completion() {
    local cur prev words cword
    _get_comp_words_by_ref -n : cur prev words cword

    # Get all commands
    local commands="`;

  // Function to recursively get all commands
  function getAllCommands(cmds: ICommand[], prefix = ''): string[] {
    return cmds.flatMap(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      const fullCmd = prefix ? `${prefix} ${cmdName}` : cmdName;
      if (cmd.commands) {
        return [cmdName, ...getAllCommands(cmd.commands, cmdName)];
      }
      return [cmdName];
    });
  }

  completion += getAllCommands(config.commands).join(' ');
  completion += '"';

  // Add argument completion for each command
  completion += `\n\n    case "$prev" in\n`;

  function addCommandArgs(cmds: ICommand[], prefix = '') {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      if (cmd.args) {
        completion += `        ${cmdName})\n`;
        completion += `            local opts="\n`;
        Object.entries(cmd.args).forEach(([name, arg]) => {
          if (arg.type === 'boolean') {
            completion += `                --${name}\n`;
          } else {
            completion += `                --${name}=\n`;
          }
        });
        completion += `            "\n`;
        completion += `            COMPREPLY=($(compgen -W "$opts" -- "$cur"))\n`;
        completion += `            return 0\n`;
        completion += `            ;;\n`;
      }
      if (cmd.commands) {
        addCommandArgs(cmd.commands, cmdName);
      }
    });
  }

  addCommandArgs(config.commands);
  completion += `    esac\n\n`;

  // Complete command names
  completion += `    # Complete command names
    if [[ "$cur" == -* ]]; then
        return 0
    fi

    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return 0
}

complete -F _${cliName}_completion ${cliName}
`;

  return completion;
}

function generateZshCompletions(config: Config): string {
  const cliName = config.name.toLowerCase();
  let completion = `#compdef ${cliName}

_${cliName}() {
    local line state

    _arguments -C \\
        "1: :->cmds" \\
        "*::arg:->args"

    case "$state" in
        cmds)
            _values "commands" \\\n`;

  function addCommands(cmds: ICommand[], level = 1) {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      const indent = '    '.repeat(level);
      completion += `${indent}'${cmdName}[${cmd.description}]' \\\n`;

      if (cmd.commands) {
        addCommands(cmd.commands, level + 1);
      }
    });
  }

  addCommands(config.commands);

  completion += `            ;;
        args)
            case $line[1] in\n`;

  function addCommandArgs(cmds: ICommand[]) {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      if (cmd.args) {
        completion += `                ${cmdName})\n`;
        completion += `                    _arguments \\\n`;
        Object.entries(cmd.args).forEach(([name, arg]) => {
          const required = arg.required ? '' : ':';
          if (arg.type === 'boolean') {
            completion += `                        '--${name}[${arg.description}]' \\\n`;
          } else {
            completion += `                        '--${name}${required}[${arg.description}]:${name}' \\\n`;
          }
        });
        completion += `                    ;;\n`;
      }
      if (cmd.commands) {
        addCommandArgs(cmd.commands);
      }
    });
  }

  addCommandArgs(config.commands);

  completion += `            esac
            ;;
    esac
}

_${cliName}
`;

  return completion;
}

function generateFishCompletions(config: Config): string {
  const cliName = config.name.toLowerCase();
  let completion = `# Fish completion for ${config.name}\n\n`;

  function addCommands(cmds: ICommand[], parentCmd = '') {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      const fullCmd = parentCmd ? `${parentCmd} ${cmdName}` : cmdName;

      // Add command completion
      completion += `complete -c ${cliName} -f -n "__fish_use_subcommand" -a "${cmdName}" -d "${cmd.description}"\n`;

      // Add argument completions
      if (cmd.args) {
        Object.entries(cmd.args).forEach(([name, arg]) => {
          const condition = parentCmd
            ? `__fish_seen_subcommand_from ${parentCmd.split(' ').join(' ')} ${cmdName}`
            : `__fish_seen_subcommand_from ${cmdName}`;

          if (arg.type === 'boolean') {
            completion += `complete -c ${cliName} -f -n "${condition}" -l "${name}" -d "${arg.description}"\n`;
          } else if (arg.type === 'regexp' && arg.glob) {
            // Add file completion for glob patterns
            completion += `complete -c ${cliName} -f -n "${condition}" -l "${name}" -d "${arg.description}" -r\n`;
          } else {
            completion += `complete -c ${cliName} -f -n "${condition}" -l "${name}" -d "${arg.description}" -r\n`;
          }
        });
      }

      // Recursively add subcommands
      if (cmd.commands) {
        addCommands(cmd.commands, fullCmd);
      }
    });
  }

  addCommands(config.commands);

  return completion;
}

// Get default completion directory based on shell type
function getDefaultCompletionPath(shellType: ShellType): string {
  const home = os.homedir();

  switch (shellType) {
    case 'bash':
      // Try standard locations
      const bashCompletionDirs = [
        '/etc/bash_completion.d',  // System-wide
        `${home}/.local/share/bash-completion/completions`, // User-specific
        `${home}/.bash_completion.d` // Alternative user-specific
      ];
      for (const dir of bashCompletionDirs) {
        if (fs.existsSync(dir)) {
          return dir;
        }
      }
      // Create user-specific directory if none exist
      fs.mkdirSync(`${home}/.bash_completion.d`, { recursive: true });
      return `${home}/.bash_completion.d`;

    case 'zsh':
      // Try standard locations
      const zshCompletionDirs = [
        '/usr/local/share/zsh/site-functions',  // System-wide
        '/usr/share/zsh/site-functions',        // Alternative system-wide
        `${home}/.zsh/completions`,            // User-specific
        `${home}/.local/share/zsh/site-functions` // Alternative user-specific
      ];
      for (const dir of zshCompletionDirs) {
        if (fs.existsSync(dir)) {
          return dir;
        }
      }
      // Create user-specific directory if none exist
      fs.mkdirSync(`${home}/.zsh/completions`, { recursive: true });
      return `${home}/.zsh/completions`;

    case 'fish':
      const fishCompletionDir = `${home}/.config/fish/completions`;
      fs.mkdirSync(fishCompletionDir, { recursive: true });
      return fishCompletionDir;

    default:
      throw new Error(`Unsupported shell type: ${shellType}`);
  }
}

// Main function to generate completions for a specific shell
export async function generateCompletions(config: Config, shellType: ShellType, customOutputDir?: string) {
  // Determine output directory
  const outputDir = customOutputDir || getDefaultCompletionPath(shellType);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  let completionContent: string;
  let outputFilename: string;

  // Generate completion for the specified shell
  switch (shellType) {
    case 'bash':
      completionContent = generateBashCompletions(config);
      outputFilename = `${config.name.toLowerCase()}.bash`;
      break;
    case 'zsh':
      completionContent = generateZshCompletions(config);
      outputFilename = `_${config.name.toLowerCase()}`;
      break;
    case 'fish':
      completionContent = generateFishCompletions(config);
      outputFilename = `${config.name.toLowerCase()}.fish`;
      break;
    default:
      throw new Error(`Unsupported shell type: ${shellType}`);
  }

  // Write the completion file
  const outputPath = path.join(outputDir, outputFilename);
  try {
    fs.writeFileSync(outputPath, completionContent);
  } catch (error: any) {
    if (error.code === 'EACCES') {
      const localPath = path.join(process.cwd(), path.basename(outputPath));
      fs.writeFileSync(localPath, completionContent);
      console.log(`Warning: Permission denied when writing to the shell folder. Writing to current directory instead: ${localPath}`);
    } else {
      throw error;
    }
  }

  console.log(`Generated ${shellType} completion script at: ${outputPath}`);

  // Add shell-specific instructions
  console.log('\nSetup instructions:');
  switch (shellType) {
    case 'bash':
      console.log(`1. Add the following line to your ~/.bashrc:`);
      console.log(`   source "${outputPath}"`);
      console.log('2. Reload your shell or run: source ~/.bashrc');
      break;
    case 'zsh':
      console.log(`1. Ensure the completion directory is in your fpath. Add to ~/.zshrc if needed:`);
      console.log(`   fpath=(${outputDir} $fpath)`);
      console.log('2. Reload your shell or run: source ~/.zshrc');
      break;
    case 'fish':
      console.log('Completions will be automatically loaded on next shell start');
      console.log('To load immediately, run: source ~/.config/fish/completions/*');
      break;
  }
}

// Example usage:
// generateCompletions('path/to/config.json', 'path/to/output/dir', 'bash');
// generateCompletions('path/to/config.json', 'path/to/output/dir', 'zsh');
// generateCompletions('path/to/config.json', 'path/to/output/dir', 'fish');