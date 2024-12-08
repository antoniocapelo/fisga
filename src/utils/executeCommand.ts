import { spawn } from 'child_process'

interface ExecuteCommandOptions {
  command: string
  onReady?: {
    pattern: RegExp
    callback: () => void
  }
}

export function executeCommand({ command, onReady }: ExecuteCommandOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    // Split command into command and args
    const [cmd, ...args] = command.split(' ')
    
    const childProcess = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    })

    childProcess.stdout.on('data', (data) => {
      const output = data.toString()
      process.stdout.write(output)

      // Check for ready pattern if provided
      if (onReady?.pattern && onReady.pattern.test(output)) {
        onReady.callback()
      }
    })

    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data.toString())
    })

    childProcess.on('error', (error) => {
      reject(error)
    })

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })
  })
}
