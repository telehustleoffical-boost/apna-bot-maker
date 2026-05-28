import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const SETTINGS_FILE = path.join(process.cwd(), 'bot-settings.json');

interface Settings {
  apiKey: string;
  globalBotCode: string;
}

function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  const defaultSettings: Settings = {
    apiKey: uuidv4(),
    globalBotCode: `// Write your bot logic here\nbot.start((ctx) => ctx.reply('Hello! I am hosted on BotNest! 🚀'));\nbot.on('text', (ctx) => ctx.reply('You said: ' + ctx.message.text));`,
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  return defaultSettings;
}

let settings = loadSettings();

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(apiKey?: string, globalBotCode?: string) {
  if (apiKey !== undefined) settings.apiKey = apiKey;
  if (globalBotCode !== undefined) settings.globalBotCode = globalBotCode;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
