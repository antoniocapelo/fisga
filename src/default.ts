import { input, select, confirm } from '@inquirer/prompts'
import { Args, Command, Flags } from '@oclif/core'
import * as fs from 'fs'
import os from 'os'
import path from 'path'
import { findCommand } from './findCommand.js'
import { Config } from './types.js'
import { interpretCommand, runAutocomplete, runSetup } from './utils/interpretCommand.js'
import { generateConfigFromPackageJson } from './utils/generatePackageJsonConfig.js'
import { print } from './utils/print.js'
import { readFileSync } from 'fs'

// Read package.json for version
let version: string | undefined
try {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  version = packageJson?.version
} catch (error) {
  // Silently handle missing or invalid package.json
  version = undefined
}

export default class DefaultCommand extends Command {
  static args = {}

  static flags = {
    package: Flags.string(),
    config: Flags.string({
      description: 'Path to config file',
      required: false,
    }),
    version: Flags.boolean({
      char: 'v',
      description: 'Show CLI version',
    }),
    'cli-version': Flags.string({
      description: 'Set CLI version',
      required: false,
    }),
  };

  static description = 'Run commands from a config file or generates them based on a package json'

  static examples = [
    '<%= config.bin %>  # Will prompt for a config file or a package.json',
    '<%= config.bin %> --config=path/to/config.json',
    '<%= config.bin %> --package=path/to/package.json',
  ]

  static strict: boolean = false;

  async run(): Promise<void> {
    const { argv, flags } = await this.parse(DefaultCommand)

    // Use provided CLI version or fallback to package.json version
    const cliVersion = flags['cli-version'] || version

    // Handle version flag first
    if (flags.version) {
      console.log(cliVersion || 'Version information not available')
      return
    }

    let configData: Config | undefined = undefined;

    const providedPackageJson = flags.package;

    if (providedPackageJson) {
      console.log('Running fisga on top of an existing package.json\n')
      configData = await generateConfigFromPackageJson(providedPackageJson, false);
    }

    if (!configData) {
      if (!flags.config) {
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
            }]
        })

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
        configData = JSON.parse(fs.readFileSync(flags.config, 'utf8')) as Config;
      }
    }

    const cmdArgs = Array.from(argv);
    const argsPath = cmdArgs.join('.').replaceAll(' ', '.').replaceAll(':', '.');


    const hasSetupStep = !!configData.setup;
    const hasAutocompleteStep = !!configData.generateAutocomplete;

    const setupCommand = {
      name: 'Setup',
      description: 'Run the user setup step',
      value: { name: 'Setup', isSetup: true }
    }

    const autocompleteCommand = {
      name: 'Autocomplete',
      description: 'Install autocompletions for the CLI',
      value: { name: 'Autocomplete' }
    }

    // check if args match a command
    const comms = [...configData.commands];
    if (hasSetupStep) {
      comms.push(setupCommand)
    }

    if (hasAutocompleteStep) {
      comms.push(autocompleteCommand)
    }

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

    const commandMatch = findCommand(comms, argsPath);

    print(argsPath, commandMatch)

    if (argsPath.length > 1 && !commandMatch) {
      console.log(`\nUnknown command "${argsPath}"\n`)
      process.exit(1)
    }

    if (!!commandMatch) {
      if (hasSetupStep && commandMatch.command.name === 'Setup') {
        return runSetup(configData.setup!!);
      }
      if (commandMatch.command.name === 'Autocomplete') {
        return runSetup(configData.setup!!);
      }
      await interpretCommand(commandMatch.command, configData?.setup?.configFileDirname || '', commandMatch.cwd ? [commandMatch.cwd] : undefined);
      return;
    }


    if (!providedPackageJson) {
      const description = configData.description ? ` - ${configData.description}` : ''

      console.log(`${configData.name} ${description}`)
      if (cliVersion && cliVersion.length > 0) {
        console.log(`version ${cliVersion}\n`)
      }
    }

    // Present task options to user
    const selectedTask: any = await select({
      message: 'Select a task to run:',
      choices: comms.map((task: any) => ({
        name: `${task.name}`,
        description: task.description,
        value: task
      })),
    });

    if (selectedTask.isSetup) {
      return runSetup(configData.setup!!);
    }

    if (selectedTask.name === 'Autocomplete') {
      return runAutocomplete(configData)
    }

    await interpretCommand(selectedTask, configData?.setup?.configFileDirname || '');
  }
}