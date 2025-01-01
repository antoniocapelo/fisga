import { ICommand } from "./types.js";
import { print } from "./utils/print.js";

const toKebabCase = (s: string) => s.replaceAll(' ', '-').toLowerCase()

export function findCommand(availableCommands: ICommand[], providedCommands: string, cwd?: string): {
  command: ICommand,
  cwd?: string
} | undefined {
  // Using a '.' split because users might do pass "nested.command.name" or "nested command name"
  // we start with the first level of the provided commands
  const [first, ...rest] = providedCommands.split('.');


  const match = availableCommands.find(cmd => toKebabCase(cmd.name) === toKebabCase(first));

  // if there's not a match for the current command (first), return early
  if (!match) return undefined;

  // If no more commands were provided (just the first level), return the match and its  dirname as cwd
  if (rest.length === 0) {
    return {
      command: match,
      cwd: match.dirname || cwd
    };
  }

  // Otherwise we have more commands to parse

  // if we have more commands to parse but the current match does not have inner commands,
  // something went wrong
  if (!match.commands) return undefined;

  // Otherwise, try to find the nested command
  return findCommand(match.commands, rest.join('.'), match.dirname || cwd);
}

function printHelpForCommand(comm: ICommand) {
  console.log(`${comm.name}\t\t${comm.description}`)
}

export function getHelpForPath(commands: ICommand[], path: string): void {
  const match = findCommand(commands, path);

  if (match) {
    if (match?.command) {
      printHelpForCommand(match.command)
    }

    if (match?.command.commands) {
      if (match?.command.description) {
        console.log(match.command.description)
      }

      console.log('Available commands:')
      match.command.commands.forEach(printHelpForCommand)
    }
  } else {
    commands.forEach(printHelpForCommand)
  }

}