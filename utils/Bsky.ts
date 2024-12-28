import { AtpAgent } from "@atproto/api";

const PASSWORD = Bun.env.BSKY_PASSWORD ?? "";
const agent = new AtpAgent({
	service: "https://bsky.social",
});

try {
	await agent.login({
		identifier: "rython.dev",
		password: PASSWORD,
	});
	console.log("Bluesky Login successful");
} catch (error) {
	console.error("Error during Bluesky login:", error);
}

export async function postToBsky(message: string) {
	let postResponse = await agent.post({
		text: message,
		createdAt: new Date().toISOString(),
	});

	let URI_array = postResponse["uri"].split("/");
	let postID = URI_array[URI_array.length - 1];
	return postID;
}
