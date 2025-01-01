import { confirm, input, select } from '@inquirer/prompts'
import { Args, Command } from '@oclif/core'
import * as fs from 'fs'
import os from 'os'
import path from 'path'
import { findCommand } from './findCommand.js'
import { Config } from './types.js'
import { interpretCommand, runSetup } from './utils/interpretCommand.js'
import { generateConfigFromPackageJson } from './utils/generatePackageJsonConfig.js'

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
        configData = await generateConfigFromPackageJson(packageJsonPath);
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
      await interpretCommand(commandMatch.command, configData.setup.configFileDirname, commandMatch.cwd ? [commandMatch.cwd] : undefined);
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