const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;
const config = require('./settings.json');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running and ready!');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🛡️ Self-ping giữ bot không sleep (4 phút 40s)
setInterval(() => {
  require('http').get(`http://localhost:${PORT}/`);
}, 280000);

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;

   let pendingPromise = Promise.resolve();

   function sendRegister(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/register ${password} ${password}`);
         console.log(`[Auth] Sent /register command.`);

         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);
            if (message.includes('successfully registered')) resolve();
            else if (message.includes('already registered')) resolve();
            else reject(`Registration failed: ${message}`);
         });
      });
   }

   function sendLogin(password) {
      return new Promise((resolve, reject) => {
         bot.chat(`/login ${password}`);
         console.log(`[Auth] Sent /login command.`);

         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);
            if (message.includes('successfully logged in')) resolve();
            else reject(`Login failed: ${message}`);
         });
      });
   }

   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server\x1b[0m');

      if (config.utils['auto-auth'].enabled) {
         const password = config.utils['auto-auth'].password;
         pendingPromise = pendingPromise
            .then(() => sendRegister(password))
            .then(() => sendLogin(password))
            .catch(console.error);
      }

      if (config.utils['chat-messages'].enabled) {
         const messages = config.utils['chat-messages']['messages'];
         if (config.utils['chat-messages'].repeat) {
            let i = 0;
            setInterval(() => {
               bot.chat(`${messages[i]}`);
               i = (i + 1) % messages.length;
            }, config.utils['chat-messages']['repeat-delay'] * 1000);
         } else {
            messages.forEach(msg => bot.chat(msg));
         }
      }

      if (config.position.enabled) {
         const pos = config.position;
         console.log(`\x1b[32m[Afk Bot] Moving to (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`);
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         bot.setControlState('jump', true);
         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
      }
   });

   bot.on('goal_reached', () => {
      console.log(`\x1b[32m[AfkBot] Arrived at target location: ${bot.entity.position}\x1b[0m`);
   });

   bot.on('death', () => {
      console.log(`\x1b[33m[AfkBot] Bot died. Respawned at ${bot.entity.position}\x1b[0m`);
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(createBot, config.utils['auto-recconect-delay']);
      });
   }

   bot.on('kicked', reason => {
      console.log(`\x1b[33m[AfkBot] Bot was kicked. Reason:\n${reason}\x1b[0m`);
   });

   bot.on('error', err => {
      console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`);
   });
}

createBot();