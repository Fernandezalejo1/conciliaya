/**
 * Discord Webhook Notification Utility
 * 
 * Sends formatted messages to Discord when tasks complete.
 * 
 * Usage:
 *   npx tsx discord-notify.ts "Task completed" "Here are the details..."
 * 
 * Environment:
 *   DISCORD_WEBHOOK_URL - Your Discord webhook URL
 */

import 'dotenv/config';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error('❌ Error: DISCORD_WEBHOOK_URL not set in environment');
  console.log('Add to your .env file:');
  console.log('DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN');
  process.exit(1);
}

interface DiscordMessage {
  title: string;
  description: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export async function sendDiscordNotification(msg: DiscordMessage): Promise<void> {
  const embed = {
    title: msg.title,
    description: msg.description,
    color: msg.color || 0x00ff00, // Green by default
    fields: msg.fields || [],
    timestamp: new Date().toISOString(),
  };

  const payload = {
    embeds: [embed],
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    console.log('✅ Notification sent to Discord');
  } catch (error) {
    console.error('❌ Failed to send Discord notification:', error);
  }
}

// CLI mode: parse arguments and send
if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith('discord-notify.ts')) {
  const args = process.argv.slice(2);
  const title = args[0] || 'Task Completed';
  const description = args[1] || 'No description provided';
  const color = args[2] ? parseInt(args[2], 16) : 0x00ff00;

  sendDiscordNotification({ title, description, color });
}
