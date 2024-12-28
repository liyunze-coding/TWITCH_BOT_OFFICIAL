import { addToTextFile, getTextFileContent } from "./Commands";
import { sendChatResponse } from "./ChatProcessor";

const STREAMERS = await getTextFileContent("streamers_to_shoutout");

type ChatCountType = {
	[key: string]: number;
};

let chatCount: ChatCountType = {};

export async function processAutoShoutout(username: string) {
	// if streamer is in the list AND has chatted 3 times, then auto shoutout
	username = username.toLowerCase();
	if (STREAMERS.includes(username)) {
		if (!chatCount[username]) {
			chatCount[username] = 0;
		}

		// 2 = 3 - 1
		if (chatCount[username] < 2) {
			chatCount[username]++;
		} else if (chatCount[username] == 2) {
			// Do shoutout
			chatCount[username]++;

			if (username === "studyyoulazy") {
				await sendChatResponse(`!lazy`, "Twitch");
			} else {
				await sendChatResponse(`!so ${username}`, "Twitch");
			}
		}
	}
}

export async function addToShoutout(username: string) {
	await addToTextFile("streamers_to_shoutout", username);
}
