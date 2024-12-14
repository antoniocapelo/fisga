import { Help } from '@oclif/core'
import * as fs from 'fs'
import * as path from 'path'
import { Config } from '../types.js'
import { getHelpForPath } from '../findCommand.js'

export default class ConfigurableHelp extends Help {
  async showHelp(argv: string[]) {
    // Check for config file in arguments
    const configArg = argv[1]
    const remainingArgs = Array.from(argv).slice(2).filter(e => e !== '-h' && e !== '--help');
    const argsPath = remainingArgs.join('.').replaceAll(' ', '.').replaceAll(':', '.')

    if (configArg) {
      try {
        const config = JSON.parse(fs.readFileSync(path.resolve(configArg), 'utf8'))
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