import axios from "axios";

const clientId = Bun.env.CLIENT_ID;
const clientSecret = Bun.env.CLIENT_SECRET;
const token = await getAppAccessToken();

async function getAppAccessToken() {
	try {
		const response = await axios.post(
			`https://id.twitch.tv/oauth2/token`,
			null,
			{
				params: {
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: "client_credentials",
				},
			}
		);
		const token = response.data.access_token;
		return token;
	} catch (error: any) {
		console.error(
			"Error fetching token: ",
			error.response ? error.response.data : error.message
		);
	}
}

export async function getProfileURL(userID: string) {
	try {
		const response = await axios.get(
			`https://api.twitch.tv/helix/users?id=${userID}`,
			{
				headers: {
					"Client-Id": clientId,
					Authorization: `Bearer ${token}`,
				},
			}
		);

		return response.data.data[0].profile_image_url;
	} catch (error) {
		console.error(error);
		throw error; // Re-throw the error to handle it in the calling function if needed
	}
}

function convertSecondsToHMS(seconds: number) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secondsRemainder = seconds % 60;

	return `${hours}h${minutes}m${secondsRemainder}s`;
}

export async function getVODTimestamp(broadcasterID: string = "248474026") {
	try {
		const response = await axios.get(
			`https://api.twitch.tv/helix/videos?user_id=${broadcasterID}`,
			{
				headers: {
					"Client-Id": clientId,
					Authorization: `Bearer ${token}`,
				},
			}
		);

		let VOD = response.data.data[0];
		let VOD_URL = VOD.url;
		let VOD_created_at = VOD.created_at;

		let secondsAgo =
			Math.floor(
				(Date.now() - new Date(VOD_created_at).getTime()) / 1000
			) - 3; // add 3 second

		let timestamp = convertSecondsToHMS(secondsAgo);

		return `${VOD_URL}?t=${timestamp}`;
	} catch (error) {
		console.error(error);
		throw error; // Re-throw the error to handle it in the calling function if needed
	}
}

export async function checkUserExists(name: string) {
	try {
		const response = await axios.get(
			`https://api.twitch.tv/helix/users?login=${name}`,
			{
				headers: {
					"Client-Id": clientId,
					Authorization: `Bearer ${token}`,
				},
			}
		);

		return true;
	} catch (error) {
		return false;
	}
}
