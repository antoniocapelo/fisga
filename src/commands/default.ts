import {Args, Command, Flags} from '@oclif/core'
import * as fs from 'fs'
import * as path from 'path'
import { select } from '@inquirer/prompts'
import { executeCommand } from '../utils/executeCommand.js'
import { interpretCommand } from '../utils/interpretCommand.js'

export default class DefaultCommand extends Command {
//   static args = {
//     person: Args.string({description: 'Person to say hello to', required: true}),
//   }

  static description = 'Some default command'

  static examples = [
    `<%= config.bin %> <%= command.id %> friend --from oclif
hello friend from oclif! (./src/commands/hello/index.ts)
`,
  ]

//   static flags = {
//     from: Flags.string({char: 'f', description: 'Who is saying hello', required: true}),
//   }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(DefaultCommand)

    // Read config file
    const configPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      'config.json'
    )
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'))

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
