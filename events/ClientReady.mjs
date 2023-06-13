import { Events, ChannelType } from 'discord.js';
import { bot, dbg } from '../util.mjs';

let eventName = Events.ClientReady;
let once = false;

async function execute(client) {
    dbg(`${this.constructor.name} ClientReady: ${client.user.tag}`);
    bot.events.emit(bot.eventNames.NP_READY, this.constructor.name);

    // This unusual lambda is because the callback is executed by an EventEmitter instance, so
    // the 'this' context is not the same as the 'this' context of the execute() function.
    // This is a workaround to make sure the callback can access the 'this' context of the
    // network plugin, so it can access the instance variables like the discord client, etc.
    // I think we're supposed to use bind here...
    bot.events.on(bot.eventNames.NP_NEW_MESSAGE, (...args) => { this.newMessageHandler.apply(this, [...args]) });

    // Get the list of channels from the discord client as an array of objects where
    // the 'server' property is the guild name and the 'channel' property is the channel name.
    let channelList = [];
    client.channels.cache.forEach(channel => {
        if(channel.type == ChannelType.GuildText) {
            channelList.push({ server: channel.guild.name, channel: channel.name });
        }
    });

    bot.events.emit(bot.eventNames.NP_CHANNEL_LIST, this.constructor.name, channelList);
}

export { eventName, once, execute }