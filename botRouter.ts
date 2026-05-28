import { Router } from 'express';
import { addBot, removeBot, getActiveBots, getBotInstance, restoreBots } from './botManager.js';
import { getSettings, updateSettings } from './globalSettings.js';

export const botRouter = Router();

function getAppUrl(req: any): string {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const safeProto = isLocal ? proto : 'https';
  return `${safeProto}://${host}`;
}

botRouter.post('/webhook/:token', async (req, res) => {
  const { token } = req.params;
  const instance = getBotInstance(token);
  if (instance?.bot) {
    try {
      await instance.bot.handleUpdate(req.body, res);
    } catch (e) {
      if (!res.headersSent) res.sendStatus(500);
    }
  } else {
    res.sendStatus(200);
  }
});

botRouter.get('/', (req, res) => {
  res.json({ success: true, bots: getActiveBots() });
});

botRouter.get('/settings', (req, res) => {
  res.json({ success: true, settings: getSettings() });
});

botRouter.post('/settings', (req, res) => {
  const { apiKey, globalBotCode } = req.body;
  updateSettings(apiKey, globalBotCode);
  res.json({ success: true, settings: getSettings() });
});

const handleAutoDeploy = async (req: any, res: any) => {
  const { token, key } = req.method === 'GET' ? req.query : req.body;

  if (!token) return res.status(400).json({ success: false, error: 'Token required' });
  if (key !== getSettings().apiKey) return res.status(403).json({ success: false, error: 'Invalid API key' });

  try {
    const { globalBotCode } = getSettings();
    removeBot(token as string);
    const appUrl = process.env.APP_URL || getAppUrl(req);
    const botInfo = await addBot(token as string, undefined, globalBotCode, appUrl);
    res.json({ success: true, message: '🚀 Bot deployed!', bot: botInfo });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
};

botRouter.get('/auto-deploy', handleAutoDeploy);
botRouter.post('/auto-deploy', handleAutoDeploy);

botRouter.post('/start', async (req, res) => {
  const { token, name, code } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });
  try {
    const appUrl = process.env.APP_URL || getAppUrl(req);
    const botInfo = await addBot(token, name, code, appUrl);
    res.json({ success: true, message: 'Bot started!', bot: botInfo });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

botRouter.post('/stop', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });
  const ok = removeBot(token);
  ok
    ? res.json({ success: true, message: 'Bot stopped' })
    : res.status(404).json({ success: false, error: 'Bot not found' });
});

export async function restoreBotsOnStartup(appUrl?: string) {
  const { globalBotCode } = getSettings();
  await restoreBots(globalBotCode, appUrl);
               }
