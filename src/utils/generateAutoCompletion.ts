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

    # Get commands based on current context
    local commands=""
    case "$prev" in`;

  function addCommandContext(cmds: ICommand[], parentPath = '') {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      const fullPath = parentPath ? `${parentPath} ${cmdName}` : cmdName;

      completion += `\n        ${cmdName})\n`;
      if (cmd.commands) {
        const subcommands = cmd.commands.map(c => c.name.toLowerCase().replace(/\s+/g, '-')).join(' ');
        completion += `            commands="${subcommands};;"\n`;
        addCommandContext(cmd.commands, fullPath);
      }
      completion += `            ;;\n`;
    });
  }

  addCommandContext(config.commands);

  // Root level commands
  completion += `        *)\n`;
  completion += `            commands="${config.commands.map(c => c.name.toLowerCase().replace(/\s+/g, '-')).join(' ')}"\n`;
  completion += `            ;;\n    esac\n\n`;

  // Complete command names
  completion += `    if [[ "$cur" == -* ]]; then
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

_${cliName}_commands() {
    local -a commands
    
    case "$words[1]" in`;

  function addCommandContext(cmds: ICommand[], level = 1) {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      completion += `\n        ${cmdName})\n            commands=(\n`;
      if (cmd.commands) {
        cmd.commands.forEach(subcmd => {
          const subcmdName = subcmd.name.toLowerCase().replace(/\s+/g, '-');
          completion += `                "${subcmdName}:${subcmd.description}"\n`;
        });
      }
      completion += `            )\n            ;;`;
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
    _arguments -C \
        '1: :_${cliName}_commands' \
        '*::arg:->args'
}

_${cliName}`;

  return completion;
}

function generateFishCompletions(config: Config): string {
  const cliName = config.name.toLowerCase();
  let completion = `# Fish completion for ${config.name}\n\n`;

  function addCommands(cmds: ICommand[], parentCmd = '') {
    cmds.forEach(cmd => {
      const cmdName = cmd.name.toLowerCase().replace(/\s+/g, '-');
      const fullCmd = parentCmd ? `${parentCmd} ${cmdName}` : cmdName;

      if (parentCmd) {
        // Subcommand completion
        completion += `complete -c ${cliName} -f -n "__fish_seen_subcommand_from ${parentCmd}" -a "${cmdName}" -d "${cmd.description}"\n`;
      } else {
        // Root command completion
        completion += `complete -c ${cliName} -f -n "__fish_use_subcommand" -a "${cmdName}" -d "${cmd.description}"\n`;
      }

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
    console.log(`Generated ${shellType} completion script at: ${outputPath}`);
  } catch (error: any) {
    if (error.code === 'EACCES') {
      const localPath = path.join(process.cwd(), path.basename(outputPath));
      fs.writeFileSync(localPath, completionContent);
      console.log(`Warning: Permission denied when writing to the shell folder. Writing to current directory instead: ${localPath}`);
      console.log(`Generated ${shellType} completion script.`);
    } else {
      throw error;
    }
  }


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