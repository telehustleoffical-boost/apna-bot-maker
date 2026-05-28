import { Telegraf } from 'telegraf';
import vm from 'vm';
import fs from 'fs';
import path from 'path';

const BOTS_FILE = path.join(process.cwd(), 'active-bots.json');

interface BotRecord {
  token: string;
  name: string;
  username: string;
  startedAt: string;
}

interface BotInstance {
  token: string;
  name: string;
  bot: Telegraf;
  info: any;
  startedAt: Date;
  code?: string;
}

const activeBots = new Map<string, BotInstance>();

function persistBots() {
  try {
    const records: BotRecord[] = Array.from(activeBots.values()).map(b => ({
      token: b.token,
      name: b.name,
      username: b.info.username,
      startedAt: b.startedAt.toISOString(),
    }));
    fs.writeFileSync(BOTS_FILE, JSON.stringify(records, null, 2));
  } catch (e) {
    console.error('[BotManager] Persist error:', e);
  }
}

export async function restoreBots(globalCode: string, appUrl?: string) {
  if (!fs.existsSync(BOTS_FILE)) return;
  try {
    const records: BotRecord[] = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf-8'));
    console.log(`[BotManager] Restoring ${records.length} bot(s)...`);
    for (const rec of records) {
      try {
        await addBot(rec.token, rec.name, globalCode, appUrl, true);
        console.log(`[BotManager] ✅ Restored @${rec.username}`);
      } catch (e: any) {
        console.error(`[BotManager] ❌ ${rec.username}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('[BotManager] Restore error:', e);
  }
}

export async function addBot(
  token: string,
  name?: string,
  code?: string,
  requestAppUrl?: string,
  isRestore = false
) {
  if (activeBots.has(token)) {
    if (isRestore) return;
    throw new Error('Bot already running.');
  }

  const bot = new Telegraf(token);

  if (code && code.trim() !== '') {
    const sandbox = {
      bot, console, setTimeout, clearTimeout,
      setInterval, clearInterval, Buffer, Math, Date, JSON, fetch,
      process: { env: {} },
    };
    vm.createContext(sandbox);
    try {
      vm.runInContext(code, sandbox, { timeout: 2000 });
    } catch (err: any) {
      throw new Error(`Code error: ${err.message}`);
    }
  } else {
    bot.start((ctx) => ctx.reply('Hello! Powered by BotNest! 🚀'));
    bot.on('text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`));
  }

  bot.catch((err: any, ctx: any) => {
    console.error(`[Bot Error]:`, err?.message);
  });

  let me: any;
  try {
    me = await bot.telegram.getMe();
  } catch (e: any) {
    throw new Error(`Invalid token: ${e.message}`);
  }

  const baseUrl = requestAppUrl || process.env.APP_URL || '';
  const safeUrl = baseUrl.replace(/^http:\/\//, 'https://').replace(/\/$/, '');
  const isCloud = safeUrl.startsWith('https://') && !safeUrl.includes('localhost');

  await bot.telegram.deleteWebhook({ drop_pending_updates: true });

  if (isCloud) {
    const webhookUrl = `${safeUrl}/api/bots/webhook/${token}`;
    try {
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
      console.log(`[BotManager] ✅ Webhook: @${me.username}`);
    } catch (e: any) {
      console.warn(`[BotManager] Webhook failed, polling: ${e.message}`);
      bot.launch().catch(err => console.error(`[Polling]:`, err.message));
    }
  } else {
    bot.launch().catch(err => console.error(`[Polling]:`, err.message));
  }

  const instance: BotInstance = {
    token,
    name: name || me.first_name,
    bot,
    info: me,
    startedAt: new Date(),
    code,
  };

  activeBots.set(token, instance);
  persistBots();

  return {
    username: me.username,
    name: instance.name,
    startedAt: instance.startedAt,
  };
}

export function removeBot(token: string): boolean {
  const instance = activeBots.get(token);
  if (instance) {
    try {
      instance.bot.stop('Stopped');
      instance.bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    } catch (_) {}
    activeBots.delete(token);
    persistBots();
    return true;
  }
  return false;
}

export function getBotInstance(token: string) {
  return activeBots.get(token);
}

export function getActiveBots() {
  return Array.from(activeBots.values()).map(b => ({
    token: b.token,
    maskedToken: b.token.substring(0, 8) + '...',
    username: b.info.username,
    name: b.name,
    startedAt: b.startedAt,
  }));
}

process.once('SIGINT', () => activeBots.forEach(i => i.bot.stop('SIGINT')));
process.once('SIGTERM', () => activeBots.forEach(i => i.bot.stop('SIGTERM')));
