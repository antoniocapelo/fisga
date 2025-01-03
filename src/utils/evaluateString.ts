export const evaluateString = (input: string, context = {}) => {
  // Create a function that has access to context variables
  const evaluator = new Function(...Object.keys(context), `
    return \`${input.replace(/\{/g, '${')}\`;
  `);

  try {
    return evaluator(...Object.values(context));
  } catch (error) {
    return `Error evaluating: ${(error as unknown as Error).message}`;
  }
};