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
import db, { meetingQueries, guildSettingsQueries } from './database.js';
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
        const { name } = data;

        try {
          if (name === 'list-meetings') {
            return await handleListMeetings(guildId, res);
          } else if (name === 'delete-meeting') {
            return await handleDeleteMeeting(data, res, body);
          } else if (name === 'edit-meeting') {
            return await handleEditMeeting(data, res);
          } else if (name === 'set-meeting-channel') {
            return await handleSetMeetingChannel(data, guildId, channelId, res);
          } else if (name === 'set-github-channel') {
            return await handleSetGithubChannel(data, guildId, channelId, res);
          } else if (name === 'setup-github') {
            return await handleSetupGitHub(data, guildId, channelId, res);
          } else if (name === 'set-meeting-time') {
            return await handleSetMeetingTime(data, guildId, channelId, res);
          } else if (name === 'set-recurring-meeting') {
            return await handleSetRecurringMeeting(data, guildId, channelId, res);
          } else if (name === 'set-language') {
            return await handleSetLanguage(data, guildId, res);
          } else if (name === 'channel-status') {
            return await handleChannelStatus(guildId, res);
          }

          console.error(`unknown command: ${name}`);
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
      const repeatInfo = m.repeatType ? formatRepeatInfo(m.repeatType, lang, m.repeatEndDate) : '';
      return `**ID: ${m.id}** - ${m.title}\n${dateLabel}: ${formatDateTime(new Date(m.date))}\n${participantsLabel}: ${formatParticipants(participants)}${repeatInfo}`;
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
        date: formatDateTime(new Date(meeting.date)),
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
    date = parseRelativeDate(dateOption.value);
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
    const conflictWarning = checkMeetingConflict(meeting.guild_id, date, meetingId);
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
    date: formatDateTime(date),
    participants: formatParticipants(participants),
    id: meetingId,
  });
  
  // Check for conflicts if date was changed
  const conflictWarning = dateOption ? checkMeetingConflict(meeting.guild_id, date, meetingId) : null;
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
    let meetingDate = parseRelativeDate(dateStr);
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
    const conflictWarningBefore = checkMeetingConflict(guildId, meetingDate, null);

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

    // Insert into database
    const result = meetingQueries.insert.run(
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

    const meetingId = result.lastInsertRowid;
    
    // Check for conflicts AFTER insertion (excluding the newly created meeting)
    const conflictWarning = checkMeetingConflict(guildId, meetingDate, meetingId);

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
          return `${formatDateTime(rt.time)} (${minutesText})`;
        }).join('\n')
      : t('allRemindersPassed', lang);

    // Single meeting - no repeat text
    const scheduledMessage = t('meetingScheduled', lang, {
      title,
      date: formatDateTime(meetingDate),
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

    const meetingTitle = meeting.title;
    const meetingDate = formatDateTime(new Date(meeting.date));
    
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
    
    // Restore meeting
    try {
      meetingQueries.insert.run(
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
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' 
            ? `✅ 회의가 복구되었습니다: **${deletedMeeting.title}** (${formatDateTime(new Date(deletedMeeting.date))})`
            : `✅ Meeting restored: **${deletedMeeting.title}** (${formatDateTime(new Date(deletedMeeting.date))})`,
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
    const now = new Date();
    let meetingDate;

    if (repeatType === 'daily') {
      // Next occurrence at the specified time
      meetingDate = new Date(now);
      meetingDate.setHours(hours, minutes, 0, 0);
      if (meetingDate <= now) {
        meetingDate.setDate(meetingDate.getDate() + 1);
      }
      
      // Skip excluded weekdays (max 7 iterations to avoid infinite loop)
      let attempts = 0;
      while (excludedWeekdays.includes(meetingDate.getDay()) && attempts < 7) {
        meetingDate.setDate(meetingDate.getDate() + 1);
        attempts++;
      }
    } else if (repeatType === 'weekly' || repeatType === 'biweekly') {
      // Find next occurrence of the weekday
      meetingDate = getNextWeekday(now, parseInt(weekday), hours, minutes);
    } else if (repeatType === 'monthly_day') {
      // Find next occurrence of the day of month
      meetingDate = getNextDayOfMonth(now, parseInt(dayOfMonth), hours, minutes);
    } else if (repeatType === 'monthly_weekday') {
      // Find next occurrence of nth weekday of month
      meetingDate = getNextNthWeekday(now, weekOfMonth, parseInt(weekday), hours, minutes);
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

    // Insert into database
    const result = meetingQueries.insert.run(
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

    const meetingId = result.lastInsertRowid;

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
          return `${formatDateTime(rt.time)} (${minutesText})`;
        }).join('\n')
      : t('allRemindersPassed', lang);

    // Format detailed repeat information using dbRepeatType (has detailed format)
    const repeatText = formatRepeatInfo(dbRepeatType, lang, repeatEndDate ? repeatEndDate.toISOString() : null);

    // Check for conflicts with first occurrence (excluding the newly created meeting)
    const conflictWarning = checkMeetingConflict(guildId, meetingDate, meetingId);
    
    const scheduledMessage = t('meetingScheduled', lang, {
      title,
      date: formatDateTime(meetingDate),
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
function checkMeetingConflict(guildId, meetingDate, excludeMeetingId = null) {
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
    const conflictList = conflicts.map(m => `- ${m.title} (${formatDateTime(new Date(m.date))})`).join('\n');
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

  const minute = reminderTime.getMinutes();
  const hour = reminderTime.getHours();
  const day = reminderTime.getDate();
  const month = reminderTime.getMonth() + 1;
  const year = reminderTime.getFullYear();

  const cronExpression = `${minute} ${hour} ${day} ${month} *`;

  cron.schedule(cronExpression, async () => {
    try {
      const meeting = meetingQueries.getById.get(meetingId);
      if (!meeting) return;

      const reminded = JSON.parse(meeting.reminded || '[]');
      if (reminded.includes(reminderMinutes)) return;

      const settings = guildSettingsQueries.get.get(guildId);
      const lang = getGuildLanguage(settings);
      const mentions = formatParticipantsMentions(participants);
      const message = t('meetingReminder', lang, {
        mentions,
        title,
        date: formatDateTime(date),
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
    timezone: 'Asia/Seoul',
  });
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

  // Create next meeting
  const reminderMinutes = JSON.parse(dbMeeting.reminderMinutes);
  const result = meetingQueries.insert.run(
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

  const nextMeetingId = result.lastInsertRowid;
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
        const issueBody = issue.body ? issue.body.substring(0, 200) + (issue.body.length > 200 ? '...' : '') : '';
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
 * Parse relative date string to Date object
 * Supports: "1시간 후", "2 hours later", "내일 오후 3시", "tomorrow 3pm", "다음 주 월요일", "next Monday"
 * @param {string} dateStr - Relative date string or standard date format
 * @param {Date} baseDate - Base date to calculate from (default: now)
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseRelativeDate(dateStr, baseDate = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const str = dateStr.trim().toLowerCase();
  
  // Try standard date format first (YYYY-MM-DD HH:mm)
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
  
  for (const pattern of patterns) {
    const match = str.match(pattern.regex);
    if (match) {
      const date = new Date(baseDate);
      
      if (pattern.isToday || pattern.isTomorrow) {
        if (pattern.isTomorrow) {
          date.setDate(date.getDate() + 1);
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
        
        date.setHours(finalHour, minute, 0, 0);
        return date;
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
        
        date.setHours(finalHour, minute, 0, 0);
        // If the time has passed today, set for tomorrow
        if (date < baseDate) {
          date.setDate(date.getDate() + 1);
        }
        return date;
      }
      
      const value = pattern.value !== undefined ? pattern.value : parseInt(match[1]);
      
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
function formatRepeatInfo(repeatType, lang, repeatEndDate = null) {
  if (!repeatType || repeatType === 'none') {
    return '';
  }

  const endDateText = repeatEndDate ? t('repeatEndDate', lang, { date: formatDateTime(new Date(repeatEndDate)) }) : '';
  
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
 * Format date and time for display (YYYY-MM-DD HH:mm)
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string
 */
function formatDateTime(date) {
  if (typeof date === 'string') date = new Date(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
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
            const participants = JSON.parse(meeting.participants);
            const mentions = formatParticipantsMentions(participants);
            const message = t('meetingReminder', lang, {
              mentions,
              title: meeting.title,
              date: formatDateTime(meetingDate),
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
