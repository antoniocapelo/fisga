import { input, select, confirm, checkbox, } from '@inquirer/prompts'
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

  static description = 'Run commands from a config file, a package json, or generates a config file based on a package.json'

  static examples = [
    '<%= config.bin %> path/to/config.json',
    '<%= config.bin %>  # Will prompt for package.json location',
  ]

  static strict: boolean = false;

  async run(): Promise<void> {
    const { args, argv } = await this.parse(DefaultCommand)

    let configData: Config;

    if (!args.config) {
      console.log('No config file provided.')
      const packageJsonPath = await input({
        message: 'If you want to use an existing package.json, please provide its path:',
        default: 'package.json',
      });

      const answer = await select({
  message: 'How do you want to use this package.json?',
  choices: [
    {
      name: 'Create a config file based on my package.json',
      value: 'yes',
    },
    {
      name: 'Just present the package.json scripts in a friendly UI',
      value: 'no',
    }]})

      const createFile = answer === 'yes';

      try {
        await fs.promises.access(packageJsonPath);
        configData = await generateConfigFromPackageJson(packageJsonPath, createFile);
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


    const hasSetupStep = !!configData.setup;

    if (hasSetupStep) {
      // Determine user config path from setup.dir
      const userConfigPath = path.join(
        configData.setup!!.configFileDirname.replace('$HOME', os.homedir()),
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
          await runSetup(configData.setup!!);
          return;
        }
        process.exit(1);
      }
    }

    const setupCommand = {
      name: 'Setup',
      description: 'Run the user setup step',
      value: { name: 'Setup', isSetup: true }
    }

    // check if args match a command
    const comms = hasSetupStep ? [...configData.commands, setupCommand] : configData.commands;
    const commandMatch = findCommand(comms, argsPath);

    if (argsPath.length > 1 && !commandMatch) {
      console.log(`\nUnknown command "${argsPath}"\n`)
    }

    if (!!commandMatch) {
      if (hasSetupStep && commandMatch.command.name === 'Setup') {
        return runSetup(configData.setup!!);
      }
      await interpretCommand(commandMatch.command, configData?.setup?.configFileDirname || '', commandMatch.cwd ? [commandMatch.cwd] : undefined);
      return;
    }

    // Present task options to user
    const selectedTask: any = await select({
      message: 'Select a task to run:',
      choices: hasSetupStep ? [
        ...configData.commands.map((task: any) => ({
          name: `${task.name}`,
          description: task.description,
          value: task
        })),
        setupCommand
      ] : configData.commands.map((task: any) => ({
        name: `${task.name}`,
        description: task.description,
        value: task
      }))
    });

    if (selectedTask.isSetup) {
      return runSetup(configData.setup!!);
    }

    await interpretCommand(selectedTask, configData?.setup?.configFileDirname || '');
  }
}