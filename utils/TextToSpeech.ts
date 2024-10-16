import { exec } from "child_process";
import { client } from "./SBClient";

// Function to escape single quotes for PowerShell
function escapeTextForPowershell(text: string): string {
	return text.replace(/'/g, "''");
}

export async function textToSpeechPrivate(message: string) {
	// Escape any single quotes in the text for PowerShell
	const escapedText = escapeTextForPowershell(message);

	// PowerShell command to invoke the SpeechSynthesizer
	const command = `powershell.exe Add-Type -AssemblyName System.speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${escapedText}')`;

	// Execute PowerShell command
	exec(command, (error, stdout, stderr) => {
		if (error) {
			console.error(`Error: ${error.message}`);
			return;
		}
		if (stderr) {
			console.error(`stderr: ${stderr}`);
			return;
		}
		// console.log("Text-to-speech complete.");
	});
}

export async function textToSpeechPublic(message: string) {
	client.doAction("140817ef-16c6-4c63-a269-492d382597b9", {
		messageStripped: message,
	});
}
