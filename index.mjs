import fs from "node:fs";
import path from 'node:path';
import irc from 'matrix-org-irc';
import { Client, GatewayIntentBits, Collection } from "discord.js";
import './util.mjs';

const configFile = fs.readFileSync("config.json", "utf8");
const config = JSON.parse(configFile);

let intents = [];
for(const intent of config.intents) {
    if(! intent in GatewayIntentBits) {
        console.error(`Invalid intent: ${intent}`);
        process.exit(1);
    }
    intents.push(GatewayIntentBits[intent]);
}
const client = new Client({ 
    intents: intents
});

client.commands = new Collection();

const commandsPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.mjs'));

debugLevel = 1;
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    dbg(`Loading command file ${filePath}...`);
    const { command } = await import(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        dbg(`Loaded command file ${filePath}, name: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const eventsPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.mjs'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    dbg(`Loading event file ${filePath}...`);
    const eventModule = await import(filePath)
    const { eventName, once, execute } = eventModule;
    if (once) {
        client.once(eventName, (...args) => execute(...args));
    } else {
        client.on(eventName, (...args) => execute(...args));
    }
    dbg(`Loaded event file ${filePath}, eventName: ${eventName}, once: ${once}`);
}

client.login(config.token);

let ircClient = new irc.Client(config.ircServer, config.ircUserName, {
    channels: config.ircChannels,
    autoConnect: false,
    port: config.ircPort,
    userName: config.ircUserName,
    realName: config.ircRealName,
    showErrors: true,
    floodProtection: true,
    debug: true
});
ircClient.connect();
ircClient.on('raw', (message) => {
    dbg(`IRC raw: ${message.rawCommand}`);
});
ircClient.on('message', (from, to, message) => {
    dbg(`IRC message: ${from} => ${to}: ${message}`);
    let channel = client.channels.cache.find(channel => channel.id === config.logChannelId);
    channel.send(`${to} ${from}: ${message}`);
});
