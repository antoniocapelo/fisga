import { input } from '@inquirer/prompts';
import path from 'path'
import * as fs from 'fs';
import { Config, ICommand } from "../types.js";
import { print } from './print.js';

function createNestedStructure(scripts: Record<string, string>, dirname: string): ICommand[] {
  const rootCommands: ICommand[] = [];
  const commandGroups: Record<string, ICommand> = {};

  // First pass: organize scripts into groups
  Object.entries(scripts).forEach(([name, script]) => {
    const parts = name.split(':');

    if (parts.length === 1) {
      // Non-nested command
      rootCommands.push({
        name,
        description: `Run npm script: ${script}`,
        command: `npm run ${name}`,
        dirname
      });
    } else {
      // Nested command
      const groupName = parts[0];
      const restOfName = parts.slice(1).join(':');

      // Initialize group if it doesn't exist
      if (!commandGroups[groupName]) {
        commandGroups[groupName] = {
          name: groupName,
          description: `${groupName} related commands`,
          commands: [],
          dirname
        };

        // If we have a base command (e.g., "git" for "git:push"),
        // add it as "main" under the nested structure
        if (scripts[groupName]) {
          commandGroups[groupName].commands!.push({
            name: 'main',
            description: `Run main ${groupName} script: ${scripts[groupName]}`,
            command: `npm run ${groupName}`,
          });
        }
      }

      // Add nested command
      commandGroups[groupName].commands!.push({
        name: restOfName,
        description: `Run npm script: ${script}`,
        command: `npm run ${name}`,
      });
    }
  });

  // Add all groups to root commands
  Object.values(commandGroups).forEach(group => {
    rootCommands.push(group);
  });

  return rootCommands.filter(c => {
    const repeatedGroup = rootCommands.find(e => e.name === c.name && e.description !== c.description);
    if (!repeatedGroup) {
      return true
    }

    if (repeatedGroup.commands) {
      return false
    }
    return true;
  });
}

export async function generateConfigFromPackageJson(packageJsonPath: string, createFile: boolean): Promise<Config> {
  const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageData.scripts || {};

  // Ask user where to save the generated config
  const appName = createFile ? await input({
    message: 'What is the name of your CLI?',
    required: true
  }): 'temp-app';

  const name = appName.toLocaleLowerCase().replaceAll(' ', '-')

  const filePath = path.resolve(packageJsonPath.replace('package.json', '')) 

  // Create basic config structure
  const config: Config = {
    name,
    commands: createNestedStructure(scripts, filePath)
  };


  if (createFile) {
    // Ask user where to save the generated config
    const configDir = await input({
      message: 'Where would you like to save the config file?',
      default: '.',
    });

    // Ensure directory exists
    await fs.promises.mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, 'config.json');

    // Write config file
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );

    console.log(`Generated config file at: ${configPath}`);

  }

  return config;
}
