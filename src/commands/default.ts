import {Args, Command} from '@oclif/core'
import * as fs from 'fs'
import { select } from '@inquirer/prompts'
import { interpretCommand } from '../utils/interpretCommand.js'

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
    const {args} = await this.parse(DefaultCommand)

    // Read config file
    const configData = JSON.parse(fs.readFileSync(args.config, 'utf8'))

    // Present task options to user
    const selectedTask: any = await select({
      message: 'Select a task to run:',
      choices: configData.commands.map((task: any) => ({
        name: `${task.name} - ${task.description}`,
        value: task
      }))
    })

    await interpretCommand(selectedTask)
  }
}
