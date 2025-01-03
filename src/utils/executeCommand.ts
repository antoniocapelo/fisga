import { spawn } from 'child_process'
import { ICommand } from '../types.js'

interface ExecuteCommandOptions {
  command: string
  cwd?: string
  onReady?: ICommand['onReady']
}

const isRegExp = (value: any) => Object.prototype.toString.call(value) === '[object RegExp]';

export function executeCommand({ command, cwd, onReady }: ExecuteCommandOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    // Split command into command and args
    const [cmd, ...args] = command.split(' ')

    console.log(`Executing '${command}' in ${cwd || 'current directory'}`)

    const childProcess = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      cwd
    })

    childProcess.stdout.on('data', (data) => {
      const output = data.toString()
      process.stdout.write(output)

      // Check for ready pattern if provided
      if (onReady?.pattern && onReady.stdinInput) {
        let hasMatch = true
        if (isRegExp(onReady.pattern)) {
          hasMatch = (onReady.pattern as unknown as RegExp).test(output);
        } else {
          hasMatch = (output.includes(onReady.pattern))
        }

        if (hasMatch) {
          (childProcess.stdin as any)?.write(onReady.stdinInput)
        }
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

    process.on('SIGINT', () => {
      childProcess.kill('SIGINT');
      process.exit(0);
    })
  })
}
