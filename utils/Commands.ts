// text files
export type textFilename = "compliments" | "quotes" | "timer_messages";
export type jsonFilename = "commands" | "broadcaster_commands";

const SHOUTOUT_PATH = Bun.env.SHOUTOUT_PATH ?? "";

export async function getTextFileContent(
	filename: textFilename
): Promise<string[]> {
	return (await Bun.file(`./txt_files/${filename}.txt`).text())
		.replaceAll("\r", "")
		.split("\n");
}

export async function getShoutouts() {
	return (await Bun.file(SHOUTOUT_PATH).text())
		.replaceAll("\r", "")
		.split(" ");
}

export async function addToShoutout(streamer: string) {
	let shoutouts = await getShoutouts();

	shoutouts.push(streamer);

	await Bun.write(SHOUTOUT_PATH, shoutouts.join(" "));
}

// commands (json files)
export async function getCommands(filename: jsonFilename) {
	return await Bun.file(`./json_files/${filename}.json`).json();
}

// Write to file (text)
async function writeToTextFile(filename: textFilename, array: string[]) {
	let outputString = array.join("\n");
	Bun.write(`./txt_files/${filename}.txt`, outputString);
}

async function writeToCommandsFile(
	filename: jsonFilename,
	jsonArray: { [key: string]: string }
) {
	Bun.write(`./json_files/${filename}.json`, JSON.stringify(jsonArray));
}

// Add new line to quotes
export async function addToTextFile(
	filename: textFilename,
	newString: string
): Promise<boolean> {
	let fileContentArray = await getTextFileContent(filename);
	fileContentArray.push(newString);
	await writeToTextFile(filename, fileContentArray);
	return true;
}

// Add new command
export async function addCommand(
	filename: jsonFilename,
	commandName: string,
	commandOutput: string
): Promise<boolean> {
	commandName = commandName.toLowerCase();

	let commandsJson = await getCommands(filename);

	if (commandsJson[commandName]) {
		return false;
	}

	commandsJson[commandName] = commandOutput;

	await writeToCommandsFile(filename, commandsJson);

	return true;
}

export async function removeCommand(
	filename: jsonFilename,
	commandName: string
): Promise<boolean> {
	commandName = commandName.toLowerCase();

	let commandsJson = await getCommands(filename);

	if (!commandsJson[commandName]) {
		return false;
	}

	delete commandsJson[commandName];

	writeToCommandsFile(filename, commandsJson);

	return true;
}

export async function editCommand(
	filename: jsonFilename,
	commandName: string,
	commandOutput: string
): Promise<boolean> {
	commandName = commandName.toLowerCase();
	let commandsJson = await getCommands(filename);

	if (!commandsJson[commandName]) {
		return false;
	}

	commandsJson[commandName] = commandOutput;

	await writeToCommandsFile(filename, commandsJson);

	return true;
}
