import { bot } from './util.mjs';
// TODO dump these in a directory and find them
import DiscordNetworkPlugin from './DiscordNetworkPlugin.mjs';
import IRCNetworkPlugin from './IRCNetworkPlugin.mjs';

function findPlugins() {
    let discordNetworkPlugin = new DiscordNetworkPlugin(bot, 'config.json');
    let ircNetworkPlugin = new IRCNetworkPlugin(bot, 'config.json');
    return [discordNetworkPlugin.initialize(), ircNetworkPlugin.initialize()];
}

function completeStartup(plugins) {
    console.log(`Loaded ${plugins.length} plugins in ${process.uptime()} seconds\n${plugins.join('\n')}}`); 
}

bot.events.on(bot.eventNames.NP_CHANNEL_LIST, (pluginName, channelList) => {
    console.log(`Channel list from plugin ${pluginName}:\n${JSON.stringify(channelList)}`);
});

await Promise.all(findPlugins())
    .then(completeStartup)
    .catch((err) => { console.error(err); });
