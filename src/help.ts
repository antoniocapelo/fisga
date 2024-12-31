import { Help } from '@oclif/core'

export default class CustomHelp extends Help {
  async showRootHelp(): Promise<void> {
    // Check if help flag is present
    if (!process.argv.includes('-h') && !process.argv.includes('--help')) {
//      await this.config.runCommand('hello')
      return
    }

    return super.showRootHelp()
  }
}
    