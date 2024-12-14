import { confirm, select } from '@inquirer/prompts'
import { Args, Command } from '@oclif/core'
import * as fs from 'fs'
import os from 'os'
import path from 'path'
import { findCommand } from './findCommand.js'
import { Config } from './types.js'
import { interpretCommand, runSetup } from './utils/interpretCommand.js'

export default class DefaultCommand extends Command {
  static args = {
    config: Args.string({
      description: 'Path to config file',
      required: true,
    }),
  }

  static description = 'Run commands from a config file'

  static examples = [
    '<%= config.bin %> path/to/config.json',
  ]

  static strict: boolean = false;

  async run(): Promise<void> {
    const { args, argv } = await this.parse(DefaultCommand)
    const remainingArgs = Array.from(argv).slice(1);
    const argsPath = remainingArgs.join('.').replaceAll(' ', '.').replaceAll(':', '.')

    this.log(`running my command with args: ${argsPath}`)

    // Read config file
    const configData = JSON.parse(fs.readFileSync(args.config, 'utf8')) as Config;

    // Determine user config path from setup.dir
    const userConfigPath = path.join(
      configData.setup.configFileDirname.replace('$HOME', os.homedir()),
      'config.json'
    )


    // Check for user config    // const remainingArgs = Array.from(ar    // const remainingArgs = Array.from(argv).slice(1);
    // const argsPath = remainingArgs.join('.').replaceAll(' ', '.').replaceAll(':', '.')gv).slice(1);
    // const argsPath = remainingArgs.join('.').replaceAll(' ', '.').replaceAll(':', '.')
    try {
      await fs.promises.access(userConfigPath)
    } catch {
      console.log('No user config found. Please run setup first.')
      const runSetupNow = await confirm({
        message: 'Would you like to run setup now?',
        default: true
      })
      
      if (runSetupNow) {
        await runSetup(configData.setup)
        return
      }
      process.exit(1)
    }

    // check if args match a command
  
    this.log('getting match', argsPath)
    const match = findCommand(configData.commands, argsPath)

    if (!!match) {
      await interpretCommand(match, configData.setup.configFileDirname)
      return
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
        {
          name: 'setup',
          description: 'Run setup again',
          value: { name: 'setup', isSetup: true }
        }
      ]
    })

    if (selectedTask.isSetup) {
      return runSetup(configData.setup)
    }

    await interpretCommand(selectedTask, configData.setup.configFileDirname)
  }
}
