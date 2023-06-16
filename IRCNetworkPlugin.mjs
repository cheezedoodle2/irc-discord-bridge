import { dbg } from './util.mjs';
import fs from 'node:fs';
import irc from 'matrix-org-irc';

export default class IRCNetworkPlugin {
    IRC_READY = "_IRC_READY_EVENT";
    constructor(bot) {
        this.bot = bot;
    }

    initialize() {
        let ircClientParams = {
            channels: this.bot.config.ircChannels,
            autoConnect: false,
            port: this.bot.config.ircPort,
            userName: this.bot.config.ircUserName,
            realName: this.bot.config.ircRealName,
            showErrors: true,
            floodProtection: true,
        };

        if(this.bot.dbgLevel > 0) {
            ircClientParams.debug = true;
        }

        let ircClient = new irc.Client(this.bot.config.ircServer, 
            this.bot.config.ircUserName, 
            ircClientParams);
        
        ircClient.on('raw', (message) => {
            dbg(`IRC raw: ${message.rawCommand}`);
        });

        let ircChannelsStatus = {};

        ircClient.on('join', (channel, nick, message) => {
            dbg(`IRC join: ${nick} joined ${channel}`);
            ircChannelsStatus[channel] = true;
            if(Object.keys(ircChannelsStatus).length == this.bot.config.ircChannels.length) {
                this.bot.events.emit(this.IRC_READY);
                this.bot.events.emit(this.bot.eventNames.NP_READY, this.constructor.name);
                
                let channelList = [];
                for(let channelName of this.bot.config.ircChannels) {
                    channelList.push({ server: this.bot.config.ircServer, channel: channelName });
                }
                this.bot.events.emit(this.bot.eventNames.NP_CHANNEL_LIST, this.constructor.name, channelList);
            }
        });

        ircClient.on('join', (channel, nick, message) => {
            dbg(`IRC JOIN: ${nick} joined ${channel}: ${message}`);
            dbg(`message`);
            this.bot.events.emit(this.bot.eventNames.NP_NEW_MESSAGE, this.constructor.name, nick, channel, `${nick} joined ${channel}`);
        });
        ircClient.on('nick', (oldnick, newnick, channels, message) => {
            dbg(`IRC NICK: ${oldnick} -> ${newnick}, ${message}`);
            this.bot.events.emit(this.bot.eventNames.NP_NEW_MESSAGE, this.constructor.name, 'IRC', 'NICK', `${oldnick} -> ${newnick}`);
        });
        ircClient.on('part', (channel, nick, reason, message) => {
            dbg(`IRC PART: ${nick} parted ${channel}: ${reason}, ${message}`);
            this.bot.events.emit(this.bot.eventNames.NP_NEW_MESSAGE, this.constructor.name, nick, channel, `${nick} left ${channel}${reason ? ": {reason}" : ""}`);
        });

        ircClient.on('message', async (from, to, message) => {
            dbg(`IRC message: ${from} => ${to}: ${message}`);
            this.bot.events.emit(this.bot.eventNames.NP_NEW_MESSAGE, this.constructor.name, from, to, message);
        });

        ircClient.connect();

        return new Promise((resolve, reject) => {
            this.bot.events.once(this.IRC_READY, async () => {
                dbg(`IRC initialization complete`);
                let thisSourceFileName = new URL(import.meta.url).pathname;

                let stats = fs.statSync(thisSourceFileName);

                resolve(`${this.constructor.name} ${import.meta.url} version ${stats.mtime} startup ${process.uptime()} seconds`);
            });
        });
    }
}
