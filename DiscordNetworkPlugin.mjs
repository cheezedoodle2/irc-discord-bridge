import fs from "node:fs";
import path from 'node:path';
import { Client, GatewayIntentBits, Collection, ChannelType } from "discord.js";
import { GlobalSettings } from './globalSettings.mjs';
import { ConfigurationError } from './ConfigurationError.mjs';
import { dbg } from './util.mjs';
import TrackerRemover from './trackers.mjs';

export default class DiscordNetworkPlugin {
    async loadCommands() {
        this.client.commands = new Collection();

        const commandsPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.mjs'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            dbg(`Loading command file ${filePath}...`);
            const { command } = await import(filePath);
            if ('data' in command && 'execute' in command) {
                this.client.commands.set(command.data.name, command);
                dbg(`Loaded command file ${filePath}, name: ${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    async loadEvents() {
        let eventsPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'events');
        let eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.mjs'));
        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            dbg(`Loading event file ${filePath}...`);
            const eventModule = await import(filePath);
            const { eventName, once, execute } = eventModule;
            const eventNameHandlerName = eventName + 'Handler';
            this[eventNameHandlerName] = execute;
            if (once) {
                this.client.once(eventName, (...args) => this[eventNameHandlerName](...args));
            } else {
                this.client.on(eventName, (...args) => this[eventNameHandlerName](...args));
            }            /*
            if (once) {
                this.client.once(eventName, (...args) => execute(...args));
            } else {
                this.client.on(eventName, (...args) => execute(...args));
            }
            */
            dbg(`Loaded event file ${filePath}, eventName: ${eventName}, once: ${once}`);
        }
    }

    externalCall(operation, params, expected = 'object') {
        let result = operation.apply(this, params);
        if(typeof(result) != expected) {
            throw new TypeError(`Operation ${operation} on subject ${params} returned wrong type`);
        }
        return result;
    }

    // IRC servers map to Discord channel categories, IRC channels map to Discord
    // channels in the corresponding channel category.
    syncChannels(np, channelList) {
        if(np == this.constructor.name) {
            return;
        }

        dbg(`Syncing channels from ${np} to ${this.constructor.name}...`);

        for(let channel of channelList) {
            let discordGuilds = this.client.guilds.cache;
            let candidateGuilds = discordGuilds;

            for(let discordGuild of discordGuilds) {
                for(let discordGuildChannelCategory of discordGuild[1].channels.cache.filter(channel => channel.type == ChannelType.GuildCategory)) {
                    if(discordGuildChannelCategory.name == channel.server) {
                        dbg(`Discord channel category ${channel.server} already exists on ${discordGuild[1].name}`);
                        candidateGuilds.remove(discordGuild.guildId);
                        break;
                    }
                }
            }
            if(candidateGuilds.size > 0) {
                for(let candidateGuild of candidateGuilds) {
                    dbg(`Creating Discord channel category ${channel.server} in ${candidateGuild[1].name}`);
                    //candidateGuild.channels.create(channel.server, { type: 'GUILD_CATEGORY' });
                }
            }

            for(let discordGuild of discordGuilds) {
                let candidateGuildChannelCategories = discordGuild[1].channels.cache
                    .filter(candidateChannelCategory => candidateChannelCategory.name == channel.server);
                for(let candidateGuildChannelCategory of candidateGuildChannelCategories) {
                    for(let candidateChannel of candidateGuildChannelCategory[1].children.cache
                        .filter(candidateChannel => candidateChannel.type == ChannelType.GuildText)) {
                        if(candidateChannel.name == channel.channel) {
                            dbg(`Discord channel ${channel.channel} already exists in ${candidateGuildChannelCategory.name} in ${candidateGuildChannelCategory.guild.name}`);
                            candidateGuildChannelCategories.remove(candidateGuildChannelCategory.id);
                            break;
                        }
                    }
                    break;
                }
                if(candidateGuildChannelCategories.size > 0) {
                    for(let candidateChannelCategory of candidateGuildChannelCategories) {
                        console.log(candidateChannelCategory);
                        dbg(`Creating Discord channel ${channel.channel} in ${candidateChannelCategory[1].name} in ${candidateChannelCategory[1].guild.name}`);
                        //candidateChannelCategory.createChannel(channel.channel);
                    }
                }
            }
        }
    }

    constructor(bot, configFileName) {
        this.bot = bot;
        this.configFileName = configFileName;
        // { channel: username }
        this.lastUsernames = {};
        // { channel: message }
        this.lastEmbedMessageHandles = {};
    }

    async newMessageHandler(np, from, to, message) {
        dbg(`${np} -> ${this.constructor.name}: ${from} => ${to}: ${message}`);
        let channel = this.client.channels.cache.find(channel => channel.id === this.bot.config.logChannelId);

        // Convert any IRC style `username: ` prefixes to Discord style notifications <@username>
        let discordIRCUserNameMappings = this.bot.config.discordIRCUserNameMappings;
        if(discordIRCUserNameMappings) {
            for(let mapping of discordIRCUserNameMappings) {
                const searchKey = `${mapping.ircUserName}: `;
                if(message.indexOf(searchKey) != 0) {
                    continue;
                }

                channel.send(`<@${mapping.discordUserID}>`);
            }
        }

        const linkRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.match(linkRegex);

        // See if we had any matches, and if so, remove the trackers
        let bare_urls = [];
        if(links) {
            for(let link of links) {
                let bare_url = link;

                try {
                    bare_url = TrackerRemover.removeTrackersFromUrl(link);
                }
                catch(error) {
                    console.error(`Something went wrong removing trackers from URL:\n  link: ${link}\n  bare_url: ${bare_url}\n${error}`);
                }
                bare_urls.push(bare_url);
            }
        }
        // If we're in text mode, send the text message and return, otherwise...
        if(this.bot.config.discordMessageStyle == 'text') {
            channel.send(`**${to}** <\`${from}\`> ${message}`);
            return;
        }

        // We're in embed mode.

        // If the sender of this message is the same as the last sender to this
        // destination, then we can just edit the last message instead of
        // sending a new one.
        if(this.lastUsernames[to] == from) {
            message = `${this.lastEmbedMessageHandles[to].embeds[0].description}\n${message}`;
        }

        const embed = {
            "type": "rich",
            "title": `${from}`,
            "description": `${message}`,
            "color": 0x289191,
            "author": {
                "name": `${to}`
            }
        };

        let messageHandle = null;
        if(this.lastUsernames[to] == from) {
            // Edit the last embed if it's from the same user.
            this.lastEmbedMessageHandles[to].edit({embeds: [embed]});
        }
        else {
            // Send a new embed if it's from a different user.
            messageHandle = await channel.send({embeds: [embed]});
            this.lastEmbedMessageHandles[to] = messageHandle;
        }
        this.lastUsernames[to] = from;

        // Send any links we found, so they get a preview.
        if(bare_urls.length > 0) {
            for(let bare_url of bare_urls) {
                channel.send(`${from} ${bare_url}`);
            }
        }
    }

    async initialize() {
        let previousOperationResults = null;
        try {
            let readFileOperation = {
                operation: fs.readFileSync,
                params: [this.configFileName, GlobalSettings.defaultConfigFileEncoding],
                expected: 'string',
            }

            let parseFileOperation = {
                operation: JSON.parse,
                get params() { return [previousOperationResults]; },
                expected: 'object',
            }

            let operations = [readFileOperation, parseFileOperation];

            for(let operation of operations) {
                try {
                    previousOperationResults = this.externalCall(operation.operation, operation.params, operation.expected);
                }
                catch(operationError) {
                    throw(new ConfigurationError(operation.params, operation.operation, operation.expected, operation.returnValue, { cause: operationError }));
                }
            }
        }
        catch(configurationError) {
            if(! (configurationError instanceof ConfigurationError)) {
                console.error(`Internal error initializing, caught unexpected error of type ${typeof(configurationError)} instead of ConfigurationError: ${configurationError}`);
                process.exit(1);
            }

            console.error(configurationError);
        }

        this.bot.config = previousOperationResults;

        let intents = [];
        for(const intent of this.bot.config.intents) {
            if(! intent in GatewayIntentBits) {
                console.error(`Invalid intent: ${intent}`);
                process.exit(1);
            }
            intents.push(GatewayIntentBits[intent]);
        }
        
        this.client = new Client({ 
            intents: intents
        });

        this.loadCommands();
        this.loadEvents();

        let syncChannelsHandler = this.syncChannels.bind(this);
        this.bot.events.on(this.bot.eventNames.NP_CHANNEL_LIST, syncChannelsHandler);
        let promise = this.client.login(this.bot.config.token);
        return new Promise((resolve, reject) => {
            promise.then(() => {
                dbg(`Discord initialization complete`);
                let thisSourceFileName = new URL(import.meta.url).pathname;

                let stats = fs.statSync(thisSourceFileName);

                resolve(`${this.constructor.name} ${import.meta.url} version ${stats.mtime} startup ${process.uptime()} seconds`);
            }).catch((err) => {
                reject(err);
            });
        });
    }
}

export { DiscordNetworkPlugin };