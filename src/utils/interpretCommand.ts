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
type CommandArg = InputCommandArg | SelectCommandArg | CheckboxCommandArg | ConfirmCommandArg | RegexpCommandArg

interface Command {
  name: string
  command?: string
  description: string
  args?: Record<string, CommandArg>
  commands?: Command[]
  dirname?: string
}

async function selectCommand(commands: Command[]): Promise<Command> {
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

async function getCommandDirectory(command: Command, parentDirs: string[] = []): Promise<string | undefined> {
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

export async function interpretCommand(selectedTask: Command, parentDirs: string[] = []): Promise<void> {
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