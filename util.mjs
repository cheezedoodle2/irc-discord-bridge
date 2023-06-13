import { EventEmitter } from 'node:events';

let dbg = function dbg(s) {
    if(debugLevel > 0) {
        console.debug(s);
    }
}

let bot = {}

let events = new EventEmitter();
bot.events = events;

// TODO move this somewhere else
let eventNames = {
     NP_READY:  "NP_READY_EVENT",
     NP_NEW_MESSAGE: "NP_NEW_MESSAGE_EVENT",
     NP_CHANNEL_LIST: "NP_CHANNEL_LIST_EVENT"
}
bot.eventNames = eventNames;

let networkPlugins = {};
bot.networkPlugins = networkPlugins;

let debugLevel = 0;
if(process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'test') {
    debugLevel = 1;
}
bot.debugLevel = debugLevel;

console.bot = bot;

export { bot, dbg }
