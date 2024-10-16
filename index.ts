import { client } from "./utils/SBClient";
import { textToSpeechPrivate, textToSpeechPublic } from "./utils/TextToSpeech";
import { processChat, processCommand } from "./utils/ChatProcessor";
import { sendEmbedWebHook } from "./utils/DiscordWebHook";
import { getProfileURL, getVODTimestamp } from "./utils/TwitchAPI";

const CHANNEL_REWARD_WH_URL = Bun.env.CHANNEL_REWARD_WH_URL ?? "";

async function sendEmbedWebHookToDiscord(
	timestampedURL: string,
	username: string,
	profileURL: string,
	description: string
) {
	await sendEmbedWebHook(CHANNEL_REWARD_WH_URL, {
		description: description,
		message: timestampedURL,
		author: username,
		author_url: profileURL,
	});
}

client.on("Twitch.Follow", async (data) => {
	let username = data.data.user_name;

	await textToSpeechPrivate(`${username} has followed`);
});

client.on("Twitch.Sub", async (data) => {
	let username = data.data.userName;
	let timestampedURL = await getVODTimestamp();
	let profileURL = await getProfileURL(data.data.userId);

	await textToSpeechPrivate(`${username} has subscribed`);

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

	await textToSpeechPrivate(
		`${username} has subscribed for ${months} months`
	);

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

	await textToSpeechPrivate(`${username} has gifted a sub to ${recipient}`);

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

	await textToSpeechPrivate(
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

	await textToSpeechPrivate(
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

		// Check if it's the other TTS reward
		if (reward.id !== "dc57e7d7-738e-4396-a945-e4769006e4ae") {
			// Send TTS message to broadcaster only
			await textToSpeechPrivate(response);
		} else {
			await textToSpeechPublic(`New TTS from ${username}. ${userInput}`);
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

client.on("Twitch.ChatMessage", async (data) => {
	const payload = data.data;
	const source = data.event.source.toLowerCase();
	const user = payload.message.displayName;
	const msgId = payload.message.msgId;

	// check if message starts with prefix
	if (!payload.message.message.startsWith("!")) {
		await processChat(user, source, msgId);
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
		await processChat(user, source);
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
