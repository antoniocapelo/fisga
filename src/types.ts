// Base interface for all argument types
interface BaseCommandArg {
  description: string
  required: boolean
}

// Specific interfaces for each type
interface InputCommandArg extends BaseCommandArg {
  type: 'input'
  default?: string
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

interface BooleanCommandArg extends BaseCommandArg {
  type: 'boolean'
  default?: boolean
}

// Add new regexp interface
interface RegexpCommandArg extends BaseCommandArg {
  type: 'regexp'
  glob?: string // Optional glob pattern to limit search scope
  ignore?: string[]
  includeDirectories?: boolean
}

// Union type of all possible argument types
export type CommandArg = InputCommandArg | SelectCommandArg | CheckboxCommandArg | ConfirmCommandArg | RegexpCommandArg | BooleanCommandArg

export interface ICommand {
  name: string
  description: string
  args?: Record<string, CommandArg>
  command?: string
  commands?: ICommand[]
  dirname?: string
  onReady?: {
    pattern?: string;
    stdinInput?: string | RegExp;
  }
}


export type Config = {
  commands: ICommand[],
  setup?: Setup
  name: string;
  description?: string;
}

export interface SetupStep {
  name: string
  description: string
  type: CommandArg['type']
  choices?: string[] // For select and checkbox types
  default?: any
}

export interface Setup {
  configFileDirname: string
  steps: SetupStep[]
}
