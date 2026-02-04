import { makeClient } from './src/client.js';
import { JsonlCreditTracker } from './src/credits.js';
import { ConfigError } from './src/errors.js';
import type { ToolContext, ToolDefinition, NutrientClient } from './src/types.js';

// Import all tool definitions
import { convertToPdfTool } from './src/tools/convert-to-pdf.js';
import { convertToImageTool } from './src/tools/convert-to-image.js';
import { convertToOfficeTool } from './src/tools/convert-to-office.js';
import { nutrient_extract_text } from './src/tools/extract-text.js';
import { ocrTool } from './src/tools/ocr.js';
import { watermarkTool } from './src/tools/watermark.js';
import { nutrient_redact } from './src/tools/redact.js';
import { nutrient_ai_redact } from './src/tools/ai-redact.js';
import { signTool } from './src/tools/sign.js';
import { checkCreditsTool } from './src/tools/check-credits.js';

/**
 * Nutrient Document Processing plugin for OpenClaw.
 *
 * Registers 10 document processing tools powered by the Nutrient DWS API.
 * Config: apiKey (required), sandboxDir (optional).
 */
export default function nutrientPlugin(api: any) {
  const config = api.getConfig();

  // Resolve API key: config → env → lazy error on first use
  const apiKey = config.apiKey || process.env.NUTRIENT_API_KEY;

  let client: NutrientClient;
  if (apiKey) {
    client = makeClient(apiKey);
  } else {
    // Lazy proxy — plugin loads fine, first API call fails with a clear message
    client = {
      post: async () => {
        throw new ConfigError(
          'NUTRIENT_API_KEY not configured. Set it in plugin settings or NUTRIENT_API_KEY env var. ' +
          'Get a key at https://dashboard.nutrient.io/sign_up'
        );
      },
    };
  }

  const sandboxDir = config.sandboxDir || undefined;
  const credits = new JsonlCreditTracker(sandboxDir);
  const ctx: ToolContext = { client, credits, sandboxDir };

  const tools: ToolDefinition[] = [
    convertToPdfTool,
    convertToImageTool,
    convertToOfficeTool,
    nutrient_extract_text,
    ocrTool,
    watermarkTool,
    nutrient_redact,
    nutrient_ai_redact,
    signTool,
    checkCreditsTool,
  ];

  for (const tool of tools) {
    api.registerTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: (args: any) => tool.execute(args, ctx),
    });
  }

  return { name: 'nutrient', version: '0.1.0' };
}
