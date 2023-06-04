import { SlashCommandBuilder } from '@discordjs/builders';

let data = new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Ping the bot');

async function execute(interaction) {
	dbg(`interaction: ${interaction}`);
	await interaction.reply({content: 'pong!'});
}

let command = {
	data: data,
	execute: execute
};

export { command }