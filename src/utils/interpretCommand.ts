import { input, select, confirm, checkbox, } from '@inquirer/prompts'
import autocomplete from 'inquirer-autocomplete-standalone';
import { executeCommand } from './executeCommand.js'
import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'
import * as os from 'os'

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

// Add new regexp interface
interface RegexpCommandArg extends BaseCommandArg {
  type: 'regexp'
  glob?: string // Optional glob pattern to limit search scope
}

// Union type of all possible argument types
export type CommandArg = InputCommandArg | SelectCommandArg | CheckboxCommandArg | ConfirmCommandArg | RegexpCommandArg

export interface ICommand {
  name: string
  command?: string
  description: string
  args?: Record<string, CommandArg>
  commands?: ICommand[]
  dirname?: string
}

async function selectCommand(commands: ICommand[]): Promise<ICommand> {
  return select({
    message: 'Select a command to run:',
    choices: commands.map(cmd => ({
      name: `${cmd.name} - ${cmd.description}`,
      value: cmd
    }))
  })
}

function fuzzyMatch(pattern: string, str: string): boolean {
  pattern = pattern.toLowerCase()
  str = str.toLowerCase()
  
  let patternIdx = 0
  let strIdx = 0
  
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++
    }
    strIdx++
  }
  
  return patternIdx === pattern.length
}

async function getCommandDirectory(command: ICommand, parentDirs: string[] = []): Promise<string | undefined> {
  return command.dirname || parentDirs[parentDirs.length - 1]
}

// Add this function to load user config
async function loadUserConfig(): Promise<Record<string, string>> {
  const configPath = path.join(os.homedir(), '.config', 'fisga', 'user-config.json')
  try {
    const config = await fs.promises.readFile(configPath, 'utf-8')
    return JSON.parse(config)
  } catch (error) {
    return {}
  }
}

export async function interpretCommand(selectedTask: ICommand, parentDirs: string[] = []): Promise<void> {
  const currentDirs = [...parentDirs]
  if (selectedTask.dirname) {
    currentDirs.push(selectedTask.dirname)
  }

  // If this is a parent command with nested commands, present selection
  if (selectedTask.commands) {
    const subCommand = await selectCommand(selectedTask.commands)
    return interpretCommand(subCommand, currentDirs)
  }

  // If no command specified, this is just a navigation node
  if (!selectedTask.command) {
    return
  }

  // Load user config early
  const userConfig = await loadUserConfig()

  // Get working directory and replace config placeholders
  let cwd = await getCommandDirectory(selectedTask, currentDirs)
  if (cwd) {
    for (const [key, value] of Object.entries(userConfig)) {
      cwd = cwd.replace(`{CONFIG.${key}}`, value)
    }
  }

  // Handle regular command execution
  if (!selectedTask.args) {
    let finalCommand = selectedTask.command
    for (const [key, value] of Object.entries(userConfig)) {
      finalCommand = finalCommand.replace(`{CONFIG.${key}}`, value)
    }
    return executeCommand({ command: finalCommand, cwd })
  }

  const gatheredArgs: Record<string, string> = {}
   
  for (const [argName, argConfig] of Object.entries(selectedTask.args)) {
    let value: any

    switch (argConfig.type) {
      case 'confirm':
        const confirmed = await confirm({
          message: argConfig.description,
          default: argConfig.default
        })
        if (!confirmed) {
          console.log("Operation cancelled by the user")
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

      case 'regexp':
        // Get all files first
        const files = await glob(argConfig.glob || '**/*', {
          ignore: ['node_modules/**', '.git/**'],
          nodir: true
        })

        // Use select with dynamic filtering
        value = await autocomplete({
          message: argConfig.description,
          source: async (input = '') => {
            if (!input) return files.map(file => ({ name: file, value: file }))
            
            const matches = files.filter(file => fuzzyMatch(input, file))
            return matches.map(file => ({ name: file, value: file }))
          }
        })

        if (!value) {
          console.log('No file selected')
          return
        }
        break
    }
    
    if (value) {
      gatheredArgs[argName] = value
    }
  }

  let finalCommand = selectedTask.command
  
  // Replace config placeholders first
  for (const [key, value] of Object.entries(userConfig)) {
    finalCommand = finalCommand.replace(`{CONFIG.${key}}`, value)
  }
  
  // Then replace command args
  for (const [argName, value] of Object.entries(gatheredArgs)) {
    finalCommand = finalCommand.replace(`{${argName}}`, value)
  }

  return executeCommand({ 
    command: finalCommand,
    cwd
  })
}

interface SetupStep {
  name: string
  description: string
  type: CommandArg['type']
  choices?: string[] // For select and checkbox types
  default?: any
}

interface Setup {
  dir: string
  steps: SetupStep[]
}

export async function runSetup(setup: Setup): Promise<void> {
  const collectedData: Record<string, any> = {}

  for (const step of setup.steps) {
    let value: any

    switch (step.type) {
      case 'input':
        value = await input({
          message: step.description,
          required: true,
          default: step.default
        })
        break

      case 'select':
        value = await select({
          message: step.description,
          choices: step.choices?.map(choice => ({
            name: choice,
            value: choice
          })) || []
        })
        break

      case 'checkbox':
        value = await checkbox({
          message: step.description,
          choices: step.choices?.map(choice => ({
            name: choice,
            value: choice
          })) || []
        })
        if (Array.isArray(value)) {
          value = value.join(',')
        }
        break

      case 'confirm':
        value = await confirm({
          message: step.description,
          default: step.default
        })
        break

      default:
        console.log(`Unsupported step type: ${step.type}`)
        continue
    }

    if (value !== undefined) {
      collectedData[step.name] = value
    }
  }

  // Replace $HOME with the user's home directory and add config.json
  const configPath = path.join(
    setup.dir.replace('$HOME', os.homedir()),
    'config.json'
  )
  
  try {
    // Create directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    
    // Write collected data to JSON file
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(collectedData, null, 2),
      'utf-8'
    )
    
    console.log(`Setup data saved to ${configPath}`)
  } catch (error) {
    console.error('Failed to save setup data:', error)
  }
}