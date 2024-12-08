import { input, select, confirm, checkbox } from '@inquirer/prompts'
import { executeCommand } from './executeCommand.js'

// Base interface for all argument types
interface BaseCommandArg {
  description: string
  required: boolean
}

// Specific interfaces for each type
interface InputCommandArg extends BaseCommandArg {
  type: 'input'
  default?:string
}

interface SelectCommandArg extends BaseCommandArg {
  type: 'select'
  choices: string[]
  default?: string
}

interface CheckboxCommandArg extends BaseCommandArg {
  type: 'checkbox'
  choices: string[]
  default?: string[]
}

interface ConfirmCommandArg extends BaseCommandArg {
  type: 'confirm'
  default?: boolean
}

// Union type of all possible argument types
type CommandArg = InputCommandArg | SelectCommandArg | CheckboxCommandArg | ConfirmCommandArg

interface Command {
  name: string
  command: string
  description: string
  args?: Record<string, CommandArg>
}

function getDefaultValueForArg(arg:CommandArg) {
  if (typeof arg.default !== 'undefined') {
    return arg.default
  }
  switch (arg.type) {
    case 'input': return '';
    case 'checkbox': return [];
    case 'confirm': return false;
    case 'select': return '';
  }

}
export async function interpretCommand(selectedTask: Command): Promise<void> {
  if (!selectedTask.args) {
    return executeCommand({ command: selectedTask.command })
  }

  const gatheredArgs: Record<string, string> = {}
  
  for (const [argName, argConfig] of Object.entries(selectedTask.args)) {
    let value: any
    const defaultValue = getDefaultValueForArg(argConfig)

    switch (argConfig.type) {
      case 'confirm':
        const confirmed = await confirm({
          message: argConfig.description,
          default: argConfig.default
        })
        if (!confirmed) {
          console.log('Operation cancelled by user')
          return
        }
        continue

      case 'input':
        value = await input({
          message: argConfig.description,
          required: argConfig.required,
          default: ''
        })
        break

      case 'select':
        value = await select({
          message: argConfig.description,
          choices: argConfig.choices.map(choice => ({
            name: choice,
            value: choice
          })),
        })
        break

      case 'checkbox':
        value = await checkbox({
          message: argConfig.description,
          choices: argConfig.choices.map(choice => ({
            name: choice,
            value: choice
          }))
        })
        if (Array.isArray(value)) {
          value = value.join(',')
        }
        break
    }
    
    if (value) {
      gatheredArgs[argName] = value
    }
  }

  let finalCommand = selectedTask.command
  for (const [argName, value] of Object.entries(gatheredArgs)) {
    finalCommand = finalCommand.replace(`{${argName}}`, value)
  }

  return executeCommand({ command: finalCommand })
}