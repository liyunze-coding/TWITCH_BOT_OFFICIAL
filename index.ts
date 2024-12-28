import { client } from "./utils/SBClient";
import { textToSpeechPrivate, textToSpeechPublic } from "./utils/TextToSpeech";
import {
	processChat,
	processCommand,
	processCheckIn,
	sendChatResponse,
} from "./utils/ChatProcessor";
import { sendEmbedWebHook } from "./utils/DiscordWebHook";
import { getProfileURL, getVODTimestamp } from "./utils/TwitchAPI";

type Webhook = {
	timestampedURL: string;
	username: string;
	profileURL: string;
	description: string;
};

let webhookQueue: Webhook[] = [];
let webhookOccupied = false;

let textToSpeechOccupied = false;
let privateTTSQueue: string[] = [];
let publicTTSQueue: string[] = [];

const CHANNEL_REWARD_WH_URL = Bun.env.CHANNEL_REWARD_WH_URL ?? "";

async function queueingPrivateTTS(message: string) {
	if (textToSpeechOccupied) {
		privateTTSQueue.push(message);
	}

	textToSpeechOccupied = true;
	await textToSpeechPrivate(message);
	textToSpeechOccupied = false;

	if (privateTTSQueue.length > 0) {
		let TTS_msg = privateTTSQueue.shift() ?? "";

		if (!TTS_msg) {
			return;
		}

		await queueingPrivateTTS(TTS_msg);
	}
}

async function queueingPublicTTS(message: string) {
	publicTTSQueue.push(message);
}

async function playPublicTTSQueue() {
	if (publicTTSQueue.length > 0) {
		let TTS_msg = publicTTSQueue.shift() ?? "";

		if (!TTS_msg) {
			return;
		}

		await textToSpeechPublic(TTS_msg);
	} else {
		await textToSpeechPrivate("No TTS in Queue");
	}
}

async function sendEmbedWebHookToDiscord(
	timestampedURL: string,
	username: string,
	profileURL: string,
	description: string
) {
	if (webhookOccupied) {
		webhookQueue.push({
			timestampedURL,
			username,
			profileURL,
			description,
		});
	}

	webhookOccupied = true;
	await sendEmbedWebHook(CHANNEL_REWARD_WH_URL, {
		description: description,
		message: timestampedURL,
		author: username,
		author_url: profileURL,
	});
	webhookOccupied = false;

	if (webhookQueue.length > 0) {
		const { timestampedURL, username, profileURL, description } =
			webhookQueue.shift() ?? {};

		if (!timestampedURL || !username || !profileURL || !description) {
			return;
		}

		await sendEmbedWebHookToDiscord(
			timestampedURL,
			username,
			profileURL,
			description
		);
	}
}

client.on("Twitch.Follow", async (data) => {
	let username = data.data.user_name;

	await queueingPrivateTTS(`${username} has followed`);
	await sendChatResponse("Thanks for the follow!", "twitch");
});

client.on("Twitch.Sub", async (data) => {
	let username = data.data.userName;
	let timestampedURL = await getVODTimestamp();
	let profileURL = await getProfileURL(data.data.userId);

	await processCheckIn(username);

	await queueingPrivateTTS(`${username} has subscribed`);

	await sendEmbedWebHookToDiscord(
		timestampedURL,
		username,
		profileURL,
		`**${username}** has subscribed!`
	);
});

client.on("Twitch.ReSub", async (data) => {
	let username = data.data.userName;
	let months = data.data.cumulativeMonths;
	let timestampedURL = await getVODTimestamp();
	let profileURL = await getProfileURL(data.data.userId);

	await processCheckIn(username);

	textToSpeechOccupied = true;
	await queueingPrivateTTS(`${username} has subscribed for ${months} months`);
	textToSpeechOccupied = false;

	await sendEmbedWebHookToDiscord(
		timestampedURL,
		username,
		profileURL,
		`**${username}** has subscribed for **${months} months**!`
	);
});

client.on("Twitch.GiftSub", async (data) => {
	let username = data.data.isAnonymous
		? "An anonymous gifter"
		: data.data.userName;
	let recipient = data.data.recipientDisplayName;
	let timestampedURL = await getVODTimestamp();
	let profileURL = await getProfileURL(data.data.userId);

	await processCheckIn(username);

	await queueingPrivateTTS(`${username} has gifted a sub to ${recipient}`);

	await sendEmbedWebHookToDiscord(
		timestampedURL,
		username,
		profileURL,
		`**${username}** has gifted a sub to **${recipient}**!`
	);
});

client.on("Twitch.GiftBomb", async (data: any) => {
	let username = data.data.isAnonymous
		? "An anonymous gifter"
		: data.data.userName;
	let giftCount = data.data.gifts;
	let timestampedURL = await getVODTimestamp();
	let profileURL = await getProfileURL(data.data.userId);

	await queueingPrivateTTS(
		`**${username}** has gifted **${giftCount} subs** to the community`
	);

	await sendEmbedWebHookToDiscord(
		timestampedURL,
		username,
		profileURL,
		`**${username}** has gifted **${giftCount} subs** to the community!`
	);
});

client.on("Twitch.Raid", async (data) => {
	let raidingStreamer = data.data.from_broadcaster_user_name;
	let viewerCount = data.data.viewers;
	let timestampedURL = await getVODTimestamp();
	let profileURL = await getProfileURL(data.data.from_broadcaster_user_id);

	await queueingPrivateTTS(
		`${raidingStreamer} has raided with ${viewerCount} viewers`
	);

	await sendEmbedWebHookToDiscord(
		timestampedURL,
		raidingStreamer,
		profileURL,
		`**${raidingStreamer}** has raided with **${viewerCount} viewers**!`
	);
});

client.on("Twitch.RewardRedemption", async (data) => {
	try {
		let username = data.data.user_name;
		let reward = data.data.reward;

		let userInput = data.data.user_input ?? "";

		let response = `${username} redeemed ${reward.title}`;
		if (userInput) {
			response += ` with message: ${userInput}`;
		}

		if (reward.id == "a3114976-9596-4821-b7a7-3b3b4209f94e") {
			await processCheckIn(username);
		}

		// Check if it's the other TTS reward
		if (reward.id !== "dc57e7d7-738e-4396-a945-e4769006e4ae") {
			// Send TTS message to broadcaster only
			await queueingPrivateTTS(response);
		} else {
			// Send TTS via Speaker Bot
			await queueingPublicTTS(`${username} says. ${userInput}`);
		}

		// Send message to Discord with VOD Timestamp
		let timestampedURL = await getVODTimestamp();

		let profileURL = await getProfileURL(data.data.user_id);

		await sendEmbedWebHookToDiscord(
			timestampedURL,
			username,
			profileURL,
			`**${username}** redeemed **${reward.title}** for ${
				reward.cost
			} points!\n${
				userInput
					? `\`\`\`\n${userInput}\n\`\`\`
					`
					: ""
			}`
		);
	} catch (error) {
		console.error("Error:", error);
	}
});

client.on("Twitch.Cheer", async (data) => {
	let bits = data.data.bits;
	let username = data.data.username;
	data.data.displayName;

	await processCheckIn(username);
});

client.on("Twitch.ChatMessage", async (data) => {
	const payload = data.data;
	const source = data.event.source.toLowerCase();
	const user = payload.message.displayName;
	const msgId = payload.message.msgId;

	await processCheckIn(user);

	// check if message starts with prefix
	if (!payload.message.message.startsWith("!")) {
		const chatMessage = payload.message.message;
		await processChat(user, source, chatMessage, msgId);
		return;
	}

	const command = payload.message.message.substring(1).split(" ")[0];
	const message = payload.message.message.split(" ").slice(1).join(" ");

	// iterate through payload.message.badges
	// each iteration has name in an object
	// if name is "moderator" or "broadcaster", set flags.mod or flags.broadcaster to true
	const badges = payload.message.badges;

	const flags = {
		broadcaster: false,
		mod: false,
	};

	badges.forEach((badge: any) => {
		if (badge.name === "broadcaster") {
			flags.broadcaster = true;
		} else if (badge.name === "moderator") {
			flags.mod = true;
		}
	});

	await processCommand(user, command, message, flags, source, msgId);
});

client.on("YouTube.Message", async (data) => {
	const payload = data.data;
	const source = data.event.source.toLowerCase();
	const user = payload.user.name;

	// check if message starts with prefix
	if (!payload.message.startsWith("!")) {
		const chatMessage = payload.message;
		await processChat(user, source, chatMessage);
		return;
	}

	const command = payload.message.substring(1).split(" ")[0];

	// remove first word from message
	const message = payload.message.split(" ").slice(1).join(" ");

	// set flags
	const flags = {
		broadcaster: payload.user.isOwner,
		mod: payload.user.isModerator,
	};

	await processCommand(user, command, message, flags, source);
});

client.on("General.Custom", async (data: any) => {
	if (data && data.data.custom && data.data.custom == "playTTS") {
		await playPublicTTSQueue();
	}
});
