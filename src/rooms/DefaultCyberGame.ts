import OpenAI from "openai";
import { GameSession } from "../cyber";
import { PlayerState } from "../cyber/schema/PlayerState";
import { Messages } from "../cyber/abstract/types";
import { readFileSync, existsSync } from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface Asset {
	name: string;
	position: { x: number; y: number; z: number };
	[key: string]: any;
}

function getAssets(roomId: string): Asset[] | null {
	// const path = __dirname + `/../../store/${roomId}.json`;
	const path = __dirname + `/../../store/default.json`;
	if (!existsSync(path)) {
		console.warn(`No asset file found for room ${roomId} at path ${path}`);
		return null;
	}
	return JSON.parse(readFileSync(path, "utf-8"));
}

function getAssetByName(roomId: string, name: string): Asset | null {
	// normalize name by lowercasing and removing spaces, punctuation and special characters for better matching
	const search = name.toLocaleLowerCase().replace(/\s/g, "").replace(/[^\w]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // also remove accents
	const assets = getAssets(roomId);
	if (!assets) {
		console.warn(`No assets found for room ${roomId} when searching for asset by name "${name}"`);
		return null;
	}
	return assets.find(a => a.name.toLocaleLowerCase() === search || a.name.toLocaleLowerCase().includes(search)) ?? null;
}

const tools: OpenAI.Responses.Tool[] = [
	{
		type: "function",
		name: "get_assets",
		description: "Get all assets and their positions in the world",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		type: "function",
		name: "get_asset_by_name",
		description: "Get a specific asset and its position by name",
		parameters: {
			type: "object",
			properties: {
				name: { type: "string", description: "The asset name to look up" },
			},
			required: ["name"],
		},
	},
];

const instructions = {
	tools: `
You have two tools:
- get_assets: returns all artworks in the world with their names and any additional info
- get_asset_by_name: returns a specific artwork by name

Rules:
- Only use data returned by tools, never invent or assume anything! NEVER EVER MAKE UP COMMENTS, REMARKS OR ANY INFORMATION, ONLY USE WHAT IS PROVIDED!
- When asked about the world or artworks: call get_assets, then write a natural response using all available info from the tool result — never mention positions
- When asked to go to or find a specific artwork: call get_asset_by_name, respond with a message in natural language and include the action with the exact position from the tool result
- If get_asset_by_name returns null, respond with a natural message saying you couldn't find it
- When receiving a system update, respond with information about the target, do not mention any positions. (e.g. if you receive a message that you have reached an artwork, respond with the name and description if available)
- The message field in your response should be natural language, and may include information about artworks, greetings, or any other relevant info. No markdown, json or code, just plain text.
- The action field is optional and should only be included when you want the user to move to a specific artwork.
- Always respond with valid JSON: { "message": string, "action"?: { "type": "move", "target": string, "position": { "x": number, "y": number, "z": number } } }
- No markdown, no code blocks, raw JSON only
- AGAIN, NEVER EVER MAKE UP COMMENTS, REMARKS OR ANY INFORMATION THAT IS NOT EXPLICITLY PROVIDED IN THE TOOL RESPONSES OR SYSTEM MESSAGES, ONLY USE WHAT IS PROVIDED!
`,
	toolless: `
Rules:
- Only use information explicitly provided in this message, never invent or assume anything. NEVER EVER MAKE UP COMMENTS, REMARKS OR ANY INFORMATION, ONLY USE WHAT IS PROVIDED!
- Always respond with valid JSON: { "message": string }
- The message field in your response should be natural language, and may include information about artworks, greetings, or any other relevant info. No markdown, json or code, just plain text.
- No markdown, no code blocks, raw JSON only
- AGAIN, NEVER EVER MAKE UP COMMENTS, REMARKS OR ANY INFORMATION THAT IS NOT EXPLICITLY PROVIDED IN THIS MESSAGE, ONLY USE WHAT IS PROVIDED!
`,

};


export class DefaultCyberGame extends GameSession {
	//
	maxPlayers = 500;

	// fps
	tickRate = 20;
	patchRate = 20;
	reconnectTimeout = 0;
	iv: any;

	serverEngine = { enabled: true };

	async onPreload() {
		console.log("Preloading...");
	}

	static onAuth(token: any, request: any): Promise<void> {
		console.log("Authenticating...", token);
		return Promise.resolve();
	}

	async onJoin(player) {
		console.log(player.sessionId, player.userId, "joined!");
	}

	onLeave(player) {
		console.log(player.sessionId, player.userId, "left!");
	}

	async onMessage(message: any, player: PlayerState): Promise<void> {
		console.log("Received message", player, message);

		super.onMessage(message, player);

		if (message.type === "broadcast") {
			
			if (message.payload?.prompt) {
				try {
					const instructions = `You are ${message.payload.name},

Your personality is ${message.payload.personality}. ${message.payload.current_location ? `
Your current location is: ${message.payload.current_location}.` : ""}

`;
					const result = await this.runWithTools(message.payload.prompt, instructions);

					this.broadcastCyberMsg({
						type: Messages.ROOM_MESSAGE,
						data: {
							type: "broadcast",
							payload: {
								from: { sessionId: "ai" },
								message: result.message,
								action: result.action ?? null,
							},
						},
					});
				}
				catch (err) {
					console.log("OpenAI error:", err);
				}
			}

			if (message.payload?.system) {
				// example system message: { arrived_at_asset: "Mona Lisa" }
				const assetName = message.payload.arrived_at_asset;
				const asset = getAssetByName(this.roomId, assetName);
				const systemMessage = `We have arrived at ${assetName}. ${asset ? `Here is some information about it: ${Object.entries(asset).filter(([key]) => key !== "name" && key !== "position").map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}` : "However, I don't have any information about this artwork."}`;
				const response = await openai.responses.create({
					model: "gpt-4o-mini",
					instructions: instructions.toolless,
					input: `${systemMessage}. Remember, only use the information provided in this message, never invent or assume anything. Respond with a message about this artwork and do not mention any positions. Return valid JSON only with the message field.`,
					text: { format: { type: "json_object" } },
				});

				try {
					const parsed = JSON.parse(response.output_text);
					console.log("Parsed follow-up response for system message:", parsed.message);
					this.broadcastCyberMsg({
						type: Messages.ROOM_MESSAGE,
						data: {
							type: "broadcast",
							payload: {
								from: { sessionId: "ai" },
								message: parsed.message,
								action: null,
							},
						},
					});
				}
				catch (err) {
					console.log("Error parsing follow-up response for system message:", err, "Raw response:", response.output_text);
					this.broadcastCyberMsg({
						type: Messages.ROOM_MESSAGE,
						data: {
							type: "broadcast",
							payload: {
								from: { sessionId: "ai" },
								message: systemMessage,
								action: null,
							},
						},
					});
				}
			}
		}
	}

	private async runWithTools(input: string, personality: string): Promise<{ message: string; action?: any }> {
		const response = await openai.responses.create({
			model: "gpt-4o",
			instructions: personality + instructions.tools,
			input: `${input}. Return valid JSON`,
			tools,
			text: { format: { type: "json_object" } },
		});

		// no tool call — plain text response
		if (!response.output?.some((o: any) => o.type === "function_call")) {
			try {
				const parsed = JSON.parse(response.output_text);
				if (parsed.message) {
					console.log("Parsed message from response without tool calls:", parsed.message);
					return { message: parsed.message };
				}
			}
			catch (err) {
				console.log("Error parsing response without tool calls:", err, "Raw response:", response.output_text);
				return { message: response.output_text };
			}
		}

		for (const item of response.output) {
			if (item.type !== "function_call") continue;

			if (item.name === "get_assets") {
				const assets = getAssets(this.roomId) ?? [];
				const names = assets.map(a => a.name).join(", ");

				const followUp = await openai.responses.create({
					model: "gpt-4o-mini",
					instructions: instructions.toolless,
					input: `There are ${assets.length} assets in the world: ${names}. Respond with a message about the world and these assets. Do not mention positions. Return valid JSON only with the message field.`,
					text: { format: { type: "json_object" } },
				});

				try {
					const parsed = JSON.parse(followUp.output_text);
					console.log("Parsed follow-up response for get_assets:", parsed.message);
					return { message: parsed.message };
				}
				catch (err) {
					console.log("Error parsing follow-up response for get_assets:", err, "Raw response:", followUp.output_text);
					return { message: followUp.output_text };
				}
			}

			if (item.name === "get_asset_by_name") {
				const args = JSON.parse(item.arguments);
				const asset = getAssetByName(this.roomId, args.name);

				if (!asset) {
					return { message: `No asset found with name "${args.name}".` };
				}

				Object.entries(asset).forEach(([key, value]) => {
					console.log(`Asset property ${key}: ${value}`);
				});

				const input = `Asset "${asset.name}" found.
${Object.entries(asset).filter(([key]) => key !== "name").map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}

If moving towards an artwork, just acknowledge that briefly, dont mensiton anything but the title.
Return valid JSON only with the message field and an optional action field with type "move", the target name, and the position. Do not mention positions in the message.`;

				const followUp = await openai.responses.create({
					model: "gpt-4o-mini",
					instructions: instructions.toolless,
					input,
					text: { format: { type: "json_object" } },
				});

				try {
					const parsed = JSON.parse(followUp.output_text);
					console.log(`Parsed follow-up response for get_asset_by_name("${args.name}")`, parsed.message);
					return parsed;
				}
				catch (err) {
					console.log(`Error parsing follow-up response for get_asset_by_name("${args.name}")`, err, "Raw response:", followUp.output_text);
					return { message: followUp.output_text };
				}
			}
		}

		console.log("No valid tool calls found in response");

		try {
			const parsed = JSON.parse(response.output_text);
			if (parsed.message) {
				console.log("Parsed message from response without tool calls:", parsed.message);
				return { message: parsed.message };
			}
		}
		catch (err) {
			console.log("Error parsing response without tool calls:", err, "Raw response:", response.output_text);
			return { message: response.output_text };
		}
	}

	onDispose() {
		console.log("disposed");
	}
}