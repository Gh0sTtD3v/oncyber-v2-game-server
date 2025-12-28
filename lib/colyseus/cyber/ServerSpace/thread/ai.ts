import * as ai from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import zod from "zod";

const OPEN_API_KEY = process.env.OPEN_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

delete process.env.OPEN_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GOOGLE_API_KEY;

const modelFetch = (url, opts) => {
  return globalThis.$$ofetch(url, opts);
};

const providers = {
  openai: createOpenAI({
    compatibility: "strict",
    fetch: modelFetch,
    apiKey: OPEN_API_KEY,
  }),

  anthropic: createAnthropic({
    fetch: modelFetch,
    apiKey: ANTHROPIC_API_KEY,
  }),
  google: createGoogleGenerativeAI({
    fetch: modelFetch,
    apiKey: GOOGLE_API_KEY,
  }),
  groq: createGroq({
    fetch: modelFetch,
    apiKey: GROQ_API_KEY,
  }),
};

const models = {
  openai: {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "gpt-3.5-turbo": "gpt-3.5-turbo",
  },
  anthropic: {
    "sonnet-3.5": "claude-3-5-sonnet-20241022",
    "haiku-3.5": "claude-3-5-haiku-20241022",
    "haiku-3": "claude-3-haiku-20240307",
  },
  google: {
    "gemini-1.5-pro-latest": "gemini-1.5-pro-latest",
    "gemini-1.5-flash-latest": "gemini-1.5-flash-latest",
  },
  groq: {
    "llama-3.1-70b-versatile": "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant": "llama-3.1-8b-instant",
    "gemma2-9b-it": "gemma2-9b-it",
    "mixtral-8x7b-32768": "mixtral-8x7b-32768",
  },
};

const defaultModel = models.openai["gpt-4o-mini"];

function getModel(model) {
  //
  if (model) {
    if (typeof model.doGenerate === "function") {
      return model;
    }

    if (model in models.openai) {
      return providers.openai(models.openai[model]);
    } else if (model in models.anthropic) {
      return providers.anthropic(models.anthropic[model]);
    } else if (model in models.groq) {
      return providers.groq(models.groq[model]);
    } else if (model in models.google) {
      return providers.google(models.google[model]);
    }
  }

  return providers.openai(defaultModel);
}

function getGenOpts(opts) {
  const model = getModel(opts.model);
  return {
    ...opts,
    model,
  };
}

export class Ai {
  //
  static get z() {
    return zod;
  }

  static get providers() {
    return providers;
  }

  static tool(tool: any) {
    return ai.tool(tool);
  }

  static async generateText(opts) {
    try {
      //
      const aiOpts = getGenOpts(opts);

      const res = await ai.generateText(aiOpts);

      /*
      console.log(
        "steps",
        steps.map((step) => step.stepType + ", " + step.text)
      );
      console.log("text", text);
      */
      return res;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async streamText(opts) {
    try {
      //
      const aiOpts = getGenOpts(opts);

      const res = ai.streamText(aiOpts);

      /*
      console.log(
        "steps",
        steps.map((step) => step.stepType + ", " + step.text)
      );
      console.log("text", text);
      */
      return res;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async generateObject(opts) {
    try {
      //
      const aiOpts = getGenOpts(opts);

      const res = await ai.generateText(aiOpts);

      /*
      console.log(
        "steps",
        steps.map((step) => step.stepType + ", " + step.text)
      );
      console.log("text", text);
      */
      return res;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async embed(opts) {
    try {
      const aiOpts = getGenOpts(opts);
      const res = await ai.embed(aiOpts);
      return res;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async embedMany(opts) {
    try {
      const aiOpts = getGenOpts(opts);
      const res = await ai.embedMany(aiOpts);
      return res;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
