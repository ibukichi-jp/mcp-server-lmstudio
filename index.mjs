#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// WSL2環境でホスト（Windows側）のIPを取得する関数（非同期＆安全フォールバック）
async function getHostIp() {
  try {
    const { stdout } = await execAsync("ip route show default 2>/dev/null");
    const match = stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
    if (match) return match[1];
  } catch {}
  return "localhost";
}

const DEFAULT_PORT = process.env.LM_STUDIO_PORT || "1234";
const TIMEOUT_MS = parseInt(process.env.LM_STUDIO_TIMEOUT, 10) || 1500;
const CANDIDATE_HOSTS = ["localhost", await getHostIp()];

async function getAvailableBaseUrl() {
  if (process.env.LM_STUDIO_BASE_URL) {
    return process.env.LM_STUDIO_BASE_URL;
  }
  for (const host of CANDIDATE_HOSTS) {
    const url = `http://${host}:${DEFAULT_PORT}/v1`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${url}/models`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return url;
    } catch {}
  }
  return `http://localhost:${DEFAULT_PORT}/v1`;
}

const server = new Server(
  {
    name: "lm-studio",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ask_local_llm",
        description: "Send a prompt or coding question to the local LLM running in LM Studio.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt / instruction / question to send to the local LLM",
            },
            system_prompt: {
              type: "string",
              description: "Optional system instructions (e.g. 'You are an expert full-stack developer')",
            },
            model: {
              type: "string",
              description: "Optional model ID. If omitted, the currently loaded model in LM Studio is used.",
            },
            temperature: {
              type: "number",
              description: "Sampling temperature (default: 0.7)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "list_local_models",
        description: "List currently loaded and available models in LM Studio.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "check_lm_studio_status",
        description: "Check if LM Studio local server is currently running and accessible.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const baseUrl = await getAvailableBaseUrl();

  if (request.params.name === "check_lm_studio_status") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);
      const res = await fetch(`${baseUrl}/models`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text: `LM Studio responded with status ${res.status} at ${baseUrl}`,
            },
          ],
        };
      }
      const data = await res.json();
      return {
        content: [
          {
            type: "text",
            text: `LM Studio is running and connected successfully at ${baseUrl}!\nAvailable/loaded models count: ${data.data?.length || 0}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Could not connect to LM Studio at ${baseUrl}.\nPlease verify that LM Studio is open and the Local Server has been started.\n(Error: ${err.message})`,
          },
        ],
      };
    }
  }

  if (request.params.name === "list_local_models") {
    try {
      const res = await fetch(`${baseUrl}/models`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to list models: ${err.message}. Ensure LM Studio server is running.`,
          },
        ],
      };
    }
  }

  if (request.params.name === "ask_local_llm") {
    const { prompt, system_prompt, model, temperature = 0.7 } = request.params.arguments || {};
    if (!prompt) {
      return {
        isError: true,
        content: [{ type: "text", text: "prompt is required" }],
      };
    }

    const messages = [];
    if (system_prompt) {
      messages.push({ role: "system", content: system_prompt });
    }
    messages.push({ role: "user", content: prompt });

    const requestBody = {
      messages,
      temperature,
    };
    if (model) {
      requestBody.model = model;
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "(No response received)";
      return {
        content: [
          {
            type: "text",
            text: reply,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `LM Studio request failed: ${err.message}. Please check that LM Studio Local Server is running and has a model loaded.`,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
