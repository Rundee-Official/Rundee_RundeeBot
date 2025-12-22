/**
 * @fileoverview Rundee Bot - Discord bot for meeting reminders and GitHub integration
 * @copyright Rundee 2024
 * @license MIT
 */

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import db, { meetingQueries, guildSettingsQueries, getNextMeetingId } from './database.js';
import { t, getGuildLanguage } from './messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Temporary storage for deleted meetings (for undo functionality)
// Stores deleted meeting data for 5 minutes
const deletedMeetings = new Map();
const UNDO_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Middleware for GitHub webhooks (raw body for signature verification)
app.use('/webhook/github', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const signature = req.headers['x-hub-signature-256'];
    if (signature) {
      const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
      const digest = 'sha256=' + hmac.update(req.body).digest('hex');
      if (signature !== digest) {
        return res.status(401).send('Invalid signature');
      }
    }
  }
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Rundee Bot is running!');
});

// Terms of Service page
app.get('/terms-of-service', (req, res) => {
  try {
    const html = readFileSync(join(__dirname, 'public', 'terms-of-service.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error serving terms of service:', error);
    res.status(500).send('Terms of Service page not available');
  }
});

// Privacy Policy page
app.get('/privacy-policy', (req, res) => {
  try {
    const html = readFileSync(join(__dirname, 'public', 'privacy-policy.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error serving privacy policy:', error);
    res.status(500).send('Privacy Policy page not available');
  }
});

// Discord interactions endpoint
app.post('/interactions',
  express.raw({ type: 'application/json' }),
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async (req, res) => {
    try {
      // Parse body - verifyKeyMiddleware may have already parsed it
      let body;
      if (Buffer.isBuffer(req.body)) {
        body = JSON.parse(req.body.toString());
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body; // Already parsed
      }
      
      const { id, type, data } = body;
      const guildId = body.guild_id;
      const channelId = body.channel?.id;

      if (type === InteractionType.PING) {
        return res.json({ type: InteractionResponseType.PONG });
      }

      if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data;

        try {
          // Handle subcommands
          if (options && options.length > 0 && options[0].type === 1) {
            // SUB_COMMAND type (1)
            const subcommand = options[0].name;
            const subcommandOptions = options[0].options || [];

            // Meeting command group
            if (name === 'meeting') {
              if (subcommand === 'list') {
                return await handleListMeetings(guildId, res);
              } else if (subcommand === 'create') {
                // Convert subcommand options to match old format
                const convertedData = { options: subcommandOptions };
                return await handleSetMeetingTime(convertedData, guildId, channelId, res);
              } else if (subcommand === 'create-recurring') {
                const convertedData = { options: subcommandOptions };
                return await handleSetRecurringMeeting(convertedData, guildId, channelId, res);
              } else if (subcommand === 'edit') {
                const convertedData = { options: subcommandOptions };
                return await handleEditMeeting(convertedData, res);
              } else if (subcommand === 'delete') {
                const convertedData = { options: subcommandOptions };
                return await handleDeleteMeeting(convertedData, res, body);
              } else if (subcommand === 'channel') {
                const convertedData = { options: subcommandOptions };
                return await handleSetMeetingChannel(convertedData, guildId, channelId, res);
              }
            }
            // GitHub command group
            else if (name === 'github') {
              if (subcommand === 'setup') {
                const convertedData = { options: subcommandOptions };
                return await handleSetupGitHub(convertedData, guildId, channelId, res);
              } else if (subcommand === 'channel') {
                const convertedData = { options: subcommandOptions };
                return await handleSetGithubChannel(convertedData, guildId, channelId, res);
              } else if (subcommand === 'status') {
                return await handleChannelStatus(guildId, res);
              }
            }
            // Config command group
            else if (name === 'config') {
              if (subcommand === 'language') {
                const convertedData = { options: subcommandOptions };
                return await handleSetLanguage(convertedData, guildId, res);
              } else if (subcommand === 'timezone') {
                const convertedData = { options: subcommandOptions };
                return await handleSetTimezone(convertedData, guildId, res);
              } else if (subcommand === 'status') {
                return await handleChannelStatus(guildId, res);
              }
            }
          }

          console.error(`unknown command: ${name}${options?.[0]?.name ? ` ${options[0].name}` : ''}`);
          return res.status(400).json({ error: 'unknown command' });
        } catch (error) {
          console.error('Error handling command:', error);
          const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
          const lang = getGuildLanguage(settings);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: t('errorOccurred', lang, { message: error.message }),
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }
      }

      // Handle MESSAGE_COMPONENT (type 3) - buttons, select menus
      if (type === 3) {
        try {
          return await handleMessageComponent(body, res);
        } catch (error) {
          console.error('Error handling message component:', error);
          const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
          const lang = getGuildLanguage(settings);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: t('errorOccurred', lang, { message: error.message }),
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }
      }

      // Handle MODAL_SUBMIT (type 5) - modal form submissions
      if (type === 5) {
        try {
          return await handleModalSubmit(body, res);
        } catch (error) {
          console.error('Error handling modal submit:', error);
          const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
          const lang = getGuildLanguage(settings);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: t('errorOccurred', lang, { message: error.message }),
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }
      }

      console.error('unknown interaction type', type);
      return res.status(400).json({ error: 'unknown interaction type' });
    } catch (error) {
      console.error('Error in /interactions endpoint:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GitHub Webhook endpoint
 */
app.post('/webhook/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (error) {
    console.error('Error parsing GitHub webhook payload:', error);
    return res.status(400).send('Invalid JSON');
  }

  console.log(`GitHub webhook received: ${event}`);

  try {
    const repository = payload.repository?.full_name;
    if (!repository) {
      return res.status(200).send('OK');
    }

    // Get all guilds with this repository
    const settings = guildSettingsQueries.getAll.all();
    const relevantGuilds = settings.filter(s => s.github_repository === repository);

    if (event === 'push') {
      await handleGitHubPush(payload, relevantGuilds);
    } else if (event === 'pull_request') {
      await handleGitHubPullRequest(payload, relevantGuilds);
    } else if (event === 'issues') {
      await handleGitHubIssue(payload, relevantGuilds);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling GitHub webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Handle list-meetings command
 * @param {string} guildId - Guild ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleListMeetings(guildId, res) {
  const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
  const lang = getGuildLanguage(settings);
  const timezone = settings?.timezone || 'Asia/Seoul';
  
  const meetings = guildId
    ? meetingQueries.getUpcomingByGuild.all(guildId)
    : meetingQueries.getUpcoming.all();

  const now = new Date().toISOString();
  const upcomingMeetings = meetings
    .filter(m => new Date(m.date) > new Date(now))
    .map(dbToMeeting);

  if (upcomingMeetings.length === 0) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('noMeetings', lang),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  const dateLabel = lang === 'ko' ? '일시' : 'Date';
  const participantsLabel = lang === 'ko' ? '참석자' : 'Participants';
  
  const meetingList = upcomingMeetings
    .map(m => {
      const participants = JSON.parse(m.participants);
      const repeatInfo = m.repeatType ? formatRepeatInfo(m.repeatType, lang, m.repeatEndDate, timezone) : '';
      return `**ID: ${m.id}** - ${m.title}\n${dateLabel}: ${formatDateTime(new Date(m.date), timezone)}\n${participantsLabel}: ${formatParticipants(participants)}${repeatInfo}`;
    })
    .join('\n\n');

  // Create delete buttons for meetings (max 5 rows, 5 buttons per row = 25 meetings)
  const components = [];
  if (upcomingMeetings.length > 0 && upcomingMeetings.length <= 25) {
    // Group meetings into rows of 5
    for (let i = 0; i < upcomingMeetings.length; i += 5) {
      const rowMeetings = upcomingMeetings.slice(i, i + 5);
      const buttonRow = {
        type: 1, // ACTION_ROW
        components: rowMeetings.map(m => ({
          type: 2, // BUTTON
          style: 4, // DANGER (red)
          label: m.title.length > 75 ? m.title.substring(0, 72) + '...' : m.title,
          custom_id: `delete_meeting_${m.id}`,
          emoji: { name: '🗑️' },
        })),
      };
      components.push(buttonRow);
    }
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingsList', lang, { list: meetingList }),
      components: components.length > 0 ? components : undefined,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Handle delete-meeting command
 * @param {Object} data - Command data from Discord
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleDeleteMeeting(data, res, body) {
  const meetingId = parseInt(data.options?.find(opt => opt.name === 'meeting_id')?.value);
  
  // Get guild ID from meeting to determine language
  const meeting = meetingQueries.getById.get(meetingId);
  if (!meeting) {
    // Default to English if meeting not found
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingNotFound', 'en', { id: meetingId }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }
  
  const settings = guildSettingsQueries.get.get(meeting.guild_id);
  const lang = getGuildLanguage(settings);
  const timezone = settings?.timezone || 'Asia/Seoul';

  // Store deleted meeting data for undo (5 minutes)
  const deletedMeetingData = {
    id: meeting.id,
    guild_id: meeting.guild_id,
    title: meeting.title,
    date: meeting.date,
    participants: meeting.participants,
    channel_id: meeting.channel_id,
    reminder_minutes: meeting.reminder_minutes,
    repeat_type: meeting.repeat_type,
    repeat_interval: meeting.repeat_interval,
    repeat_end_date: meeting.repeat_end_date,
    deletedAt: Date.now(),
  };
  deletedMeetings.set(meetingId, deletedMeetingData);
  
  // Auto-remove after timeout
  setTimeout(() => {
    deletedMeetings.delete(meetingId);
  }, UNDO_TIMEOUT);

  meetingQueries.delete.run(meetingId);

  // Create undo button
  const undoButton = {
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: 1, // PRIMARY (blue)
        label: lang === 'ko' ? '되돌리기 (Undo)' : 'Undo',
        custom_id: `undo_delete_${meetingId}`,
        emoji: { name: '↩️' },
      },
    ],
  };

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingDeleted', lang, {
        title: meeting.title,
        date: formatDateTime(new Date(meeting.date), timezone),
      }),
      components: [undoButton],
      // No EPHEMERAL flag - visible to everyone
    },
  });
}

/**
 * Handle edit-meeting command
 * @param {Object} data - Command data from Discord
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleEditMeeting(data, res) {
  const meetingId = parseInt(data.options?.find(opt => opt.name === 'meeting_id')?.value);
  
  const meeting = meetingQueries.getById.get(meetingId);
  if (!meeting) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingNotFound', 'en', { id: meetingId }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }
  
  const settings = guildSettingsQueries.get.get(meeting.guild_id);
  const lang = getGuildLanguage(settings);
  const timezone = settings?.timezone || 'Asia/Seoul';

  const dbMeeting = dbToMeeting(meeting);
  let title = dbMeeting.title;
  let date = new Date(dbMeeting.date);
  let participants = JSON.parse(dbMeeting.participants);
  let reminderMinutes = JSON.parse(dbMeeting.reminderMinutes);

  // Update fields if provided
  const titleOption = data.options?.find(opt => opt.name === 'title');
  if (titleOption) title = titleOption.value;

  const dateOption = data.options?.find(opt => opt.name === 'date');
  if (dateOption) {
    date = parseRelativeDate(dateOption.value, new Date(), timezone);
    if (!date) {
      date = new Date(dateOption.value);
      if (isNaN(date.getTime())) {
          return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('invalidDate', lang) + (lang === 'ko' ? '\n\n예: 2025-12-25 14:30, 1시간 후, 내일 오후 3시' : '\n\nExamples: 2025-12-25 14:30, 1 hour later, tomorrow 3pm'),
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }
    
    // Check for conflicts (excluding current meeting)
    const conflictWarning = checkMeetingConflict(meeting.guild_id, date, meetingId, timezone);
    if (conflictWarning) {
      // Still allow the edit, but show warning
    }
  }

  const participantsOption = data.options?.find(opt => opt.name === 'participants');
  if (participantsOption) {
    participants = parseParticipants(participantsOption.value);
  }

  const reminderMinutesOption = data.options?.find(opt => opt.name === 'reminder_minutes');
  if (reminderMinutesOption) {
    reminderMinutes = reminderMinutesOption.value
      .split(',')
      .map(m => parseInt(m.trim()))
      .filter(m => !isNaN(m) && m > 0)
      .sort((a, b) => b - a);
  }

  meetingQueries.update.run(
    title,
    date.toISOString(),
    JSON.stringify(participants),
    JSON.stringify(reminderMinutes),
    dbMeeting.repeatType,
    dbMeeting.repeatInterval,
    dbMeeting.repeatEndDate,
    meetingId
  );

  const editedMessage = t('meetingEdited', lang, {
    title,
    date: formatDateTime(date, timezone),
    participants: formatParticipants(participants),
    id: meetingId,
  });
  
  // Check for conflicts if date was changed
  const conflictWarning = dateOption ? checkMeetingConflict(meeting.guild_id, date, meetingId, timezone) : null;
  const finalMessage = conflictWarning 
    ? `${editedMessage}\n\n${conflictWarning}`
    : editedMessage;

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: finalMessage,
    },
  });
}

/**
 * Handle set-meeting-channel command
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID where command was executed
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleSetMeetingChannel(data, guildId, channelId, res) {
  try {
    const settings = guildSettingsQueries.get.get(guildId);
    const lang = getGuildLanguage(settings);
    
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('serverOnlyCommand', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    const channelOption = data.options?.find(opt => opt.name === 'channel');
    const targetChannelId = channelOption?.value || channelId;

    // Validate channel access
    const isValid = await validateChannel(targetChannelId);
    if (!isValid) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('invalidChannelError', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    try {
      guildSettingsQueries.setMeetingChannel.run(guildId, targetChannelId);
    } catch (dbError) {
      console.error('Database error in set-meeting-channel:', dbError);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: `Database error: ${dbError.message}` }),
        flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingChannelSet', lang, { channelId: targetChannelId }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  } catch (error) {
    console.error('Error in handleSetMeetingChannel:', error);
    const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
    const lang = getGuildLanguage(settings);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: error.message }),
      },
    });
  }
}

/**
 * Handle set-github-channel command
 */
async function handleSetGithubChannel(data, guildId, channelId, res) {
  try {
    const settings = guildSettingsQueries.get.get(guildId);
    const lang = getGuildLanguage(settings);
    
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('serverOnlyCommand', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    const channelOption = data.options?.find(opt => opt.name === 'channel');
    const targetChannelId = channelOption?.value || channelId;

    // Validate channel access
    const isValid = await validateChannel(targetChannelId);
    if (!isValid) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('invalidChannelError', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    try {
      guildSettingsQueries.setGithubChannel.run(guildId, targetChannelId);
    } catch (dbError) {
      console.error('Database error in set-github-channel:', dbError);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: `Database error: ${dbError.message}` }),
        flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('githubChannelSet', lang, { channelId: targetChannelId }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  } catch (error) {
    console.error('Error in handleSetGithubChannel:', error);
    const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
    const lang = getGuildLanguage(settings);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: error.message }),
      },
    });
  }
}

/**
 * Handle set-language command
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleSetLanguage(data, guildId, res) {
  try {
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('serverOnlyCommand', 'en'),
        },
      });
    }

    const languageOption = data.options?.find(opt => opt.name === 'language');
    const language = languageOption?.value || 'en';

    if (language !== 'en' && language !== 'ko') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', 'en', { message: 'Invalid language. Use "en" or "ko".' }),
        },
      });
    }

    try {
      guildSettingsQueries.setLanguage.run(guildId, language);
    } catch (dbError) {
      console.error('Database error in set-language:', dbError);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', 'en', { message: `Database error: ${dbError.message}` }),
        },
      });
    }

    const settings = guildSettingsQueries.get.get(guildId);
    const lang = getGuildLanguage(settings);

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('languageSet', lang),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  } catch (error) {
    console.error('Error in handleSetLanguage:', error);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', 'en', { message: error.message }),
      },
    });
  }
}

/**
 * Handle set-timezone command
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleSetTimezone(data, guildId, res) {
  try {
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('serverOnlyCommand', 'en'),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    const timezoneOption = data.options?.find(opt => opt.name === 'timezone');
    const timezone = timezoneOption?.value;

    if (!timezone) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', 'en', { message: 'Timezone is required.' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    // Validate timezone (basic validation - could be enhanced)
    const validTimezones = [
      'Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
      'Australia/Sydney', 'Australia/Melbourne', 'UTC'
    ];
    
    if (!validTimezones.includes(timezone)) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', 'en', { message: 'Invalid timezone.' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    try {
      guildSettingsQueries.setTimezone.run(guildId, timezone);
      const settings = guildSettingsQueries.get.get(guildId);
      const lang = getGuildLanguage(settings);
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('timezoneSet', lang, { timezone }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    } catch (dbError) {
      console.error('Database error in handleSetTimezone:', dbError);
      const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
      const lang = getGuildLanguage(settings);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Failed to update timezone in database.' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
  } catch (error) {
    console.error('Error in handleSetTimezone:', error);
    const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
    const lang = getGuildLanguage(settings);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: error.message }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }
}

/**
 * Handle channel-status command
 */
/**
 * Handle channel-status command
 * @param {string} guildId - Guild ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleChannelStatus(guildId, res) {
  const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
  const lang = getGuildLanguage(settings);
  
  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('serverOnlyCommand', lang),
      },
    });
  }

  const meetingChannelId = settings?.meeting_channel_id;
  const githubChannelId = settings?.github_channel_id;
  const githubRepo = settings?.github_repository;

  // Validate channels
  let meetingChannelStatus = meetingChannelId ? `<#${meetingChannelId}>` : t('channelNotSet', lang);
  let githubChannelStatus = githubChannelId ? `<#${githubChannelId}>` : t('channelNotSet', lang);

  if (meetingChannelId) {
    const isValid = await validateChannel(meetingChannelId);
    if (!isValid) {
      meetingChannelStatus = t('channelInvalid', lang);
    }
  }

  if (githubChannelId) {
    const isValid = await validateChannel(githubChannelId);
    if (!isValid) {
      githubChannelStatus = t('channelInvalid', lang);
    }
  }

  const githubRepoStatus = githubRepo || t('channelNotSet', lang);

  const content = `${t('channelStatusTitle', lang)}\n\n${t('channelStatusMeeting', lang, { channel: meetingChannelStatus })}\n${t('channelStatusGithub', lang, { channel: githubChannelStatus })}\n${t('channelStatusRepo', lang, { repo: githubRepoStatus })}`;

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Handle set-meeting-time command (interactive GUI for scheduling meetings)
 * This is the main command for scheduling meetings with support for all repeat types
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID where command was executed
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
/**
 * Handle set-meeting-time command (single meeting only)
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID where command was executed
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleSetMeetingTime(data, guildId, channelId, res) {
  try {
    const settings = guildSettingsQueries.get.get(guildId);
    const lang = getGuildLanguage(settings);
    const timezone = settings?.timezone || 'Asia/Seoul';
    
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('serverOnlyCommand', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    // Extract options
    const options = data.options || [];
    const getOption = (name) => options.find(opt => opt.name === name)?.value;

    const title = getOption('title');
    const dateStr = getOption('date');
    const participantsStr = getOption('participants');
    const reminderMinutesStr = getOption('reminder_minutes') || '15';
    
    // Use channel from settings (already configured)
    const meetingChannelId = settings?.meeting_channel_id || channelId;

    // Validate required fields
    if (!title) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Title is required' }),
        },
      });
    }

    if (!dateStr) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Date is required' }),
        },
      });
    }

    if (!participantsStr) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Participants are required' }),
        },
      });
    }

    // Parse and validate date (supports relative time)
    let meetingDate = parseRelativeDate(dateStr, new Date(), timezone);
    if (!meetingDate) {
      // Fallback to standard date parsing
      meetingDate = new Date(dateStr);
      if (isNaN(meetingDate.getTime())) {
          return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('invalidDate', lang) + (lang === 'ko' ? '\n\n예: 2025-12-25 14:30, 1시간 후, 내일 오후 3시' : '\n\nExamples: 2025-12-25 14:30, 1 hour later, tomorrow 3pm'),
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }

    // Parse participants
    const participants = parseParticipants(participantsStr);
    if (participants.length === 0) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'No valid participants found' }),
        },
      });
    }

    // Parse reminder minutes
    const reminderMinutesArray = reminderMinutesStr
      .split(',')
      .map(m => parseInt(m.trim()))
      .filter(m => !isNaN(m) && m > 0)
      .sort((a, b) => b - a);

    if (reminderMinutesArray.length === 0) {
      reminderMinutesArray.push(15);
    }

    // Single meeting - no repeat
    const repeatType = 'none';
    const repeatInterval = null;
    const dbRepeatType = null;
    const repeatEndDate = null;

    // Check for conflicting meetings BEFORE insertion
    const conflictWarningBefore = checkMeetingConflict(guildId, meetingDate, null, timezone);

    // Validate channel access
    const isValid = await validateChannel(meetingChannelId);
    if (!isValid) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('invalidChannelError', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    // Insert into database - reuse deleted IDs if available
    const nextId = getNextMeetingId();
    const result = meetingQueries.insert.run(
      nextId,
      guildId,
      title,
      meetingDate.toISOString(),
      JSON.stringify(participants),
      meetingChannelId,
      JSON.stringify(reminderMinutesArray),
      dbRepeatType,
      repeatInterval,
      repeatEndDate ? repeatEndDate.toISOString() : null
    );

    const meetingId = nextId;
    
    // Check for conflicts AFTER insertion (excluding the newly created meeting)
    const conflictWarning = checkMeetingConflict(guildId, meetingDate, meetingId, timezone);

    // Schedule reminders
    const reminderTimes = reminderMinutesArray.map(minutes => {
      const reminderTime = new Date(meetingDate.getTime() - minutes * 60 * 1000);
      if (reminderTime > new Date()) {
        scheduleMeetingReminder(meetingId, guildId, title, meetingDate, participants, meetingChannelId, minutes);
        return { minutes, time: reminderTime };
      }
      return null;
    }).filter(Boolean);

    const reminderTimesText = reminderTimes.length > 0
      ? reminderTimes.map(rt => {
          const minutesText = lang === 'ko' ? `${rt.minutes}분 전` : `${rt.minutes} min before`;
          return `${formatDateTime(rt.time, timezone)} (${minutesText})`;
        }).join('\n')
      : t('allRemindersPassed', lang);

    // Single meeting - no repeat text
    const scheduledMessage = t('meetingScheduled', lang, {
      title,
      date: formatDateTime(meetingDate, timezone),
      participants: formatParticipants(participants),
      reminderTimes: reminderTimesText,
      repeatText: '',
      id: meetingId,
    });
    
    const finalMessage = conflictWarning 
      ? `${scheduledMessage}\n\n${conflictWarning}`
      : scheduledMessage;
    
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: finalMessage,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  } catch (error) {
    console.error('Error in handleSetMeetingTime:', error);
    const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
    const lang = getGuildLanguage(settings);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: error.message }),
      },
    });
  }
}

/**
 * Handle message component interactions (buttons, select menus)
 * @param {Object} body - Discord interaction body
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleMessageComponent(body, res) {
  const { data, guild_id: guildId, channel, member } = body;
  const channelId = channel?.id;
  const userId = member?.user?.id;
  
  const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
  const lang = getGuildLanguage(settings);

  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('serverOnlyCommand', lang),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  const componentType = data.component_type;
  const customId = data.custom_id;

  // Handle delete meeting button
  if (componentType === 2 && customId && customId.startsWith('delete_meeting_')) {
    const meetingId = parseInt(customId.replace('delete_meeting_', ''));
    
    if (isNaN(meetingId)) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Invalid meeting ID' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    const meeting = meetingQueries.getById.get(meetingId);
    if (!meeting || meeting.guild_id !== guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('meetingNotFound', lang, { id: meetingId }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    const settings = guildSettingsQueries.get.get(guildId);
    const timezone = settings?.timezone || 'Asia/Seoul';
    
    const meetingTitle = meeting.title;
    const meetingDate = formatDateTime(new Date(meeting.date), timezone);
    
    // Store deleted meeting data for undo (5 minutes)
    const deletedMeetingData = {
      id: meeting.id,
      guild_id: meeting.guild_id,
      title: meeting.title,
      date: meeting.date,
      participants: meeting.participants,
      channel_id: meeting.channel_id,
      reminder_minutes: meeting.reminder_minutes,
      repeat_type: meeting.repeat_type,
      repeat_interval: meeting.repeat_interval,
      repeat_end_date: meeting.repeat_end_date,
      deletedAt: Date.now(),
    };
    deletedMeetings.set(meetingId, deletedMeetingData);
    
    // Auto-remove after timeout
    setTimeout(() => {
      deletedMeetings.delete(meetingId);
    }, UNDO_TIMEOUT);
    
    meetingQueries.delete.run(meetingId);

    // Create undo button
    const undoButton = {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 1, // PRIMARY (blue)
          label: lang === 'ko' ? '되돌리기 (Undo)' : 'Undo',
          custom_id: `undo_delete_${meetingId}`,
          emoji: { name: '↩️' },
        },
      ],
    };

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingDeleted', lang, {
          title: meetingTitle,
          date: meetingDate,
        }),
        components: [undoButton],
        // No EPHEMERAL flag - visible to everyone
      },
    });
  }
  
  // Handle undo delete button
  if (componentType === 2 && customId && customId.startsWith('undo_delete_')) {
    const meetingId = parseInt(customId.replace('undo_delete_', ''));
    
    if (isNaN(meetingId)) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Invalid meeting ID' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
    
    const deletedMeeting = deletedMeetings.get(meetingId);
    if (!deletedMeeting) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' ? '되돌릴 수 없습니다. 삭제된 지 5분이 지났거나 이미 복구되었습니다.' : 'Cannot undo. The meeting was deleted more than 5 minutes ago or has already been restored.',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
    
    // Check if meeting was deleted from same guild
    if (deletedMeeting.guild_id !== guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Cannot undo meeting from different server' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
    
    // Restore meeting - reuse the original ID if available, otherwise get next available
    try {
      const restoreId = deletedMeeting.id && !meetingQueries.getById.get(deletedMeeting.id)
        ? deletedMeeting.id
        : getNextMeetingId();
      meetingQueries.insert.run(
        restoreId,
        deletedMeeting.guild_id,
        deletedMeeting.title,
        deletedMeeting.date,
        deletedMeeting.participants,
        deletedMeeting.channel_id,
        deletedMeeting.reminder_minutes,
        deletedMeeting.repeat_type,
        deletedMeeting.repeat_interval,
        deletedMeeting.repeat_end_date
      );
      
      // Remove from deleted meetings cache
      deletedMeetings.delete(meetingId);
      
      const settings = guildSettingsQueries.get.get(guildId);
      const timezone = settings?.timezone || 'Asia/Seoul';
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' 
            ? `✅ 회의가 복구되었습니다: **${deletedMeeting.title}** (${formatDateTime(new Date(deletedMeeting.date), timezone)})`
            : `✅ Meeting restored: **${deletedMeeting.title}** (${formatDateTime(new Date(deletedMeeting.date), timezone)})`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    } catch (error) {
      console.error('Error restoring meeting:', error);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Failed to restore meeting' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
  }

  // Unknown component interaction
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('errorOccurred', lang, { message: 'Unknown component interaction' }),
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Handle modal submit interactions
 * @param {Object} body - Discord interaction body
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleModalSubmit(body, res) {
  // No modal submissions for meeting scheduling - all handled via command arguments
  const { guild_id: guildId } = body;
  const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
  const lang = getGuildLanguage(settings);
  
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('errorOccurred', lang, { message: 'Unknown modal submission' }),
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Handle set-recurring-meeting command
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID where command was executed
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleSetRecurringMeeting(data, guildId, channelId, res) {
  try {
    const settings = guildSettingsQueries.get.get(guildId);
    const lang = getGuildLanguage(settings);
    const timezone = settings?.timezone || 'Asia/Seoul';
    
    if (!guildId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('serverOnlyCommand', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    // Extract options
    const options = data.options || [];
    const getOption = (name) => options.find(opt => opt.name === name)?.value;

    const title = getOption('title');
    const timeStr = getOption('time');
    const participantsStr = getOption('participants');
    const repeatType = getOption('repeat_type');
    const weekday = getOption('weekday');
    const dayOfMonth = getOption('day_of_month');
    const weekOfMonth = getOption('week_of_month');
    const excludeWeekdaysStr = getOption('exclude_weekdays');
    const reminderMinutesStr = getOption('reminder_minutes') || '15';
    const repeatEndStr = getOption('repeat_end_date');
    
    // Use channel from settings (already configured)
    const meetingChannelId = settings?.meeting_channel_id || channelId;

    // Validate required fields
    if (!title) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Title is required' }),
        },
      });
    }

    if (!timeStr) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Time is required' }),
        },
      });
    }

    if (!participantsStr) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Participants are required' }),
        },
      });
    }

    if (!repeatType) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Repeat type is required' }),
        },
      });
    }

    // Parse time
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Invalid time format. Use HH:mm (e.g., 14:30)' }),
        },
      });
    }

    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Invalid time. Hours must be 0-23, minutes must be 0-59' }),
        },
      });
    }

    // Validate repeat type options
    if (repeatType === 'weekly' || repeatType === 'biweekly' || repeatType === 'monthly_weekday') {
      if (weekday === null || weekday === undefined) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('errorOccurred', lang, { message: 'Weekday is required for this repeat type' }),
          },
        });
      }
    }

    if (repeatType === 'monthly_day') {
      if (dayOfMonth === null || dayOfMonth === undefined) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('errorOccurred', lang, { message: 'Day of month is required for monthly_day repeat type' }),
          },
        });
      }
    }

    if (repeatType === 'monthly_weekday') {
      if (weekOfMonth === null || weekOfMonth === undefined) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('errorOccurred', lang, { message: 'Week of month is required for monthly_weekday repeat type' }),
          },
        });
      }
    }

    // Parse participants
    const participants = parseParticipants(participantsStr);
    if (participants.length === 0) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'No valid participants found' }),
        },
      });
    }

    // Parse reminder minutes
    const reminderMinutesArray = reminderMinutesStr
      .split(',')
      .map(m => parseInt(m.trim()))
      .filter(m => !isNaN(m) && m > 0)
      .sort((a, b) => b - a);

    if (reminderMinutesArray.length === 0) {
      reminderMinutesArray.push(15);
    }

    // Parse repeat end date
    let repeatEndDate = null;
    if (repeatEndStr) {
      repeatEndDate = new Date(repeatEndStr);
      if (isNaN(repeatEndDate.getTime())) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('invalidDate', lang),
          },
        });
      }
    }

    // Parse excluded weekdays for daily meetings
    let excludedWeekdays = [];
    if (repeatType === 'daily' && excludeWeekdaysStr) {
      excludedWeekdays = excludeWeekdaysStr
        .split(',')
        .map(w => parseInt(w.trim()))
        .filter(w => !isNaN(w) && w >= 0 && w <= 6);
    }

    // Calculate first meeting date based on repeat type
    // IMPORTANT: hours and minutes are in the specified timezone, not server local time
    const now = new Date();
    let meetingDate;

    // Helper function to create a date with time in specified timezone
    // Converts local time (hours, minutes) in timezone to UTC Date
    const createDateWithTimeInTimezone = (baseDate, targetHours, targetMinutes) => {
      // Get the date components in the target timezone from baseDate
      const tzFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const tzParts = tzFormatter.formatToParts(baseDate);
      const tzYear = parseInt(tzParts.find(p => p.type === 'year')?.value);
      const tzMonth = parseInt(tzParts.find(p => p.type === 'month')?.value) - 1;
      const tzDay = parseInt(tzParts.find(p => p.type === 'day')?.value);
      
      // Create a date string representing the target time in the timezone
      // Format: "YYYY-MM-DD HH:mm"
      const dateStr = `${tzYear}-${String(tzMonth + 1).padStart(2, '0')}-${String(tzDay).padStart(2, '0')} ${String(targetHours).padStart(2, '0')}:${String(targetMinutes).padStart(2, '0')}`;
      
      // Use parseRelativeDate to convert it properly from timezone to UTC
      const result = parseRelativeDate(dateStr, baseDate, timezone);
      if (!result) {
        // Fallback: if parseRelativeDate fails, calculate manually
        const referenceDate = new Date(Date.UTC(tzYear, tzMonth, tzDay, 12, 0, 0));
        const offsetMs = getTimezoneOffset(timezone, referenceDate);
        const inputAsUTC = new Date(Date.UTC(tzYear, tzMonth, tzDay, targetHours, targetMinutes, 0));
        return new Date(inputAsUTC.getTime() - offsetMs);
      }
      return result;
    };

    if (repeatType === 'daily') {
      // Next occurrence at the specified time in the timezone
      meetingDate = createDateWithTimeInTimezone(now, hours, minutes);
      if (meetingDate <= now) {
        // Add one day and recalculate
        const nextDay = new Date(meetingDate.getTime() + 24 * 60 * 60 * 1000);
        meetingDate = createDateWithTimeInTimezone(nextDay, hours, minutes);
      }
      
      // Skip excluded weekdays (check weekday in the timezone)
      let attempts = 0;
      while (attempts < 7) {
        // Get weekday in the timezone using 'short' format and parse it
        const tzFormatter = new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          weekday: 'short'
        });
        const weekdayText = tzFormatter.formatToParts(meetingDate).find(p => p.type === 'weekday')?.value?.toLowerCase();
        // Map weekday text to number (0=Sunday, 6=Saturday)
        const weekdayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
        const weekdayNum = weekdayMap[weekdayText?.substring(0, 3)] ?? meetingDate.getUTCDay();
        
        if (!excludedWeekdays.includes(weekdayNum)) break;
        
        const nextDay = new Date(meetingDate.getTime() + 24 * 60 * 60 * 1000);
        meetingDate = createDateWithTimeInTimezone(nextDay, hours, minutes);
        attempts++;
      }
    } else if (repeatType === 'weekly' || repeatType === 'biweekly') {
      // Find next occurrence of the weekday (use getNextWeekday but convert time properly)
      const targetWeekday = parseInt(weekday);
      let testDate = new Date(now);
      
      // Find next occurrence by iterating days and checking weekday in timezone
      for (let i = 0; i < 14; i++) {
        const candidateDate = createDateWithTimeInTimezone(testDate, hours, minutes);
        
        // Get weekday in timezone using 'short' format and parse it
        const tzFormatter = new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          weekday: 'short'
        });
        const weekdayText = tzFormatter.formatToParts(candidateDate).find(p => p.type === 'weekday')?.value?.toLowerCase();
        const weekdayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
        const weekdayNum = weekdayMap[weekdayText?.substring(0, 3)] ?? candidateDate.getUTCDay();
        
        if (weekdayNum === targetWeekday && candidateDate > now) {
          meetingDate = candidateDate;
          break;
        }
        
        testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
      }
      
      if (!meetingDate) {
        // Fallback
        meetingDate = createDateWithTimeInTimezone(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), hours, minutes);
      }
      
      if (repeatType === 'biweekly') {
        // For biweekly, add 7 more days
        const biweeklyDate = new Date(meetingDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        meetingDate = createDateWithTimeInTimezone(biweeklyDate, hours, minutes);
      }
    } else if (repeatType === 'monthly_day') {
      // For monthly, use a simpler approach: get next occurrence of the day
      let testDate = new Date(now);
      const targetDay = parseInt(dayOfMonth);
      
      for (let i = 0; i < 60; i++) {
        const candidateDate = createDateWithTimeInTimezone(testDate, hours, minutes);
        
        // Get day of month in timezone
        const tzFormatter = new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          day: 'numeric'
        });
        const tzDay = parseInt(tzFormatter.formatToParts(candidateDate).find(p => p.type === 'day')?.value);
        
        if (tzDay === targetDay && candidateDate > now) {
          meetingDate = candidateDate;
          break;
        }
        
        testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
      }
      
      if (!meetingDate) {
        meetingDate = createDateWithTimeInTimezone(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), hours, minutes);
      }
    } else if (repeatType === 'monthly_weekday') {
      // For monthly weekday, use iterative approach
      let testDate = new Date(now);
      const targetWeekday = parseInt(weekday);
      const targetWeekOfMonth = weekOfMonth;
      
      for (let i = 0; i < 60; i++) {
        const candidateDate = createDateWithTimeInTimezone(testDate, hours, minutes);
        
        // Check if this matches the criteria (simplified - would need more complex logic for exact week of month)
        const tzFormatter = new Intl.DateTimeFormat('en', {
          timeZone: timezone,
          weekday: 'short'
        });
        const weekdayText = tzFormatter.formatToParts(candidateDate).find(p => p.type === 'weekday')?.value?.toLowerCase();
        const weekdayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
        const weekdayNum = weekdayMap[weekdayText?.substring(0, 3)] ?? candidateDate.getUTCDay();
        
        if (weekdayNum === targetWeekday && candidateDate > now) {
          meetingDate = candidateDate;
          break;
        }
        
        testDate = new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
      }
      
      if (!meetingDate) {
        meetingDate = createDateWithTimeInTimezone(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), hours, minutes);
      }
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: 'Invalid repeat type' }),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    // Calculate repeat interval and format repeat_type for database
    let repeatInterval = null;
    let dbRepeatType = repeatType;
    
    if (repeatType === 'daily') {
      repeatInterval = 1;
      if (excludedWeekdays.length > 0) {
        // Format: daily_except:0,6 (excluded weekdays sorted)
        const excludedStr = excludedWeekdays.sort((a, b) => a - b).join(',');
        dbRepeatType = `daily_except:${excludedStr}`;
      }
    } else if (repeatType === 'weekly') {
      repeatInterval = 7;
      dbRepeatType = `weekly:${weekday}`;
    } else if (repeatType === 'biweekly') {
      repeatInterval = 14;
      dbRepeatType = `biweekly:${weekday}`;
    } else if (repeatType === 'monthly_day') {
      repeatInterval = 30; // Approximate
      dbRepeatType = `monthly_day:${dayOfMonth}`;
    } else if (repeatType === 'monthly_weekday') {
      repeatInterval = 30; // Approximate
      dbRepeatType = `monthly_weekday:${weekOfMonth}:${weekday}`;
    }

    // Validate channel access
    const isValid = await validateChannel(meetingChannelId);
    if (!isValid) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('invalidChannelError', lang),
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    // Insert into database - reuse deleted IDs if available
    const nextId = getNextMeetingId();
    const result = meetingQueries.insert.run(
      nextId,
      guildId,
      title,
      meetingDate.toISOString(),
      JSON.stringify(participants),
      meetingChannelId,
      JSON.stringify(reminderMinutesArray),
      dbRepeatType,
      repeatInterval,
      repeatEndDate ? repeatEndDate.toISOString() : null
    );

    const meetingId = nextId;

    // Schedule reminders
    const reminderTimes = reminderMinutesArray.map(minutes => {
      const reminderTime = new Date(meetingDate.getTime() - minutes * 60 * 1000);
      if (reminderTime > new Date()) {
        scheduleMeetingReminder(meetingId, guildId, title, meetingDate, participants, meetingChannelId, minutes);
        return { minutes, time: reminderTime };
      }
      return null;
    }).filter(Boolean);

    const reminderTimesText = reminderTimes.length > 0
      ? reminderTimes.map(rt => {
          const minutesText = lang === 'ko' ? `${rt.minutes}분 전` : `${rt.minutes} min before`;
          return `${formatDateTime(rt.time, timezone)} (${minutesText})`;
        }).join('\n')
      : t('allRemindersPassed', lang);

    // Format detailed repeat information using dbRepeatType (has detailed format)
    const repeatText = formatRepeatInfo(dbRepeatType, lang, repeatEndDate ? repeatEndDate.toISOString() : null, timezone);

    // Check for conflicts with first occurrence (excluding the newly created meeting)
    const conflictWarning = checkMeetingConflict(guildId, meetingDate, meetingId, timezone);
    
    const scheduledMessage = t('meetingScheduled', lang, {
      title,
      date: formatDateTime(meetingDate, timezone),
      participants: formatParticipants(participants),
      reminderTimes: reminderTimesText,
      repeatText,
      id: meetingId,
    });
    
    const finalMessage = conflictWarning 
      ? `${scheduledMessage}\n\n${conflictWarning}`
      : scheduledMessage;

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: finalMessage,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  } catch (error) {
    console.error('Error in handleSetRecurringMeeting:', error);
    const settings = guildId ? guildSettingsQueries.get.get(guildId) : null;
    const lang = getGuildLanguage(settings);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: error.message }),
      },
    });
  }
}

// Helper functions for date calculations (kept for potential future use)
/**
 * Get next occurrence of a weekday from a given date
 * @param {Date} fromDate - Starting date
 * @param {number} weekday - Weekday (0=Sunday, 6=Saturday)
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {Date} Next occurrence date
 */
function getNextWeekday(fromDate, weekday, hours, minutes) {
  const date = new Date(fromDate);
  date.setHours(hours, minutes, 0, 0);
  
  const currentWeekday = date.getDay();
  let daysUntilTarget = (weekday - currentWeekday + 7) % 7;
  
  // If today is the target weekday but time has passed, move to next week
  if (daysUntilTarget === 0 && date <= fromDate) {
    daysUntilTarget = 7;
  }
  
  date.setDate(date.getDate() + daysUntilTarget);
  return date;
}

/**
 * Get next occurrence of a day of month from a given date
 * @param {Date} fromDate - Starting date
 * @param {number} dayOfMonth - Day of month (1-31)
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {Date} Next occurrence date
 */
function getNextDayOfMonth(fromDate, dayOfMonth, hours, minutes) {
  const date = new Date(fromDate);
  date.setDate(dayOfMonth);
  date.setHours(hours, minutes, 0, 0);
  
  if (date <= fromDate) {
    // Move to next month
    date.setMonth(date.getMonth() + 1);
    date.setDate(dayOfMonth);
  }
  
  return date;
}

/**
 * Get the date of nth weekday of a month
 * @param {number} year - Year
 * @param {number} month - Month (0-based)
 * @param {number} weekOfMonth - Week of month (1-4, or -1 for last week)
 * @param {number} weekday - Weekday (0=Sunday, 6=Saturday)
 * @returns {Date} Date object
 */
function getNthWeekday(year, month, weekOfMonth, weekday) {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let date = 1 + ((weekday - firstWeekday + 7) % 7);
  
  if (weekOfMonth === -1) {
    // Last week - find last occurrence
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    date = lastDay.getDate() - ((lastWeekday - weekday + 7) % 7);
  } else {
    date += (weekOfMonth - 1) * 7;
    const maxDay = new Date(year, month + 1, 0).getDate();
    if (date > maxDay) {
      // Fallback to last occurrence
      const lastDay = new Date(year, month + 1, 0);
      date = lastDay.getDate() - ((lastDay.getDay() - weekday + 7) % 7);
    }
  }
  
  return new Date(year, month, date);
}

/**
 * Get next occurrence of nth weekday of month from a given date
 * @param {Date} fromDate - Starting date
 * @param {number} weekOfMonth - Week of month (1-4, or -1 for last week)
 * @param {number} weekday - Weekday (0=Sunday, 6=Saturday)
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {Date} Next occurrence date
 */
function getNextNthWeekday(fromDate, weekOfMonth, weekday, hours, minutes) {
  let date = getNthWeekday(fromDate.getFullYear(), fromDate.getMonth(), weekOfMonth, weekday);
  date.setHours(hours, minutes, 0, 0);
  
  if (date <= fromDate) {
    // Move to next month
    const nextMonth = fromDate.getMonth() + 1;
    date = getNthWeekday(fromDate.getFullYear(), nextMonth, weekOfMonth, weekday);
    date.setHours(hours, minutes, 0, 0);
  }
  
  return date;
}

/**
 * Handle setup-github command
 * @param {Object} data - Command data from Discord
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID where command was executed
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function handleSetupGitHub(data, guildId, channelId, res) {
  const settings = guildSettingsQueries.get.get(guildId);
  const lang = getGuildLanguage(settings);
  
  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('serverOnlyCommand', lang),
      },
    });
  }

  const channelOption = data.options?.find(opt => opt.name === 'channel');
  const repositoryOption = data.options?.find(opt => opt.name === 'repository');
  const targetChannelId = channelOption?.value || channelId;
  const repositoryUrl = repositoryOption?.value;

  // Repository is required
  if (!repositoryUrl) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: 'Repository URL is required.' }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  // Parse and update repository
  let repositoryInfo = null;
  try {
    // Support formats: https://github.com/user/repo.git, https://github.com/user/repo, user/repo.git, user/repo
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w\-\.]+)\/([\w\-\.]+?)(?:\.git)?\/?$/i;
    const match = repositoryUrl.trim().match(urlPattern);
    
    if (match) {
      repositoryInfo = {
        owner: match[1],
        repo: match[2],
        full_name: `${match[1]}/${match[2]}`,
        url: `https://github.com/${match[1]}/${match[2]}`,
      };
      guildSettingsQueries.setGithubRepository.run(guildId, repositoryInfo.full_name);
    } else {
      // Try format: user/repo.git or user/repo
      const simplePattern = /^([\w\-\.]+)\/([\w\-\.]+?)(?:\.git)?$/i;
      const simpleMatch = repositoryUrl.trim().match(simplePattern);
      
      if (simpleMatch) {
        repositoryInfo = {
          owner: simpleMatch[1],
          repo: simpleMatch[2],
          full_name: `${simpleMatch[1]}/${simpleMatch[2]}`,
          url: `https://github.com/${simpleMatch[1]}/${simpleMatch[2]}`,
        };
        guildSettingsQueries.setGithubRepository.run(guildId, repositoryInfo.full_name);
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: t('invalidGithubUrl', lang),
        flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }
  } catch (error) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: 'Failed to parse GitHub repository URL.' }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  // Update channel (default to current channel if not provided)
  if (targetChannelId) {
    guildSettingsQueries.setGithubChannel.run(guildId, targetChannelId);
  }

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'https://rundeerundeebot-production.up.railway.app'}/webhook/github`;
  
  const repoInfo = t('githubRepoRegistered', lang, {
    repo: repositoryInfo.full_name,
    url: repositoryInfo.url,
  });
  
  const steps = t('githubSteps', lang, {
    url: repositoryInfo.url,
    webhookUrl,
  });

  const responseMessage = t('githubSetup', lang, {
    channelId: targetChannelId,
    repoInfo,
    webhookUrl,
    steps,
  });

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: responseMessage,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Parse participants from string (mentions or user IDs)
 * Supports user mentions (<@user_id> or <@!user_id>) and role mentions (<@&role_id>)
 * @param {string} participantsStr - String containing @mentions or comma-separated user IDs
 * @returns {Array<string>} Array of participant identifiers (format: "u:user_id" for users, "r:role_id" for roles, or just "user_id" for backward compatibility)
 */
function parseParticipants(participantsStr) {
  const participants = [];
  const seen = new Set();
  
  // Parse user mentions: <@user_id> or <@!user_id>
  const userMentionRegex = /<@!?(\d+)>/g;
  let match;
  while ((match = userMentionRegex.exec(participantsStr)) !== null) {
    const id = `u:${match[1]}`;
    if (!seen.has(id)) {
      participants.push(id);
      seen.add(id);
    }
  }
  
  // Parse role mentions: <@&role_id>
  const roleMentionRegex = /<@&(\d+)>/g;
  while ((match = roleMentionRegex.exec(participantsStr)) !== null) {
    const id = `r:${match[1]}`;
    if (!seen.has(id)) {
      participants.push(id);
      seen.add(id);
    }
  }

  // Parse comma-separated IDs (for backward compatibility, treat as user IDs)
  const parts = participantsStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    // Only add if it's a plain number and not already in a mention
    if (/^\d+$/.test(trimmed)) {
      const id = `u:${trimmed}`;
      if (!seen.has(id)) {
        participants.push(id);
        seen.add(id);
      }
    }
  }

  return participants;
}

/**
 * Format participants array for display in messages
 * Converts participant identifiers to Discord mention format
 * @param {Array<string>} participants - Array of participant identifiers
 * @returns {string} Formatted mention string
 */
function formatParticipants(participants) {
  return participants.map(p => {
    // Handle new format: "u:user_id" or "r:role_id"
    if (p.startsWith('u:')) {
      return `<@${p.substring(2)}>`;
    } else if (p.startsWith('r:')) {
      return `<@&${p.substring(2)}>`;
    }
    // Backward compatibility: plain number is treated as user ID
    return `<@${p}>`;
  }).join(', ');
}

/**
 * Format participants array for mention in reminder messages (space-separated)
 * @param {Array<string>} participants - Array of participant identifiers
 * @returns {string} Formatted mention string with spaces
 */
function formatParticipantsMentions(participants) {
  return participants.map(p => {
    // Handle new format: "u:user_id" or "r:role_id"
    if (p.startsWith('u:')) {
      return `<@${p.substring(2)}>`;
    } else if (p.startsWith('r:')) {
      return `<@&${p.substring(2)}>`;
    }
    // Backward compatibility: plain number is treated as user ID
    return `<@${p}>`;
  }).join(' ');
}

/**
 * Check for conflicting meetings at the same time
 * @param {string} guildId - Guild ID
 * @param {Date} meetingDate - Date of the meeting to check
 * @param {number|null} excludeMeetingId - Meeting ID to exclude from check (for edits)
 * @returns {string|null} Warning message if conflict found, null otherwise
 */
function checkMeetingConflict(guildId, meetingDate, excludeMeetingId = null, timezone = 'Asia/Seoul') {
  const now = new Date();
  const meetings = guildId
    ? meetingQueries.getUpcomingByGuild.all(guildId)
    : meetingQueries.getUpcoming.all();
  
  // Check for meetings within 30 minutes of the new meeting time
  const conflictWindow = 30 * 60 * 1000; // 30 minutes in milliseconds
  const conflicts = meetings.filter(m => {
    if (excludeMeetingId && m.id === excludeMeetingId) return false;
    const existingDate = new Date(m.date);
    const timeDiff = Math.abs(existingDate.getTime() - meetingDate.getTime());
    return timeDiff < conflictWindow;
  });
  
  if (conflicts.length > 0) {
    const conflictList = conflicts.map(m => `- ${m.title} (${formatDateTime(new Date(m.date), timezone)})`).join('\n');
    return `⚠️ Warning: There are ${conflicts.length} meeting(s) scheduled at a similar time:\n${conflictList}`;
  }
  
  return null;
}

/**
 * Get repeat interval in days for a repeat type
 * @param {string} repeatType - Repeat type (daily, weekly, biweekly, monthly)
 * @returns {number|null} Interval in days or null
 */
function getRepeatInterval(repeatType) {
  const intervals = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };
  return intervals[repeatType] || null;
}

/**
 * Schedule a meeting reminder using cron
 * @param {number} meetingId - Meeting ID
 * @param {string} guildId - Guild ID
 * @param {string} title - Meeting title
 * @param {Date} date - Meeting date
 * @param {Array<string>} participants - Array of user IDs
 * @param {string} channelId - Channel ID to send reminder
 * @param {number} reminderMinutes - Minutes before meeting to send reminder
 */
function scheduleMeetingReminder(meetingId, guildId, title, date, participants, channelId, reminderMinutes) {
  const reminderTime = new Date(date.getTime() - reminderMinutes * 60 * 1000);
  
  if (reminderTime <= new Date()) return;

  // Get timezone from guild settings
  const settings = guildSettingsQueries.get.get(guildId);
  const timezone = settings?.timezone || 'Asia/Seoul';

  // Get time components in the specified timezone (not server local time)
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(reminderTime);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

    const cronExpression = `${minute} ${hour} ${day} ${month} *`;

    cron.schedule(cronExpression, async () => {
      try {
        const meeting = meetingQueries.getById.get(meetingId);
        if (!meeting) return;

        const reminded = JSON.parse(meeting.reminded || '[]');
        if (reminded.includes(reminderMinutes)) return;

        const reminderSettings = guildSettingsQueries.get.get(guildId);
        const lang = getGuildLanguage(reminderSettings);
        const reminderTimezone = reminderSettings?.timezone || 'Asia/Seoul';
        const mentions = formatParticipantsMentions(participants);
        const message = t('meetingReminder', lang, {
          mentions,
          title,
          date: formatDateTime(date, reminderTimezone),
          minutes: reminderMinutes,
        });

        await sendMessage(channelId, message);
        
        reminded.push(reminderMinutes);
        meetingQueries.updateReminded.run(JSON.stringify(reminded), meetingId);
      } catch (error) {
        console.error('Error sending meeting reminder:', error);
      }
    }, {
      scheduled: true,
      timezone: timezone,
    });
  } catch (error) {
    console.error(`Error scheduling reminder for meeting ${meetingId} in timezone ${timezone}:`, error);
    // Fallback to UTC-based scheduling if timezone conversion fails
    const minute = reminderTime.getUTCMinutes();
    const hour = reminderTime.getUTCHours();
    const day = reminderTime.getUTCDate();
    const month = reminderTime.getUTCMonth() + 1;
    const cronExpression = `${minute} ${hour} ${day} ${month} *`;

    cron.schedule(cronExpression, async () => {
      try {
        const meeting = meetingQueries.getById.get(meetingId);
        if (!meeting) return;

        const reminded = JSON.parse(meeting.reminded || '[]');
        if (reminded.includes(reminderMinutes)) return;

        const reminderSettings = guildSettingsQueries.get.get(guildId);
        const lang = getGuildLanguage(reminderSettings);
        const reminderTimezone = reminderSettings?.timezone || 'Asia/Seoul';
        const mentions = formatParticipantsMentions(participants);
        const message = t('meetingReminder', lang, {
          mentions,
          title,
          date: formatDateTime(date, reminderTimezone),
          minutes: reminderMinutes,
        });

        await sendMessage(channelId, message);
        
        reminded.push(reminderMinutes);
        meetingQueries.updateReminded.run(JSON.stringify(reminded), meetingId);
      } catch (error) {
        console.error('Error sending meeting reminder:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });
  }
}

/**
 * Handle recurring meeting - create next occurrence after current meeting date
 * @param {Object} meetingRow - Database row for the meeting
 */
async function handleRecurringMeeting(meetingRow) {
  const dbMeeting = dbToMeeting(meetingRow);
  const currentDate = new Date(dbMeeting.date);
  const repeatEndDate = dbMeeting.repeatEndDate ? new Date(dbMeeting.repeatEndDate) : null;

  // Check if we've reached the end date
  if (repeatEndDate && currentDate >= repeatEndDate) {
    return; // Stop recurring
  }

  // Parse repeat type
  const repeatTypeStr = dbMeeting.repeatType || '';
  let repeatType = repeatTypeStr;
  let weekday = null;
  let dayOfMonth = null;
  let weekOfMonth = null;
  let excludedWeekdays = [];

  if (repeatTypeStr.includes(':')) {
    const parts = repeatTypeStr.split(':');
    repeatType = parts[0];
    
    if (repeatType === 'weekly' || repeatType === 'biweekly') {
      weekday = parseInt(parts[1]);
    } else if (repeatType === 'monthly_day') {
      dayOfMonth = parseInt(parts[1]);
    } else if (repeatType === 'monthly_weekday') {
      weekOfMonth = parseInt(parts[1]);
      weekday = parseInt(parts[2]);
    } else if (repeatType === 'daily_except') {
      excludedWeekdays = parts[1].split(',').map(w => parseInt(w));
    }
  }

  // Calculate next date
  let nextDate;
  const [hours, minutes] = [currentDate.getHours(), currentDate.getMinutes()];
  
  if (repeatType === 'daily' || repeatType === 'daily_except') {
    // For daily with exclusions, skip excluded weekdays
    nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(hours, minutes, 0, 0);
    
    // Skip excluded weekdays (max 7 iterations to avoid infinite loop)
    let attempts = 0;
    while (excludedWeekdays.includes(nextDate.getDay()) && attempts < 7) {
      nextDate.setDate(nextDate.getDate() + 1);
      attempts++;
    }
  } else if (repeatType === 'weekly' && weekday !== null) {
    nextDate = getNextWeekday(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000), weekday, hours, minutes);
  } else if (repeatType === 'biweekly' && weekday !== null) {
    // Find next occurrence 2 weeks from current
    const twoWeeksLater = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    nextDate = getNextWeekday(twoWeeksLater, weekday, hours, minutes);
  } else if (repeatType === 'monthly_day' && dayOfMonth !== null) {
    nextDate = getNextDayOfMonth(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000), dayOfMonth, hours, minutes);
  } else if (repeatType === 'monthly_weekday' && weekOfMonth !== null && weekday !== null) {
    nextDate = getNextNthWeekday(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000), weekOfMonth, weekday, hours, minutes);
  } else {
    // Fallback for old format or unknown type
    nextDate = new Date(currentDate);
    if (repeatType === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (repeatType === 'biweekly') {
      nextDate.setDate(nextDate.getDate() + 14);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  }

  // Check if next date exceeds end date
  if (repeatEndDate && nextDate > repeatEndDate) {
    return;
  }

  // For daily_except, verify the next date is not excluded (extra safety check)
  if (repeatType === 'daily_except' && excludedWeekdays.includes(nextDate.getDay())) {
    // Skip to next valid day
    let attempts = 0;
    while (excludedWeekdays.includes(nextDate.getDay()) && attempts < 7) {
      nextDate.setDate(nextDate.getDate() + 1);
      attempts++;
    }
    
    // Check again if we exceeded end date
    if (repeatEndDate && nextDate > repeatEndDate) {
      return;
    }
  }

  // Create next meeting - reuse deleted IDs if available
  const reminderMinutes = JSON.parse(dbMeeting.reminderMinutes);
  const nextId = getNextMeetingId();
  const result = meetingQueries.insert.run(
    nextId,
    dbMeeting.guildId,
    dbMeeting.title,
    nextDate.toISOString(),
    dbMeeting.participants,
    dbMeeting.channelId,
    dbMeeting.reminderMinutes,
    dbMeeting.repeatType,
    dbMeeting.repeatInterval,
    dbMeeting.repeatEndDate
  );

  const nextMeetingId = nextId;
  const participants = JSON.parse(dbMeeting.participants);

  // Schedule reminders for next meeting
  reminderMinutes.forEach(minutes => {
    scheduleMeetingReminder(nextMeetingId, dbMeeting.guildId, dbMeeting.title, nextDate, participants, dbMeeting.channelId, minutes);
  });
}

/**
 * Convert database row to meeting object
 * @param {Object} row - Database row
 * @returns {Object} Meeting object
 */
function dbToMeeting(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    title: row.title,
    date: row.date,
    participants: row.participants,
    channelId: row.channel_id,
    reminderMinutes: row.reminder_minutes,
    repeatType: row.repeat_type,
    repeatInterval: row.repeat_interval,
    repeatEndDate: row.repeat_end_date,
    reminded: row.reminded,
  };
}

/**
 * Validate if bot can access a Discord channel
 * @param {string} channelId - Channel ID
 * @returns {Promise<boolean>} True if channel is accessible
 */
async function validateChannel(channelId) {
  try {
    const response = await DiscordRequest(`channels/${channelId}`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error(`Channel validation failed for ${channelId}:`, error);
    return false;
  }
}

/**
 * Send a message to a Discord channel
 * @param {string} channelId - Channel ID
 * @param {string} content - Message content
 * @returns {Promise<Response>} Discord API response
 * @throws {Error} Throws CHANNEL_INVALID error if channel is inaccessible
 */
async function sendMessage(channelId, content) {
  try {
    return await DiscordRequest(`channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        content,
      },
    });
  } catch (error) {
    console.error(`Failed to send message to channel ${channelId}:`, error);
    // Check if it's a channel access error
    if (error.message && (error.message.includes('50035') || error.message.includes('Missing Access') || error.message.includes('Unknown Channel'))) {
      throw new Error('CHANNEL_INVALID');
    }
    throw error;
  }
}

/**
 * Handle GitHub push event and send notifications to configured guilds
 * @param {Object} payload - GitHub webhook payload
 * @param {Array} guilds - Array of guild settings that should receive notifications
 */
async function handleGitHubPush(payload, guilds) {
  const repository = payload.repository;
  const pusher = payload.pusher;
  const commits = payload.commits || [];
  const ref = payload.ref;
  const branch = ref.replace('refs/heads/', '');

  for (const guild of guilds) {
    if (!guild.github_channel_id) continue;

    try {
      const settings = guildSettingsQueries.get.get(guild.guild_id);
      const lang = getGuildLanguage(settings);
      
      // Format commit messages in code block (show all commits, but limit individual message length)
      const commitMessagesText = commits.map(c => {
        const msg = c.message.split('\n')[0];
        const truncatedMsg = msg.length > 100 ? msg.substring(0, 97) + '...' : msg;
        return `${c.id.substring(0, 7)} ${truncatedMsg} (${c.author.name})`;
      }).join('\n');
      
      const commitMessages = commitMessagesText 
        ? `\`\`\`\n${commitMessagesText}\n\`\`\`` 
        : lang === 'ko' ? '(커밋 없음)' : '(No commits)';
      
      const message = t('githubPush', lang, {
        repo: repository.full_name,
        branch: branch,
        author: pusher.name,
        commitsCount: commits.length,
        commitMessages: commitMessages,
        compareUrl: payload.compare,
      });

      await sendMessage(guild.github_channel_id, message);
    } catch (error) {
      console.error(`Error sending GitHub push notification to guild ${guild.guild_id}:`, error);
    }
  }
}

/**
 * Handle GitHub pull request event and send notifications to configured guilds
 * @param {Object} payload - GitHub webhook payload
 * @param {Array} guilds - Array of guild settings that should receive notifications
 */
async function handleGitHubPullRequest(payload, guilds) {
  const repository = payload.repository;
  const pullRequest = payload.pull_request;
  const action = payload.action;

  for (const guild of guilds) {
    if (!guild.github_channel_id) continue;

    try {
      const settings = guildSettingsQueries.get.get(guild.guild_id);
      const lang = getGuildLanguage(settings);
      
      let message = '';
      if (action === 'opened') {
        message = t('githubPROpened', lang, {
          repo: repository.full_name,
          prTitle: pullRequest.title,
          author: pullRequest.user.login,
          baseRef: pullRequest.base.ref,
          headRef: pullRequest.head.ref,
          prUrl: pullRequest.html_url,
        });
      } else if (action === 'closed' && pullRequest.merged) {
        const merger = pullRequest.merged_by;
        message = t('githubPRMerged', lang, {
          repo: repository.full_name,
          prTitle: pullRequest.title,
          author: pullRequest.user.login,
          merger: merger.login,
          baseRef: pullRequest.base.ref,
          headRef: pullRequest.head.ref,
          prUrl: pullRequest.html_url,
        });
      } else if (action === 'closed') {
        message = t('githubPRClosed', lang, {
          repo: repository.full_name,
          prTitle: pullRequest.title,
          author: pullRequest.user.login,
          prUrl: pullRequest.html_url,
        });
      }

      if (message) {
        await sendMessage(guild.github_channel_id, message);
      }
    } catch (error) {
      console.error(`Error sending GitHub PR notification to guild ${guild.guild_id}:`, error);
    }
  }
}

/**
 * Handle GitHub issue event and send notifications to configured guilds
 * @param {Object} payload - GitHub webhook payload
 * @param {Array} guilds - Array of guild settings that should receive notifications
 */
async function handleGitHubIssue(payload, guilds) {
  const repository = payload.repository;
  const issue = payload.issue;
  const action = payload.action;

  for (const guild of guilds) {
    if (!guild.github_channel_id) continue;

    try {
      const settings = guildSettingsQueries.get.get(guild.guild_id);
      const lang = getGuildLanguage(settings);
      
      let message = '';
      if (action === 'opened') {
        const issueBodyText = issue.body ? issue.body.substring(0, 500) + (issue.body.length > 500 ? '...' : '') : '';
        const issueBody = issueBodyText 
          ? `\n\n**Description:**\n\`\`\`\n${issueBodyText}\n\`\`\`` 
          : '';
        message = t('githubIssueOpened', lang, {
          repo: repository.full_name,
          issueTitle: issue.title,
          author: issue.user.login,
          labels: issue.labels.map(l => l.name).join(', ') || 'None',
          issueBody: issueBody,
          issueUrl: issue.html_url,
        });
      } else if (action === 'closed') {
        message = t('githubIssueClosed', lang, {
          repo: repository.full_name,
          issueTitle: issue.title,
          author: issue.user.login,
          closer: issue.closed_by?.login || 'Unknown',
          issueUrl: issue.html_url,
        });
      }

      if (message) {
        await sendMessage(guild.github_channel_id, message);
      }
    } catch (error) {
      console.error(`Error sending GitHub issue notification to guild ${guild.guild_id}:`, error);
    }
  }
}

/**
 * Get timezone offset in milliseconds for a given timezone
 * @param {string} timezone - Timezone name (e.g., 'Asia/Seoul', 'America/New_York')
 * @param {Date} date - Date to get offset for (default: now)
 * @returns {number} Offset in milliseconds
 */
function getTimezoneOffset(timezone = 'Asia/Seoul', date = new Date()) {
  try {
    // Use Intl.DateTimeFormat to get timezone offset
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    
    // Parse offset string like "GMT+09:00" or "GMT-05:00"
    if (offsetPart && offsetPart.value) {
      const offsetStr = offsetPart.value.replace('GMT', '').trim();
      const match = offsetStr.match(/^([+-])(\d{2}):(\d{2})$/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2]);
        const minutes = parseInt(match[3]);
        return sign * (hours * 60 + minutes) * 60 * 1000;
      }
    }
    
    // Fallback: try simpler approach using toLocaleString
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return tzDate.getTime() - utcDate.getTime();
  } catch (error) {
    console.error(`Error getting timezone offset for ${timezone}:`, error);
    // Default to Asia/Seoul (UTC+9) if timezone is invalid
    return 9 * 60 * 60 * 1000;
  }
}

/**
 * Parse relative date string to Date object
 * Supports: "1시간 후", "2 hours later", "내일 오후 3시", "tomorrow 3pm", "다음 주 월요일", "next Monday"
 * @param {string} dateStr - Relative date string or standard date format
 * @param {Date} baseDate - Base date to calculate from (default: now)
 * @param {string} timezone - Timezone name (e.g., 'Asia/Seoul', default: 'Asia/Seoul')
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseRelativeDate(dateStr, baseDate = new Date(), timezone = 'Asia/Seoul') {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const str = dateStr.trim().toLowerCase();
  
  // Get timezone offset
  const tzOffset = getTimezoneOffset(timezone, baseDate);
  
  // Try standard date format first (YYYY-MM-DD HH:mm)
  // Parse as specified timezone explicitly
  const standardDateFormat = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/;
  const standardMatch = dateStr.trim().match(standardDateFormat);
  if (standardMatch) {
    const year = parseInt(standardMatch[1]);
    const month = parseInt(standardMatch[2]) - 1; // Month is 0-indexed
    const day = parseInt(standardMatch[3]);
    const hours = parseInt(standardMatch[4]);
    const minutes = parseInt(standardMatch[5]);
    
    // Create a date string in ISO-like format: "YYYY-MM-DDTHH:mm:ss"
    // Then create a Date object that represents this time in the specified timezone
    // We'll use Intl to convert from the timezone to UTC
    
    // Convert input time (in specified timezone) to UTC
    // Example: "2025-12-23 14:00" in KST (UTC+9) should become "2025-12-23 05:00" UTC
    //
    // Strategy: Treat input as local time in the specified timezone, convert to UTC
    // If timezone is UTC+9, and input is 14:00, then UTC = 14:00 - 9 = 05:00
    
    // Get the timezone offset for this date (accounts for DST)
    // Create a reference date at noon to avoid DST edge cases
    const referenceDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const offsetMs = getTimezoneOffset(timezone, referenceDate);
    
    // offsetMs represents: localTime = UTC + offsetMs
    // So to convert localTime to UTC: UTC = localTime - offsetMs
    // Create a UTC date representing the input time
    const inputAsUTC = new Date(Date.UTC(year, month, day, hours, minutes, 0));
    
    // Subtract the offset to get the actual UTC time
    // For Asia/Seoul (UTC+9): if input is 14:00, then UTC = 14:00 - 9 hours = 05:00
    const utcTime = inputAsUTC.getTime() - offsetMs;
    
    return new Date(utcTime);
  }
  
  // Fallback to default Date parsing for other formats
  const standardDate = new Date(dateStr);
  if (!isNaN(standardDate.getTime())) {
    return standardDate;
  }
  
  // Relative time patterns (Korean and English)
  const patterns = [
    // "N시간 후", "N hours later"
    { regex: /(\d+)\s*(시간|hour|hours|h)\s*(후|later|from now)/, unit: 'hours' },
    { regex: /(\d+)\s*(분|minute|minutes|min|m)\s*(후|later|from now)/, unit: 'minutes' },
    { regex: /(\d+)\s*(일|day|days|d)\s*(후|later|from now)/, unit: 'days' },
    
    // "내일", "tomorrow"
    { regex: /^(내일|tomorrow)$/, unit: 'days', value: 1 },
    
    // "모레", "day after tomorrow"
    { regex: /^(모레|day after tomorrow)$/, unit: 'days', value: 2 },
    
    // "N일 후", "in N days"
    { regex: /^(\d+)\s*(일|days?|d)\s*(후|later|from now|in)?$/, unit: 'days' },
    
    // "오늘", "today" + time
    { regex: /^(오늘|today)\s+(\d{1,2})\s*:?\s*(\d{0,2})\s*(오후|pm|오전|am)?/i, isToday: true },
    
    // "내일", "tomorrow" + time
    { regex: /^(내일|tomorrow)\s+(\d{1,2})\s*:?\s*(\d{0,2})\s*(오후|pm|오전|am)?/i, isTomorrow: true },
    
    // "오후/오전 N시", "N pm/am"
    { regex: /(오후|pm)\s*(\d{1,2})\s*:?\s*(\d{0,2})?/i, isPM: true },
    { regex: /(오전|am)\s*(\d{1,2})\s*:?\s*(\d{0,2})?/i, isAM: true },
  ];
  
  // Get current time in specified timezone
  const nowTZ = new Date();
  const nowTZTime = new Date(nowTZ.getTime() + tzOffset);
  const baseDateTZ = baseDate ? new Date(baseDate.getTime() + tzOffset) : nowTZTime;
  
  for (const pattern of patterns) {
    const match = str.match(pattern.regex);
    if (match) {
      // Start with current time in UTC (will convert KST input to UTC)
      const date = new Date(baseDate);
      
      if (pattern.isToday || pattern.isTomorrow) {
        // Get timezone date components
        const baseTZYear = baseDateTZ.getUTCFullYear();
        const baseTZMonth = baseDateTZ.getUTCMonth();
        const baseTZDate = baseDateTZ.getUTCDate();
        
        if (pattern.isTomorrow) {
          const tomorrowTZ = new Date(Date.UTC(baseTZYear, baseTZMonth, baseTZDate + 1));
          date.setTime(tomorrowTZ.getTime() - tzOffset);
        } else {
          const todayTZ = new Date(Date.UTC(baseTZYear, baseTZMonth, baseTZDate));
          date.setTime(todayTZ.getTime() - tzOffset);
        }
        
        const hour = parseInt(match[2]);
        const minute = parseInt(match[3] || '0');
        const period = match[4]?.toLowerCase();
        
        let finalHour = hour;
        if (period === 'pm' || period === '오후') {
          if (hour !== 12) finalHour = hour + 12;
        } else if (period === 'am' || period === '오전') {
          if (hour === 12) finalHour = 0;
        } else if (hour < 12) {
          // Assume PM if no period specified and hour < 12
          finalHour = hour;
        }
        
        // Set timezone time (convert to UTC)
        const tzTime = new Date(date.getTime() + tzOffset);
        const tzYear = tzTime.getUTCFullYear();
        const tzMonth = tzTime.getUTCMonth();
        const tzDay = tzTime.getUTCDate();
        const offsetHours = tzOffset / (60 * 60 * 1000);
        const utcDate = new Date(Date.UTC(tzYear, tzMonth, tzDay, finalHour - offsetHours, minute));
        return utcDate;
      }
      
      if (pattern.isPM || pattern.isAM) {
        const hour = parseInt(match[2]);
        const minute = parseInt(match[3] || '0');
        let finalHour = hour;
        
        if (pattern.isPM && hour !== 12) {
          finalHour = hour + 12;
        } else if (pattern.isAM && hour === 12) {
          finalHour = 0;
        }
        
        // Get timezone date components
        const baseTZYear = baseDateTZ.getUTCFullYear();
        const baseTZMonth = baseDateTZ.getUTCMonth();
        const baseTZDate = baseDateTZ.getUTCDate();
        const baseTZHours = baseDateTZ.getUTCHours();
        const baseTZMinutes = baseDateTZ.getUTCMinutes();
        
        // Create timezone time
        const offsetHours = tzOffset / (60 * 60 * 1000);
        let tzDate = new Date(Date.UTC(baseTZYear, baseTZMonth, baseTZDate, finalHour, minute));
        
        // If the time has passed today in timezone, set for tomorrow
        if (finalHour < baseTZHours || (finalHour === baseTZHours && minute <= baseTZMinutes)) {
          tzDate = new Date(Date.UTC(baseTZYear, baseTZMonth, baseTZDate + 1, finalHour, minute));
        }
        
        // Convert to UTC (subtract offset)
        return new Date(tzDate.getTime() - tzOffset);
      }
      
      const value = pattern.value !== undefined ? pattern.value : parseInt(match[1]);
      
      // For relative times (hours, minutes, days), add to current UTC time
      // This preserves the relative nature while working with UTC internally
      if (pattern.unit === 'hours') {
        date.setHours(date.getHours() + value);
      } else if (pattern.unit === 'minutes') {
        date.setMinutes(date.getMinutes() + value);
      } else if (pattern.unit === 'days') {
        date.setDate(date.getDate() + value);
      }
      
      return date;
    }
  }
  
  return null;
}

/**
 * Format repeat type information for display
 * @param {string} repeatType - Repeat type string from database
 * @param {string} lang - Language code (en/ko)
 * @param {string|null} repeatEndDate - End date ISO string or null
 * @returns {string} Formatted repeat text
 */
function formatRepeatInfo(repeatType, lang, repeatEndDate = null, timezone = 'Asia/Seoul') {
  if (!repeatType || repeatType === 'none') {
    return '';
  }

  const endDateText = repeatEndDate ? t('repeatEndDate', lang, { date: formatDateTime(new Date(repeatEndDate), timezone) }) : '';
  
  // Parse repeat type string
  if (repeatType.includes(':')) {
    const parts = repeatType.split(':');
    const baseType = parts[0];
    
    if (baseType === 'daily_except') {
      // daily_except:0,6 (excluded weekdays)
      const excludedWeekdayNums = parts[1].split(',').map(w => parseInt(w.trim()));
      const weekdayNames = lang === 'ko' 
        ? ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const excludedDays = excludedWeekdayNums.map(w => weekdayNames[w]).join(', ');
      return t('repeatDailyExcept', lang, { excludedDays, endDate: endDateText });
    } else if (baseType === 'weekly') {
      // weekly:1 (weekday number)
      const weekdayNum = parseInt(parts[1]);
      const weekdayNames = lang === 'ko' 
        ? ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return t('repeatWeeklyWithDay', lang, { weekday: weekdayNames[weekdayNum], endDate: endDateText });
    } else if (baseType === 'biweekly') {
      // biweekly:1 (weekday number)
      const weekdayNum = parseInt(parts[1]);
      const weekdayNames = lang === 'ko' 
        ? ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return t('repeatBiweeklyWithDay', lang, { weekday: weekdayNames[weekdayNum], endDate: endDateText });
    } else if (baseType === 'monthly_day') {
      // monthly_day:15 (day of month)
      const dayOfMonth = parseInt(parts[1]);
      return t('repeatMonthlyDay', lang, { dayOfMonth, endDate: endDateText });
    } else if (baseType === 'monthly_weekday') {
      // monthly_weekday:1:1 (weekOfMonth:weekday)
      const weekOfMonth = parseInt(parts[1]);
      const weekdayNum = parseInt(parts[2]);
      const weekdayNames = lang === 'ko' 
        ? ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekOfMonthNames = lang === 'ko'
        ? ['첫째 주', '둘째 주', '셋째 주', '넷째 주', '마지막 주']
        : ['1st week', '2nd week', '3rd week', '4th week', 'last week'];
      const weekOfMonthText = weekOfMonth === -1 ? weekOfMonthNames[4] : weekOfMonthNames[weekOfMonth - 1];
      return t('repeatMonthlyWeekday', lang, { weekOfMonth: weekOfMonthText, weekday: weekdayNames[weekdayNum], endDate: endDateText });
    }
  }
  
  // Simple types (daily, weekly, biweekly, monthly)
  const repeatKey = `repeat${repeatType.charAt(0).toUpperCase() + repeatType.slice(1)}`;
  return t(repeatKey, lang, { endDate: endDateText });
}

/**
 * Get timezone abbreviation (e.g., KST, PST, EST)
 * @param {string} timezone - Timezone (e.g., 'Asia/Seoul')
 * @param {Date} date - Date to get timezone abbreviation for
 * @returns {string} Timezone abbreviation
 */
function getTimezoneAbbreviation(timezone = 'Asia/Seoul', date = new Date()) {
  // Direct mapping of timezone names to standard abbreviations
  // For DST-aware timezones, we'll try Intl API first, then fall back to direct mapping
  const timezoneMap = {
    'Asia/Seoul': 'KST',
    'Asia/Tokyo': 'JST',
    'Asia/Shanghai': 'CST',
    'Asia/Hong_Kong': 'HKT',
    'Asia/Singapore': 'SGT',
    'UTC': 'UTC',
  };

  // Check direct mapping first (for timezones without DST)
  if (timezoneMap[timezone]) {
    return timezoneMap[timezone];
  }

  // For DST-aware timezones, try Intl API first
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
    
    // If we get a proper abbreviation (not GMT/UTC offset), use it
    if (tzName && !tzName.startsWith('GMT') && !tzName.startsWith('UTC') && /^[A-Z]{2,4}$/.test(tzName)) {
      return tzName;
    }
  } catch (error) {
    // Continue to fallback mapping
  }

  // Fallback: DST-aware timezone mapping based on offset
  // Calculate UTC offset for the given date
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    const offsetHours = Math.round(offsetMs / (1000 * 60 * 60));

    const dstAwareMap = {
      'Europe/London': offsetHours === 0 ? 'GMT' : 'BST',
      'Europe/Paris': offsetHours === 1 ? 'CET' : 'CEST',
      'Europe/Berlin': offsetHours === 1 ? 'CET' : 'CEST',
      'America/New_York': offsetHours === -5 ? 'EST' : 'EDT',
      'America/Chicago': offsetHours === -6 ? 'CST' : 'CDT',
      'America/Denver': offsetHours === -7 ? 'MST' : 'MDT',
      'America/Los_Angeles': offsetHours === -8 ? 'PST' : 'PDT',
      'America/Toronto': offsetHours === -5 ? 'EST' : 'EDT',
      'Australia/Sydney': offsetHours >= 11 ? 'AEDT' : 'AEST',
      'Australia/Melbourne': offsetHours >= 11 ? 'AEDT' : 'AEST',
    };

    if (dstAwareMap[timezone]) {
      return dstAwareMap[timezone];
    }
  } catch (error) {
    console.error(`Error calculating offset for timezone ${timezone}:`, error);
  }

  // Final fallback: use last part of timezone name
  return timezone.split('/').pop()?.substring(0, 3).toUpperCase() || timezone;
}

/**
 * Format date and time for display (YYYY-MM-DD HH:mm (TZ))
 * @param {Date|string} date - Date object or ISO string
 * @param {string} timezone - Timezone (e.g., 'Asia/Seoul')
 * @returns {string} Formatted date string with timezone abbreviation
 */
function formatDateTime(date, timezone = 'Asia/Seoul') {
  if (typeof date === 'string') date = new Date(date);
  // Convert UTC date to specified timezone for display
  try {
    // Use Intl.DateTimeFormat to format date in specified timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hours = parts.find(p => p.type === 'hour')?.value;
    const minutes = parts.find(p => p.type === 'minute')?.value;
    
    const tzAbbr = getTimezoneAbbreviation(timezone, date);
    
    return `${year}-${month}-${day} ${hours}:${minutes} (${tzAbbr})`;
  } catch (error) {
    console.error(`Error formatting date with timezone ${timezone}:`, error);
    // Fallback to UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes} (UTC)`;
  }
}

/**
 * Check for upcoming meetings every minute (improved reminder system)
 */
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);

  try {
    const meetings = meetingQueries.getUpcoming.all();
    
    for (const meetingRow of meetings) {
      const meeting = dbToMeeting(meetingRow);
      const reminderMinutes = JSON.parse(meeting.reminderMinutes);
      const reminded = JSON.parse(meeting.reminded || '[]');
      const meetingDate = new Date(meeting.date);

      // Check each reminder time
      for (const reminderMinutesValue of reminderMinutes) {
        if (reminded.includes(reminderMinutesValue)) continue;

        const reminderTime = new Date(meetingDate.getTime() - reminderMinutesValue * 60 * 1000);
        
        if (reminderTime >= now && reminderTime <= oneMinuteLater) {
          try {
            const settings = guildSettingsQueries.get.get(meeting.guildId);
            const lang = getGuildLanguage(settings);
            const timezone = settings?.timezone || 'Asia/Seoul';
            const participants = JSON.parse(meeting.participants);
            const mentions = formatParticipantsMentions(participants);
            const message = t('meetingReminder', lang, {
              mentions,
              title: meeting.title,
              date: formatDateTime(meetingDate, timezone),
              minutes: reminderMinutesValue,
            });

            await sendMessage(meeting.channelId, message);
            
            reminded.push(reminderMinutesValue);
            meetingQueries.updateReminded.run(JSON.stringify(reminded), meeting.id);
          } catch (error) {
            console.error('Error sending meeting reminder:', error);
          }
        }
      }

      // Check if meeting time has passed and all reminders sent, then handle recurring meetings
      if (meetingDate <= now && meeting.repeatType && meeting.repeatType !== 'none') {
        // Check if all reminders have been sent
        const allRemindersSent = reminderMinutes.every(min => reminded.includes(min));
        
        if (allRemindersSent) {
          try {
            // Create next occurrence before deleting current meeting
            await handleRecurringMeeting(meetingRow);
            // Delete the original meeting after creating next occurrence
            meetingQueries.delete.run(meeting.id);
          } catch (error) {
            console.error('Error handling recurring meeting:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in reminder cron job:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Rundee Bot is listening on port ${PORT}`);
});
