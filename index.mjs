import { bot } from './util.mjs';
// TODO dump these in a directory and find them
import DiscordNetworkPlugin from './DiscordNetworkPlugin.mjs';
import IRCNetworkPlugin from './IRCNetworkPlugin.mjs';
import { Configuration, OpenAIApi } from 'openai';

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

// Create a probability distribution divided into 24 buckets, one for each hour of the day, representing the alertness level of a typical human.
// The distribution is based on the following assumptions:
// - The average human sleeps 8 hours per day.
// - The average human is awake for 16 hours per day.
// - The average human is most alert in the middle of the day.

const alertnessDistribution = [
    0.000133830225764885,
    0.000398942280401433,
    0.00119192985971972,
    0.00301604782035943,
    0.00660622784758738,
    0.0124875042345915,
    0.0211290298278373,
    0.0324503268529390,
    0.0455002638963584,
    0.0588836265276773,
    0.0707980333313558,
    0.0797884560802865,
    0.0847389587389464,
    0.0847389587389464,
    0.0797884560802865,
    0.0707980333313558,
    0.0588836265276773,
    0.0455002638963584,
    0.0324503268529390,
    0.0211290298278373,
    0.0124875042345915,
    0.00660622784758738,
    0.00301604782035943,
    0.00119192985971972,
    0.000398942280401433,
    0.000133830225764885
];

const configuration = new Configuration({
    apiKey: bot.config.openAIKey
});
const openai = new OpenAIApi(configuration)

function hourlyResponder() {
    // figure out what the current hour is
    let now = new Date();
    let hour = now.getHours();

    // get a random number between 0 and 1
    let random = Math.random();
    if(random < alertnessDistribution[hour]) {
    //if(true) {
        openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [{role: "user", content: 'You are awake at ' + hour + ':00'}]
        }).then((response) => {
            bot.events.emit(bot.eventNames.NP_NEW_MESSAGE, 'OpenAI', 'OpenAI', 'OpenAI', response.data.choices[0].text);
            console.log(response.data.choices[0].text);
        }).catch((err) => {
            console.error(err);
        });

        console.log(`You are awake at ${hour}:00`);
    }

    setTimeout(hourlyResponder, 1000 * 60 * 60);
}

hourlyResponder();
