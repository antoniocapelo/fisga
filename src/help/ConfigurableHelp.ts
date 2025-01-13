import { Help } from '@oclif/core'
import * as fs from 'fs'
import * as path from 'path'
import { Config } from '../types.js'
import { getHelpForPath } from '../findCommand.js'

export default class ConfigurableHelp extends Help {
  async showHelp(argv: string[]) {
    // Find config argument using --config flag
    const configArgIndex = argv.findIndex(arg => arg.startsWith('--config'))
    let configPath: string | undefined
    
    if (configArgIndex !== -1) {
      const configArg = argv[configArgIndex]
      if (configArg === '--config') {
        // Handle --config path-to-config format
        configPath = argv[configArgIndex + 1]
        // Remove both the flag and path from argv
        argv.splice(configArgIndex, 2)
      } else {
        // Handle --config=path-to-config format
        configPath = configArg.split('=')[1]
        // Remove the combined flag from argv
        argv.splice(configArgIndex, 1)
      }
    }

    const remainingArgs = Array.from(argv).filter(e => e !== '-h' && e !== '--help');
    const argsPath = remainingArgs.slice(1).join('.').replaceAll(' ', '.').replaceAll(':', '.')

    if (configPath) {
      try {
        const config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8'))
        // Customize help output based on config
        // You can override various Help methods here
        return this.showCustomHelp(config, argsPath)
      } catch (error) {
        console.error('Error loading config file:', error)
      }
    }

    // Fall back to default help if no config or error
    return super.showHelp(argv)
  }

  private async showCustomHelp(config: Config, argsPath: string) {
    // Implement custom help rendering based on config
    // You can access config.commands, config.description, etc.
    // and format them as needed
    if (!argsPath.length) {
      this.log(config.name)
      if (config.description) {
        this.log(`${config.description}\n`)
      }
    }
    getHelpForPath(config.commands, argsPath)
  }
} 