import { confirm, select, input } from '@inquirer/prompts'
import { Args, Command } from '@oclif/core'
import * as fs from 'fs'
import os from 'os'
import path from 'path'
import { findCommand } from './findCommand.js'
import { Config, ICommand } from './types.js'
import { interpretCommand, runSetup } from './utils/interpretCommand.js'

export default class DefaultCommand extends Command {
  static args = {
    config: Args.string({
      description: 'Path to config file',
      required: false,
    }),
  }

  static flags = {};

  static description = 'Run commands from a config file or generate one from package.json'

  static examples = [
    '<%= config.bin %> path/to/config.json',
    '<%= config.bin %>  # Will prompt for package.json location',
  ]

  static strict: boolean = false;

  private createNestedStructure(scripts: Record<string, string>, dirname: string): ICommand[] {
    const rootCommands: ICommand[] = [];
    const commandGroups: Record<string, ICommand> = {};

    // First pass: organize scripts into groups
    Object.entries(scripts).forEach(([name, script]) => {
      const parts = name.split(':');

      if (parts.length === 1) {
        // Non-nested command
        rootCommands.push({
          name,
          description: `Run npm script: ${script}`,
          command: `npm run ${name}`,
          dirname
        });
      } else {
        // Nested command
        const groupName = parts[0];
        const restOfName = parts.slice(1).join(':');

        // Initialize group if it doesn't exist
        if (!commandGroups[groupName]) {
          commandGroups[groupName] = {
            name: groupName,
            description: `${groupName} related commands`,
            commands: [],
            dirname
          };

          // If we have a base command (e.g., "git" for "git:push"),
          // add it as "main" under the nested structure
          if (scripts[groupName]) {
            commandGroups[groupName].commands!.push({
              name: 'main',
              description: `Run main ${groupName} script: ${scripts[groupName]}`,
              command: `npm run ${groupName}`,
            });
          }
        }

        // Add nested command
        commandGroups[groupName].commands!.push({
          name: restOfName,
          description: `Run npm script: ${script}`,
          command: `npm run ${name}`,
        });
      }
    });

    // Add all groups to root commands
    Object.values(commandGroups).forEach(group => {
      rootCommands.push(group);
    });

    return rootCommands.filter(c => {
      const repeatedGroup = rootCommands.find(e => e.name === c.name && e.description !== c.description);
      if (!repeatedGroup) {
        return true
      }

      if (repeatedGroup.commands) {
        return false
      }
      return true;
    });
  }

  private async generateConfigFromPackageJson(packageJsonPath: string): Promise<Config> {
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageData.scripts || {};

    // Ask user where to save the generated config
    const appName = await input({
      message: 'What is the name of your CLI?',
      required: true
    });

    const name = appName.toLocaleLowerCase().replaceAll(' ', '-')

    // Create basic config structure
    const config: Config = {
      name,
      setup: {
        configFileDirname: path.join('$HOME', '.config', name),
        steps: []
        // Add other setup defaults as needed
      },
      commands: this.createNestedStructure(scripts, packageJsonPath.replace('package.json', ''))
    };

    // Ask user where to save the generated config
    const configDir = await input({
      message: 'Where would you like to save the config file?',
      default: '.',
    });

    // Ensure directory exists
    await fs.promises.mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, 'config.json');

    // Write config file
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );

    console.log(`Generated config file at: ${configPath}`);
    return config;
  }

  async run(): Promise<void> {
    const { args, argv } = await this.parse(DefaultCommand)

    let configData: Config;

    if (!args.config) {
      const packageJsonPath = await input({
        message: 'No config file provided.\nIf you want to generate one based on an existing package.json, please provide its path:',
        default: 'package.json',
      });

      try {
        await fs.promises.access(packageJsonPath);
        configData = await this.generateConfigFromPackageJson(packageJsonPath);
      } catch (error) {
        console.error(`Error accessing package.json at ${packageJsonPath}`);
        process.exit(1);
      }
    } else {
      // Existing config file logic
      configData = JSON.parse(fs.readFileSync(args.config, 'utf8')) as Config;
    }

    const remainingArgs = Array.from(argv).slice(1);
    const argsPath = remainingArgs.join('.').replaceAll(' ', '.').replaceAll(':', '.');

    // Determine user config path from setup.dir
    const userConfigPath = path.join(
      configData.setup.configFileDirname.replace('$HOME', os.homedir()),
      'config.json'
    );

    try {
      await fs.promises.access(userConfigPath);
    } catch {
      console.log('No user config found. Please run setup first.');
      const runSetupNow = await confirm({
        message: 'Would you like to run setup now?',
        default: true
      });

      if (runSetupNow) {
        await runSetup(configData.setup);
        return;
      }
      process.exit(1);
    }

    const setupCommand = {
      name: 'Setup',
      description: 'Run the user setup step',
      value: { name: 'Setup', isSetup: true }
    }

    // check if args match a command
    const commandMatch = findCommand([...configData.commands, setupCommand], argsPath);

    if (argsPath.length > 1 && !commandMatch) {
      console.log(`\nUnknown command "${argsPath}"\n`)
    }

    if (!!commandMatch) {
      if (commandMatch.command.name === 'Setup') {
        return runSetup(configData.setup);
      }
      await interpretCommand(commandMatch.command, configData.setup.configFileDirname, commandMatch.cwd ? [commandMatch.cwd]:undefined);
      return;
    }

    // Present task options to user
    const selectedTask: any = await select({
      message: 'Select a task to run:',
      choices: [
        ...configData.commands.map((task: any) => ({
          name: `${task.name}`,
          description: task.description,
          value: task
        })),
        setupCommand
      ]
    });

    if (selectedTask.isSetup) {
      return runSetup(configData.setup);
    }

    await interpretCommand(selectedTask, configData.setup.configFileDirname);
  }
}