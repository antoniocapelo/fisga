import { input, select, confirm, checkbox, } from '@inquirer/prompts'
import autocomplete from 'inquirer-autocomplete-standalone';
import { executeCommand } from './executeCommand.js'
import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'
import * as os from 'os'
import { Config, ICommand, Setup, SetupStep } from '../types.js';
import { print } from './print.js';
import { evaluateString } from './evaluateString.js';
import { generateCompletions, supportedShells } from './generateAutoCompletion.js';

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
  print({ parentDirs })
  return command.dirname || parentDirs[parentDirs.length - 1]
}

function sanitizeUserConfig(arg: any): any {
  if (typeof arg === 'string') {
    const homeDir = os.homedir()
    return arg
      // clearing trailing dashes
      .replace(/\/$/, '')
      // using correct home dir for cwd
      .replace('$HOME', homeDir)
      .replace('~', homeDir);
  }

  if (Array.isArray(arg)) {
    return (arg as any[]).map(e => sanitizeUserConfig(e))
  }

  if (typeof arg === 'object') {
    return Object.keys(arg).reduce((prev, curr) => {
      return {
        ...prev,
        [curr]: sanitizeUserConfig(arg[curr])
      }
    }, {})
  }

  return arg;
}

// Add this function to load user config
async function loadUserConfig(setupDir: string): Promise<Record<string, any>> {
  const homeDir = os.homedir()
  const configPath = path.join(
    setupDir.replace('$HOME', homeDir).replace('~', homeDir),
    'config.json'
  )

  const userConfigFile = await fs.promises.readFile(configPath, 'utf-8')
  const userConfigData = JSON.parse(userConfigFile);

  return sanitizeUserConfig(userConfigData)
}

export async function interpretCommand(selectedTask: ICommand, configFileDir: string, parentDirs: string[] = []): Promise<void> {
  const currentDirs = [...parentDirs]
  if (selectedTask.dirname) {
    currentDirs.push(selectedTask.dirname)
  }

  // If this is a parent command with nested commands, present selection
  if (selectedTask.commands) {
    const subCommand = await selectCommand(selectedTask.commands)
    return interpretCommand(subCommand, configFileDir, currentDirs)
  }

  // If no command specified, this is just a navigation node
  if (!selectedTask.command) {
    return
  }

  // Load user config early
  const userConfig = await loadUserConfig(configFileDir)

  // Get working directory and replace config placeholders
  let cwd = await getCommandDirectory(selectedTask, currentDirs)

  print('cwd', cwd)

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
    return executeCommand({ command: finalCommand, cwd, onReady: selectedTask.onReady, interactive: selectedTask.interactive })
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

      case 'boolean':
        value = await confirm({
          message: argConfig.description,
        })
        break

      case 'regexp':
        // Get all files first
        print(argConfig, cwd)
        const ig = argConfig.ignore || ['']
        const includeDir = !!argConfig.includeDirectories;

        console.log(`Searching in ${cwd ? cwd : 'current directory'}`)

        const files = await glob(argConfig.glob || '**/*', {
          ignore: ['node_modules/**', '.git/**', ...ig],
          nodir: !includeDir,
          dotRelative: true,
          cwd,
          // absolute: true
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

    if (typeof value !== 'undefined') {
      gatheredArgs[argName] = value
    }
  }


  let finalCommand = selectedTask.command


  // Replace config placeholders first
  for (const [key, value] of Object.entries(userConfig)) {
    finalCommand = finalCommand.replace(`{CONFIG.${key}}`, value)
  }

  // Then replace command args
  finalCommand = evaluateString(finalCommand, gatheredArgs)

  return executeCommand({
    command: finalCommand,
    cwd,
    onReady: selectedTask.onReady,
    interactive: selectedTask.interactive
  })
}

export async function runSetup(setup: Setup): Promise<void> {
  const collectedData: Record<string, any> = {}

  console.log('Running setup')

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
    setup.configFileDirname.replace('$HOME', os.homedir()),
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

    console.log(`Setup data ${collectedData} saved to ${configPath}`)
  } catch (error) {
    console.error('Failed to save setup data:', error)
  }
}

export async function runAutocomplete(config: Config): Promise<void> {
  const collectedData: Record<string, any> = {}

  console.log('Running Autocomplete')

  const value = await select({
    message: 'Choose your shell type',
    choices: supportedShells.map(choice => ({
      name: choice,
      value: choice
    }))
  })

  return generateCompletions(config, value)
}