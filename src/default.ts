import { Args, Command } from '@oclif/core'
import * as fs from 'fs'
import { select } from '@inquirer/prompts'
import { CommandArg, interpretCommand } from './utils/interpretCommand.js'

function runSetup() {

} 

type Setup = {
  dir: string;
  steps: {
    name: string;
    description: string;
    type: CommandArg['type'];
  }
}

type Config = {
  comands: CommandArg[],
  setup: Setup
}

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

  async run(): Promise<void> {
    const { args } = await this.parse(DefaultCommand)

    // Read config file
    const configData = JSON.parse(fs.readFileSync(args.config, 'utf8'))
    runSetup
    const choices = configData.commands;
    choices.push({
      name: "Setup",
      description: "Run setup",
      value: "setup"
    })

    // Present task options to user
    const selectedTask: any = await select({
      message: 'Select a task to run:',
      choices: choices.map((task: any) => ({
        name: `${task.name}`,
        description: task.description,
        value: task
      }))
    })

    if (selectedTask.value === 'setup') {
      await runSetup(configData)
      return
    }

    await interpretCommand(selectedTask)
  }
}
