import { ICommand } from "./types.js";

const toKebabCase = (s: string) => s.replaceAll(' ', '-').toLowerCase()

export function findCommand(availableCommands: ICommand[], providedCommand: string): ICommand | undefined {
  const [first, ...rest] = providedCommand.split('.');

  const match = availableCommands.find(cmd => toKebabCase(cmd.name) === toKebabCase(first));
  if (!match) return undefined;

  if (rest.length === 0) return match;
  if (!match.commands) return undefined;

  return findCommand(match.commands, rest.join('.'));
}

function printHelpForCommand(comm: ICommand) {
  console.log(`${comm.name}\t\t${comm.description}`)
}

export function getHelpForPath(commands: ICommand[], path: string): void {
  const match = findCommand(commands, path);

  if (match) {
    if (match?.command) {
      printHelpForCommand(match)
    }

    if (match?.commands) {
      if (match?.description) {
      }

      console.log('Available commands:')
      match.commands.forEach(printHelpForCommand)
    }
  } else {
    commands.forEach(printHelpForCommand)
  }

}