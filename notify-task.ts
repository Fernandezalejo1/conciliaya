/**
 * Example: Send a detailed task completion notification
 * 
 * Usage: npx tsx notify-task.ts
 */

import { sendDiscordNotification } from './discord-notify.js';

async function main() {
  await sendDiscordNotification({
    title: '✅ Tarea Completada',
    description: 'Se terminó de trabajar en el proyecto.',
    color: 0x00ff00, // Green
    fields: [
      { name: '📋 Tarea', value: 'Fix login bug', inline: false },
      { name: '📝 Cambios', value: '• Fixed auth.js\n• Updated tests', inline: false },
      { name: '⏱️ Tiempo', value: '15 minutos', inline: true },
    ],
  });
}

main();
