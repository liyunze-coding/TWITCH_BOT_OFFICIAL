import { client } from "./SBClient";
import {
	getCommands,
	getTextFileContent,
	addToTextFile,
	addCommand,
	removeCommand,
	editCommand,
	addToShoutout,
} from "./Commands";

import { lookUpDefinition } from "./Define";
import { sendEmbedWebHook, sendMessageWebHook } from "./DiscordWebHook";
import { getVODTimestamp, checkUserExists } from "./TwitchAPI";
import type { jsonFilename, textFilename } from "./Commands";

const PROMOTION_WH_URL = Bun.env.PROMOTION_WH_URL ?? "";
const PRIVATE_WH_URL = Bun.env.PRIVATE_WH_URL ?? "";

const MCommandModify: string[] = ["mcmd", "modcommand"];
const commandModify: string[] = ["command", "cmd", "rcmd"];

// Timer responses settings
let messageCount: number = 0;
let lastMessageTimestamp: number = Date.now();
const CHAT_MESSAGE_COUNT = 5;
const TIME_SINCE_LAST_MESSAGE = 5 * 60 * 1000;

export async function processCommand(
	user: string,
	command: string,
	message: string,
	flags: any,
	source: string,
	msgId?: string | null
) {
	let broadcasterCommands = await getCommands("broadcaster_commands");

	let hasModPerms = flags.mod || flags.broadcaster;

	// No perms
	if (broadcasterCommands[command] && !hasModPerms) {
		await sendChatResponse(
			"You do not have permission to use that command!",
			source,
			msgId
		);
		return;
	} else if (broadcasterCommands[command]) {
		let reply = broadcasterCommands[command];
		const mention = message.split(" ")[0];
		reply = reply.replace("{user}", `@${user}`);
		reply = reply.replace("{mention}", `${mention}`);

		await sendChatResponse(reply, source, msgId);
	}

	let commands = await getCommands("commands");

	// TODO: Modify shoutout command

	if (commands[command]) {
		let reply = commands[command];
		const mention = message.split(" ")[0];
		reply = reply.replace("{user}", `@${user}`);
		reply = reply.replace("{mention}", `${mention}`);

		await sendChatResponse(reply, source, msgId);
	} else if (command === "time") {
		let d = new Date();
		let localtime = d.toLocaleTimeString("en-US", { hour12: true });

		await sendChatResponse(
			`${user} it is currently ${localtime}`,
			source,
			msgId
		);
	} else if (command === "compliment") {
		let mention = message.split(" ")[0];
		let compliment = await getCompliment();

		await sendChatResponse(`${mention} ${compliment}`, source);
	} else if (command === "quote") {
		let quote = await getQuote();
		await sendChatResponse(quote, source, msgId);
	} else if (command === "promote" && flags.broadcaster) {
		let content_of_promotion = `<@&1038436118816903210> \nhttps://rython.dev/live\n${message}`;

		// Send a webhook to promote the channel
		await sendMessageWebHook(PROMOTION_WH_URL, content_of_promotion);

		await sendChatResponse(`Promotion successful!`, source, msgId);
	} else if (
		hasModPerms &&
		(MCommandModify.includes(command) || commandModify.includes(command))
	) {
		let commandSection: jsonFilename = "commands";
		if (MCommandModify.includes(command)) {
			commandSection = "broadcaster_commands";
		}

		// modifying mod command
		let breakdownString = message.split(" ");
		let modifyMode = breakdownString[0].toLowerCase();
		let commandName = breakdownString[1].toLowerCase();
		let commandOutput = breakdownString.slice(2).join(" ");

		if (commandName.startsWith("!")) {
			commandName = commandName.substring(1);
		}

		let success = false;

		if (modifyMode === "add") {
			success = await addCommand(
				commandSection,
				commandName,
				commandOutput
			);

			if (success) {
				await sendChatResponse(
					`Command "!${commandName}" has been added successfully!`,
					source,
					msgId
				);
			} else {
				await sendChatResponse(
					`Failed to add command "!${commandName}"`,
					source,
					msgId
				);
			}
		} else if (modifyMode === "edit") {
			success = await editCommand(
				commandSection,
				commandName,
				commandOutput
			);

			if (success) {
				await sendChatResponse(
					`Command "!${commandName}" has been edited successfully!`,
					source,
					msgId
				);
			} else {
				await sendChatResponse(
					`Failed to edit command "!${commandName}"`,
					source,
					msgId
				);
			}
		} else if (["delete", "remove", "rm"].includes(modifyMode)) {
			success = await removeCommand(commandSection, commandName);

			if (success) {
				await sendChatResponse(
					`Command "!${commandName}" has been deleted successfully!`,
					source,
					msgId
				);
			} else {
				await sendChatResponse(
					`Failed to delete command "!${commandName}"`,
					source,
					msgId
				);
			}
		} else {
			await sendChatResponse(
				`Operation of modifying command failed`,
				source,
				msgId
			);
		}
	} else if (
		hasModPerms &&
		["addquote", "addtimer", "addcompliment"].includes(command)
	) {
		let textSection: textFilename = "compliments";
		let singularNoun: string = "compliment";

		if (command === "addquote") {
			textSection = "quotes";
			singularNoun = "quote";
		} else if (command === "addtimer") {
			textSection = "timer_messages";
			singularNoun = "timer message";
		}

		let success = await addToTextFile(textSection, message);

		if (success) {
			await sendChatResponse(
				`${singularNoun} has been added successfully!`,
				source,
				msgId
			);
		} else {
			await sendChatResponse(
				`Failed to add ${singularNoun}!`,
				source,
				msgId
			);
		}
	} else if (["define", "definition"].includes(command)) {
		const word = message.split(" ")[0];

		lookUpDefinition(word).then(async (definition) => {
			await sendChatResponse(definition, source, msgId);
		});
	} else if (["timestamp"].includes(command)) {
		let description = "";
		if (message) description = message;

		let timestamp = await getVODTimestamp();

		await sendMessageWebHook(
			PRIVATE_WH_URL,
			`${timestamp}\n${description}`
		);
	} else if (command === "so") {
		let user = message.startsWith("@") ? message.slice(1) : message;

		if (await checkUserExists(user)) {
			await addToShoutout(user);
		}
	}

	/*else if (["convert"].includes(command)) {
		let response = "";
		if (message.includes("->")) {
			let breakdownMessage = message.split("->");
			let toUnit = breakdownMessage[1];
			let fromMeasurement = breakdownMessage[0];

			response = convert(fromMeasurement, toUnit);
		} else {
			// TODO: AUTOMATIC CONVERSION
		}

		await sendChatResponse(response, source, msgId);
	}*/
}

export async function processChat(
	user: string,
	source: string,
	msgId?: string | null
) {
	if (
		[
			"ryandotts",
			"rythondev",
			"mohcitrus",
			"sery_bot",
			"kofistreambot",
		].includes(user.toLowerCase()) ||
		source === "youtube"
	) {
		return;
	}

	if (
		messageCount >= CHAT_MESSAGE_COUNT &&
		Date.now() - lastMessageTimestamp >= TIME_SINCE_LAST_MESSAGE
	) {
		// Pick between quote, compliment and timer message
		const choices = ["quote", "compliment", "timer"] as const;
		let randomChoice = choices[Math.floor(Math.random() * choices.length)];

		if (randomChoice === "quote") {
			let quote = await getQuote();

			await sendChatResponse(quote, source);
		} else if (randomChoice === "compliment") {
			let compliment = await getCompliment();

			await sendChatResponse(compliment, source, msgId);
		} else {
			let timerMessage = await getTimerMessage();

			await sendChatResponse(timerMessage, source);
		}

		messageCount = 0;
		lastMessageTimestamp = Date.now();
	} else {
		messageCount++;
	}
}

async function sendChatResponse(
	response: string,
	source: string,
	msgId?: string | null
) {
	if (source === "youtube") {
		// const streamerYTBotResponse =
		await client.doAction("390ff8f2-7945-4eba-be2a-a1c0e4ba535d", {
			response: response,
		});

		// console.log(streamerYTBotResponse);
	} else if (source === "twitch" && !msgId) {
		// const streamerTwitchBotResponse =
		await client.doAction("8ff809be-e269-4f06-9528-021ef58df436", {
			response: response,
		});

		// console.log(streamerTwitchBotResponse);
	} else if (source === "twitch") {
		await client.doAction("22617c2d-0ba2-4c19-9703-1b6fa62e3a4d", {
			response: response,
			msgId: msgId,
		});
	}
}

async function getCompliment() {
	const compliments = await getTextFileContent("compliments");

	let compliment =
		compliments[Math.floor(Math.random() * compliments.length)];

	return compliment;
}

async function getQuote() {
	const quotes = await getTextFileContent("quotes");
	let quote = quotes[Math.floor(Math.random() * quotes.length)];

	return quote;
}

async function getTimerMessage() {
	const timerMessages = await getTextFileContent("timer_messages");
	let timerMessage =
		timerMessages[Math.floor(Math.random() * timerMessages.length)];

	return timerMessage;
}
