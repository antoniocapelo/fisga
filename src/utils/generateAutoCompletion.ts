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
    local cur prev
    COMPREPLY=()
    cur="${'$'}{COMP_WORDS[COMP_CWORD]}"
    prev="${'$'}{COMP_WORDS[COMP_CWORD-1]}"
    
    case "${'$'}{COMP_WORDS[1]}" in`;

  function addCommandContext(cmds: ICommand[]) {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');

      completion += `\n        "${cmdName}")\n`;
      if (cmd.commands) {
        completion += `            case "${'$'}{COMP_WORDS[2]}" in\n`;
        completion += `                "")\n                    COMPREPLY=( $(compgen -W "`;
        completion += cmd.commands.map(subcmd =>
          subcmd.name.toLowerCase().replace(/\s+/g, '-')
        ).join(' ');
        completion += `" -- "${'$'}{cur}") )\n                    return 0\n                    ;;\n`;
        completion += `            esac\n`;
      }
      completion += `            return 0\n            ;;\n`;
    });
  }

  addCommandContext(config.commands);

  // Root level commands
  completion += `        *)\n            COMPREPLY=( $(compgen -W "`;
  completion += config.commands.map(cmd =>
    cmd.name.toLowerCase().replace(/\s+/g, '-')
  ).join(' ');
  completion += `" -- "${'$'}{cur}") )\n            return 0\n            ;;\n    esac
}

complete -F _${cliName}_completion ${cliName}`;

  return completion;
}

function generateZshCompletions(config: Config): string {
  const cliName = config.name.toLowerCase();
  let completion = `#compdef ${cliName}

_${cliName}_commands() {
    local -a commands
    local context="${'$'}words[1]"
    local subcontext="${'$'}words[2]"

    case "${'$'}context" in`;

  function addCommandContext(cmds: ICommand[], parentPath = '') {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');

      if (!parentPath) {
        // Root level command
        completion += `\n        "${cmdName}")\n            case "${'$'}subcontext" in\n`;
        if (cmd.commands) {
          completion += `                *)\n                    commands=(\n`;
          cmd.commands.forEach(subcmd => {
            const subcmdName = subcmd.name.toLowerCase().replace(/\s+/g, '-');
            completion += `                        "${subcmdName}:${subcmd.description}"\n`;
          });
          completion += `                    )\n                    ;;\n`;
        }
        completion += `            esac\n            ;;`;
      }

      if (cmd.commands) {
        addCommandContext(cmd.commands, cmdName);
      }
    });
  }

  addCommandContext(config.commands);

  // Root level
  completion += `\n        *)\n            commands=(\n`;
  config.commands.forEach(cmd => {
    completion += `                "${cmd.name.toLowerCase().replace(/\s+/g, '-')}:${cmd.description}"\n`;
  });
  completion += `            )\n            ;;\n    esac\n`;

  completion += `    _describe 'command' commands
}

_${cliName}() {
    local curcontext="${'$'}curcontext" state line
    typeset -A opt_args

    _arguments -C \
        '1: :_${cliName}_commands' \
        '*::arg:->args'

    case $state in
        args)
            _${cliName}_commands
            ;;
    esac
}

_${cliName}`;

  return completion;
}

function generateFishCompletions(config: Config): string {
  const cliName = config.name.toLowerCase();
  let completion = `# Fish completion for ${config.name}\n\n`;

  // Root level commands
  config.commands.forEach(cmd => {
    const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
    completion += `complete -c ${cliName} -f -n "__fish_use_subcommand" -a "${cmdName}" -d "${cmd.description}"\n`;

    if (cmd.commands) {
      // Subcommands
      cmd.commands.forEach(subcmd => {
        const subcmdName = subcmd.name.toLowerCase().replace(/\s+/g, '-');
        completion += `complete -c ${cliName} -f -n "__fish_seen_subcommand_from ${cmdName}" -a "${subcmdName}" -d "${subcmd.description}"\n`;
      });
    }
  });

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
  let permissionError = false;
  try {
    fs.writeFileSync(outputPath, completionContent);
    console.log(`Generated ${shellType} completion script at: ${outputPath}`);
  } catch (error: any) {
    if (error.code === 'EACCES') {
      permissionError = true;
      const localPath = path.join(process.cwd(), path.basename(outputPath));
      fs.writeFileSync(localPath, completionContent);
      console.log(`Warning: Permission denied when writing to the shell folder (${outputDir}).\nWriting to current directory instead: ${localPath}`);
      console.log(`Generated ${shellType} completion script.`);
    } else {
      throw error;
    }
  }


  // Add shell-specific instructions
  console.log('\nSetup instructions:');
  if (permissionError) {
    console.log(`Move the generated file to the ${outputDir}.`)
  }
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