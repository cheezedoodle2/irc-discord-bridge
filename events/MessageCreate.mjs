import { Events } from 'discord.js';

let eventName = Events.MessageCreate;
let once = false;
async function execute(message) {
    dbg("message: " + message.cleanContent);
    if (message.author.bot) return;
}

export { eventName, once, execute }
