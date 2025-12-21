import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import crypto from 'crypto';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import db, { meetingQueries, guildSettingsQueries } from './database.js';
import { t, getGuildLanguage } from './messages.js';

const app = express();
const PORT = process.env.PORT || 8080;

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
          if (name === 'schedule-meeting') {
            return await handleScheduleMeeting(data, guildId, channelId, res);
          } else if (name === 'list-meetings') {
            return await handleListMeetings(guildId, res);
          } else if (name === 'delete-meeting') {
            return await handleDeleteMeeting(data, res);
          } else if (name === 'edit-meeting') {
            return await handleEditMeeting(data, res);
          } else if (name === 'set-meeting-channel') {
            return await handleSetMeetingChannel(data, guildId, channelId, res);
          } else if (name === 'set-github-channel') {
            return await handleSetGithubChannel(data, guildId, channelId, res);
          } else if (name === 'setup-github') {
            return await handleSetupGitHub(data, guildId, channelId, res);
          } else if (name === 'test-meeting') {
            return await handleTestMeeting(data, guildId, channelId, res);
          } else if (name === 'set-meeting-time') {
            return await handleSetMeetingTime(data, guildId, channelId, res);
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
 * Handle schedule-meeting command
 */
async function handleScheduleMeeting(data, guildId, channelId, res) {
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

  const dateStr = data.options?.find(opt => opt.name === 'date')?.value;
  const title = data.options?.find(opt => opt.name === 'title')?.value;
  const participantsStr = data.options?.find(opt => opt.name === 'participants')?.value;
  const reminderMinutesStr = data.options?.find(opt => opt.name === 'reminder_minutes')?.value || '15';
  const repeatType = data.options?.find(opt => opt.name === 'repeat')?.value || 'none';
  const repeatEndStr = data.options?.find(opt => opt.name === 'repeat_end')?.value;

  // Parse reminder minutes
  const reminderMinutesArray = reminderMinutesStr
    .split(',')
    .map(m => parseInt(m.trim()))
    .filter(m => !isNaN(m) && m > 0)
    .sort((a, b) => b - a);

  if (reminderMinutesArray.length === 0) {
    reminderMinutesArray.push(15);
  }

  // Parse date
  const meetingDate = new Date(dateStr);
  if (isNaN(meetingDate.getTime())) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('invalidDate', lang),
      },
    });
  }

  if (meetingDate < new Date()) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('pastDate', lang),
      },
    });
  }

  // Parse participants
  const participants = parseParticipants(participantsStr);

  // Get meeting channel from settings or use current channel
  const meetingChannelId = settings?.meeting_channel_id || channelId;

  // Parse repeat end date if provided
  let repeatEndDate = null;
  if (repeatEndStr && repeatType !== 'none') {
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

  // Calculate repeat interval
  let repeatInterval = null;
  if (repeatType !== 'none') {
    repeatInterval = getRepeatInterval(repeatType);
  }

  // Insert into database
  const result = meetingQueries.insert.run(
    guildId,
    title,
    meetingDate.toISOString(),
    JSON.stringify(participants),
    meetingChannelId,
    JSON.stringify(reminderMinutesArray),
    repeatType === 'none' ? null : repeatType,
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

  let repeatText = '';
  if (repeatType !== 'none') {
    const repeatKey = `repeat${repeatType.charAt(0).toUpperCase() + repeatType.slice(1)}`;
    repeatText = t(repeatKey, lang, { 
      endDate: repeatEndDate ? t('repeatEndDate', lang, { date: formatDateTime(repeatEndDate) }) : ''
    });
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingScheduled', lang, {
        title,
        date: formatDateTime(meetingDate),
        participants: participants.map(p => `<@${p}>`).join(', '),
        reminderTimes: reminderTimesText,
        repeatText,
        id: meetingId,
      }),
    },
  });
}

/**
 * Handle list-meetings command
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
      },
    });
  }

  const dateLabel = lang === 'ko' ? '일시' : 'Date';
  const participantsLabel = lang === 'ko' ? '참석자' : 'Participants';
  
  const meetingList = upcomingMeetings
    .map(m => {
      const participants = JSON.parse(m.participants);
      return `**ID: ${m.id}** - ${m.title}\n${dateLabel}: ${formatDateTime(new Date(m.date))}\n${participantsLabel}: ${participants.map(p => `<@${p}>`).join(', ')}`;
    })
    .join('\n\n');

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingsList', lang, { list: meetingList }),
    },
  });
}

/**
 * Handle delete-meeting command
 */
async function handleDeleteMeeting(data, res) {
  const meetingId = parseInt(data.options?.find(opt => opt.name === 'meeting_id')?.value);
  
  // Get guild ID from meeting to determine language
  const meeting = meetingQueries.getById.get(meetingId);
  if (!meeting) {
    // Default to English if meeting not found
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingNotFound', 'en', { id: meetingId }),
      },
    });
  }
  
  const settings = guildSettingsQueries.get.get(meeting.guild_id);
  const lang = getGuildLanguage(settings);

  meetingQueries.delete.run(meetingId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingDeleted', lang, {
        title: meeting.title,
        date: formatDateTime(new Date(meeting.date)),
      }),
    },
  });
}

/**
 * Handle edit-meeting command
 */
async function handleEditMeeting(data, res) {
  const meetingId = parseInt(data.options?.find(opt => opt.name === 'meeting_id')?.value);
  
  const meeting = meetingQueries.getById.get(meetingId);
  if (!meeting) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingNotFound', 'en', { id: meetingId }),
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
    date = new Date(dateOption.value);
    if (isNaN(date.getTime())) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('invalidDate', lang),
        },
      });
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

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingEdited', lang, {
        title,
        date: formatDateTime(date),
        participants: participants.map(p => `<@${p}>`).join(', '),
        id: meetingId,
      }),
    },
  });
}

/**
 * Handle set-meeting-channel command
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
        },
      });
    }

    const channelOption = data.options?.find(opt => opt.name === 'channel');
    const targetChannelId = channelOption?.value || channelId;

    try {
      guildSettingsQueries.setMeetingChannel.run(guildId, targetChannelId);
    } catch (dbError) {
      console.error('Database error in set-meeting-channel:', dbError);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: `Database error: ${dbError.message}` }),
        },
      });
    }

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('meetingChannelSet', lang, { channelId: targetChannelId }),
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
        },
      });
    }

    const channelOption = data.options?.find(opt => opt.name === 'channel');
    const targetChannelId = channelOption?.value || channelId;

    try {
      guildSettingsQueries.setGithubChannel.run(guildId, targetChannelId);
    } catch (dbError) {
      console.error('Database error in set-github-channel:', dbError);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: t('errorOccurred', lang, { message: `Database error: ${dbError.message}` }),
        },
      });
    }

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('githubChannelSet', lang, { channelId: targetChannelId }),
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
 * Handle test-meeting command (creates a meeting 1 minute from now for testing)
 */
async function handleTestMeeting(data, guildId, channelId, res) {
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

  // Create a meeting 1 minute from now
  const now = new Date();
  const testDate = new Date(now.getTime() + 60 * 1000); // 1 minute from now
  
  const participantsStr = data.options?.find(opt => opt.name === 'participants')?.value || '<@' + (data.member?.user?.id || '') + '>';
  const participants = parseParticipants(participantsStr);
  
  // Get meeting channel from settings or use current channel
  const meetingChannelId = settings?.meeting_channel_id || channelId;
  
  const title = 'Test Meeting';
  const reminderMinutesArray = [1]; // 1 minute reminder (which should trigger almost immediately)
  
  // Insert into database
  const result = meetingQueries.insert.run(
    guildId,
    title,
    testDate.toISOString(),
    JSON.stringify(participants),
    meetingChannelId,
    JSON.stringify(reminderMinutesArray),
    null, // no repeat
    null,
    null
  );

  const meetingId = result.lastInsertRowid;

  // Schedule reminder
  scheduleMeetingReminder(meetingId, guildId, title, testDate, participants, meetingChannelId, 1);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingScheduled', lang, {
        title,
        date: formatDateTime(testDate),
        participants: participants.map(p => `<@${p}>`).join(', '),
        reminderTimes: `${formatDateTime(new Date(testDate.getTime() - 60 * 1000))} (1 min before)`,
        repeatText: '',
        id: meetingId,
      }) + '\n\n**Note: This is a test meeting. Reminder should arrive in about 1 minute.**',
    },
  });
}

/**
 * Handle set-meeting-time command (interactive GUI)
 */
async function handleSetMeetingTime(data, guildId, channelId, res) {
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

  // Show repeat type selection menu
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: lang === 'ko' 
        ? '회의 반복 주기를 선택하세요:'
        : 'Select meeting repeat frequency:',
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 3, // Select Menu
              custom_id: 'repeat_type_select',
              placeholder: lang === 'ko' ? '반복 주기 선택' : 'Select repeat type',
              options: [
                {
                  label: lang === 'ko' ? '반복 없음' : 'No Repeat',
                  value: 'none',
                  description: lang === 'ko' ? '한 번만 예약' : 'Schedule once',
                },
                {
                  label: lang === 'ko' ? '매일' : 'Daily',
                  value: 'daily',
                  description: lang === 'ko' ? '매일 같은 시간' : 'Every day at same time',
                },
                {
                  label: lang === 'ko' ? '매주' : 'Weekly',
                  value: 'weekly',
                  description: lang === 'ko' ? '매주 같은 요일' : 'Every week on same weekday',
                },
                {
                  label: lang === 'ko' ? '격주' : 'Bi-weekly',
                  value: 'biweekly',
                  description: lang === 'ko' ? '격주 같은 요일' : 'Every 2 weeks on same weekday',
                },
                {
                  label: lang === 'ko' ? '매월 (날짜)' : 'Monthly (Day)',
                  value: 'monthly_day',
                  description: lang === 'ko' ? '매월 같은 날짜 (예: 매월 15일)' : 'Every month on same date (e.g., 15th)',
                },
                {
                  label: lang === 'ko' ? '매월 (요일)' : 'Monthly (Weekday)',
                  value: 'monthly_weekday',
                  description: lang === 'ko' ? '매월 같은 주의 같은 요일 (예: 첫째 주 월요일)' : 'Every month on same weekday (e.g., 1st Monday)',
                },
              ],
            },
          ],
        },
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Handle message component interactions (buttons, select menus)
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

  // Handle repeat type selection
  if (customId === 'repeat_type_select' && componentType === 3) {
    const repeatType = data.values?.[0];
    
    if (repeatType === 'daily') {
      // For daily, show option to exclude weekdays
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' 
            ? '제외할 요일을 선택하세요 (복수 선택 가능, 제외할 것이 없으면 "없음" 선택):'
            : 'Select weekdays to exclude (multiple selection allowed, select "None" if no exclusions):',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 3, // Select Menu (multi-select)
                  custom_id: 'daily_exclude_weekdays',
                  placeholder: lang === 'ko' ? '제외할 요일 선택' : 'Select weekdays to exclude',
                  min_values: 0,
                  max_values: 7,
                  options: [
                    { label: lang === 'ko' ? '없음' : 'None', value: 'none', description: lang === 'ko' ? '모든 요일 포함' : 'Include all days' },
                    { label: lang === 'ko' ? '월요일' : 'Monday', value: '1' },
                    { label: lang === 'ko' ? '화요일' : 'Tuesday', value: '2' },
                    { label: lang === 'ko' ? '수요일' : 'Wednesday', value: '3' },
                    { label: lang === 'ko' ? '목요일' : 'Thursday', value: '4' },
                    { label: lang === 'ko' ? '금요일' : 'Friday', value: '5' },
                    { label: lang === 'ko' ? '토요일' : 'Saturday', value: '6' },
                    { label: lang === 'ko' ? '일요일' : 'Sunday', value: '0' },
                  ],
                },
              ],
            },
          ],
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
    
    if (repeatType === 'none' || repeatType === 'biweekly') {
      // For simple types, show modal for meeting details
      return res.send({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `meeting_modal_${repeatType}`,
          title: lang === 'ko' ? '회의 일정 등록' : 'Schedule Meeting',
          components: [
            {
              type: 1, // Action Row
              components: [
                {
                  type: 4, // Text Input
                  custom_id: 'meeting_title',
                  label: lang === 'ko' ? '회의 제목' : 'Meeting Title',
                  style: 1, // Short
                  min_length: 1,
                  max_length: 100,
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'meeting_date',
                  label: lang === 'ko' ? '날짜 및 시간 (YYYY-MM-DD HH:mm)' : 'Date & Time (YYYY-MM-DD HH:mm)',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: 2024-12-25 14:30' : 'e.g., 2024-12-25 14:30',
                  min_length: 16,
                  max_length: 16,
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'meeting_participants',
                  label: lang === 'ko' ? '참석자 (@멘션 또는 사용자ID)' : 'Participants (@mentions or user IDs)',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: @user1 @user2' : 'e.g., @user1 @user2',
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'reminder_minutes',
                  label: lang === 'ko' ? '알림 시간(분 전, 쉼표로 구분)' : 'Reminder Minutes (comma-separated)',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: 1,5,10 (기본값: 15)' : 'e.g., 1,5,10 (default: 15)',
                  required: false,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'repeat_end_date',
                  label: lang === 'ko' ? '반복 종료 날짜 (YYYY-MM-DD, 선택사항)' : 'Repeat End Date (YYYY-MM-DD, optional)',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: 2025-12-31' : 'e.g., 2025-12-31',
                  required: false,
                },
              ],
            },
          ],
        },
      });
    } else if (repeatType === 'weekly' || repeatType === 'monthly_weekday') {
      // For weekly/monthly_weekday, show weekday selection first
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' ? '요일을 선택하세요:' : 'Select weekday:',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 3,
                  custom_id: `weekday_select_${repeatType}`,
                  placeholder: lang === 'ko' ? '요일 선택' : 'Select weekday',
                  options: [
                    { label: lang === 'ko' ? '월요일' : 'Monday', value: '1' },
                    { label: lang === 'ko' ? '화요일' : 'Tuesday', value: '2' },
                    { label: lang === 'ko' ? '수요일' : 'Wednesday', value: '3' },
                    { label: lang === 'ko' ? '목요일' : 'Thursday', value: '4' },
                    { label: lang === 'ko' ? '금요일' : 'Friday', value: '5' },
                    { label: lang === 'ko' ? '토요일' : 'Saturday', value: '6' },
                    { label: lang === 'ko' ? '일요일' : 'Sunday', value: '0' },
                  ],
                },
              ],
            },
          ],
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    } else if (repeatType === 'monthly_day') {
      // For monthly_day, show day of month selection
      const dayOptions = Array.from({ length: 31 }, (_, i) => ({
        label: `${i + 1}${lang === 'ko' ? '일' : 'th'}`,
        value: String(i + 1),
      }));

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' ? '매월 몇 일인지 선택하세요:' : 'Select day of month:',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 3,
                  custom_id: 'monthly_day_select',
                  placeholder: lang === 'ko' ? '날짜 선택' : 'Select day',
                  options: dayOptions,
                },
              ],
            },
          ],
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
  }

  // Handle weekday selection for weekly/monthly_weekday
  if (customId?.startsWith('weekday_select_')) {
    const repeatType = customId.replace('weekday_select_', '');
    const weekday = data.values?.[0];
    
    if (repeatType === 'monthly_weekday') {
      // For monthly_weekday, show week of month selection
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: lang === 'ko' ? '몇 번째 주인지 선택하세요:' : 'Select which week of month:',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 3,
                  custom_id: `monthly_week_select_${weekday}`,
                  placeholder: lang === 'ko' ? '주 선택' : 'Select week',
                  options: [
                    { label: lang === 'ko' ? '첫째 주' : '1st week', value: '1' },
                    { label: lang === 'ko' ? '둘째 주' : '2nd week', value: '2' },
                    { label: lang === 'ko' ? '셋째 주' : '3rd week', value: '3' },
                    { label: lang === 'ko' ? '넷째 주' : '4th week', value: '4' },
                    { label: lang === 'ko' ? '마지막 주' : 'Last week', value: '-1' },
                  ],
                },
              ],
            },
          ],
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    } else {
      // For weekly/biweekly, show modal directly
      return res.send({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `meeting_modal_${repeatType}_${weekday}`,
          title: lang === 'ko' ? '회의 일정 등록' : 'Schedule Meeting',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'meeting_title',
                  label: lang === 'ko' ? '회의 제목' : 'Meeting Title',
                  style: 1,
                  min_length: 1,
                  max_length: 100,
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'meeting_time',
                  label: lang === 'ko' ? '시간 (HH:mm)' : 'Time (HH:mm)',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: 14:30' : 'e.g., 14:30',
                  min_length: 5,
                  max_length: 5,
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'meeting_participants',
                  label: lang === 'ko' ? '참석자' : 'Participants',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: @user1 @user2' : 'e.g., @user1 @user2',
                  required: true,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'reminder_minutes',
                  label: lang === 'ko' ? '알림 시간(분 전)' : 'Reminder Minutes',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: 1,5,10' : 'e.g., 1,5,10',
                  required: false,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'repeat_end_date',
                  label: lang === 'ko' ? '반복 종료 날짜 (YYYY-MM-DD)' : 'Repeat End Date (YYYY-MM-DD)',
                  style: 1,
                  placeholder: lang === 'ko' ? '예: 2025-12-31' : 'e.g., 2025-12-31',
                  required: false,
                },
              ],
            },
          ],
        },
      });
    }
  }

  // Handle monthly week selection for monthly_weekday
  if (customId?.startsWith('monthly_week_select_')) {
    const weekday = customId.replace('monthly_week_select_', '');
    const weekOfMonth = data.values?.[0];
    
    return res.send({
      type: InteractionResponseType.MODAL,
      data: {
        custom_id: `meeting_modal_monthly_weekday_${weekOfMonth}_${weekday}`,
        title: lang === 'ko' ? '회의 일정 등록' : 'Schedule Meeting',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'meeting_title',
                label: lang === 'ko' ? '회의 제목' : 'Meeting Title',
                style: 1,
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'meeting_time',
                label: lang === 'ko' ? '시간 (HH:mm)' : 'Time (HH:mm)',
                style: 1,
                placeholder: lang === 'ko' ? '예: 14:30' : 'e.g., 14:30',
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'meeting_participants',
                label: lang === 'ko' ? '참석자' : 'Participants',
                style: 1,
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'reminder_minutes',
                label: lang === 'ko' ? '알림 시간(분 전)' : 'Reminder Minutes',
                style: 1,
                required: false,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'repeat_end_date',
                label: lang === 'ko' ? '반복 종료 날짜' : 'Repeat End Date',
                style: 1,
                required: false,
              },
            ],
          },
        ],
      },
    });
  }

  // Handle monthly_day selection
  if (customId === 'monthly_day_select') {
    const dayOfMonth = data.values?.[0];
    
    return res.send({
      type: InteractionResponseType.MODAL,
      data: {
        custom_id: `meeting_modal_monthly_day_${dayOfMonth}`,
        title: lang === 'ko' ? '회의 일정 등록' : 'Schedule Meeting',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'meeting_title',
                label: lang === 'ko' ? '회의 제목' : 'Meeting Title',
                style: 1,
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'meeting_time',
                label: lang === 'ko' ? '시간 (HH:mm)' : 'Time (HH:mm)',
                style: 1,
                placeholder: lang === 'ko' ? '예: 14:30' : 'e.g., 14:30',
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'meeting_participants',
                label: lang === 'ko' ? '참석자' : 'Participants',
                style: 1,
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'reminder_minutes',
                label: lang === 'ko' ? '알림 시간(분 전)' : 'Reminder Minutes',
                style: 1,
                required: false,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'repeat_end_date',
                label: lang === 'ko' ? '반복 종료 날짜' : 'Repeat End Date',
                style: 1,
                required: false,
              },
            ],
          },
        ],
      },
    });
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Unknown component interaction',
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Handle modal submit interactions
 */
async function handleModalSubmit(body, res) {
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

  const customId = data.custom_id;
  const components = data.components || [];

  // Extract values from modal components
  const getComponentValue = (customId) => {
    for (const row of components) {
      const component = row.components?.[0];
      if (component?.custom_id === customId) {
        return component.value;
      }
    }
    return null;
  };

  const title = getComponentValue('meeting_title');
  const dateStr = getComponentValue('meeting_date');
  const timeStr = getComponentValue('meeting_time');
  const participantsStr = getComponentValue('meeting_participants');
  const reminderMinutesStr = getComponentValue('reminder_minutes') || '15';
  const repeatEndStr = getComponentValue('repeat_end_date');

  // Parse modal custom_id to get repeat type and parameters
  let repeatType = 'none';
  let weekday = null;
  let dayOfMonth = null;
  let weekOfMonth = null;

  if (customId.startsWith('meeting_modal_')) {
    const modalId = customId.replace('meeting_modal_', '');
    
    if (modalId.startsWith('monthly_weekday_')) {
      // Format: monthly_weekday_${weekOfMonth}_${weekday}
      const parts = modalId.replace('monthly_weekday_', '').split('_');
      repeatType = 'monthly_weekday';
      weekOfMonth = parseInt(parts[0]);
      weekday = parts[1];
    } else if (modalId.startsWith('monthly_day_')) {
      // Format: monthly_day_${dayOfMonth}
      repeatType = 'monthly_day';
      dayOfMonth = modalId.replace('monthly_day_', '');
    } else if (modalId.startsWith('daily_except_')) {
      // Format: daily_except_${weekdays} (e.g., daily_except_0,6 for excluding Sunday and Saturday)
      repeatType = 'daily_except';
      const excludeStr = modalId.replace('daily_except_', '');
      if (excludeStr) {
        weekday = excludeStr.split(',').map(w => parseInt(w));
      } else {
        weekday = [];
      }
    } else if (modalId === 'daily') {
      // Simple daily with no exclusions
      repeatType = 'daily';
      weekday = [];
    } else {
      // Format: ${repeatType}_${weekday} or ${repeatType}
      const parts = modalId.split('_');
      repeatType = parts[0]; // none, biweekly, weekly
      if (parts.length > 1 && repeatType !== 'daily') {
        weekday = parts[1]; // For weekly/biweekly
      }
    }
  }

  // Calculate actual meeting date
  let meetingDate;
  
  if (dateStr) {
    // Full date string provided (for none, daily, biweekly)
    meetingDate = new Date(dateStr);
  } else if (timeStr && (weekday !== null || dayOfMonth !== null)) {
    // Time string provided, need to calculate date based on repeat type
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    if (repeatType === 'weekly' || repeatType === 'biweekly') {
      // Find next occurrence of the weekday
      meetingDate = getNextWeekday(now, parseInt(weekday), hours, minutes);
    } else if (repeatType === 'monthly_day') {
      // Find next occurrence of the day of month
      meetingDate = getNextDayOfMonth(now, parseInt(dayOfMonth), hours, minutes);
    } else if (repeatType === 'monthly_weekday') {
      // Find next occurrence of nth weekday of month
      meetingDate = getNextNthWeekday(now, weekOfMonth, parseInt(weekday), hours, minutes);
    } else {
      meetingDate = new Date(now);
      meetingDate.setHours(hours, minutes, 0, 0);
      if (meetingDate <= now) {
        meetingDate.setDate(meetingDate.getDate() + 1);
      }
    }
  } else {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: 'Invalid date/time format' }),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  if (isNaN(meetingDate.getTime())) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('invalidDate', lang),
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  const participants = parseParticipants(participantsStr);
  if (participants.length === 0) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: 'No valid participants found' }),
        flags: InteractionResponseFlags.EPHEMERAL,
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
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
  }

  // Calculate repeat interval and format repeat_type for database
  let repeatInterval = null;
  let dbRepeatType = repeatType;
  
  if (repeatType !== 'none') {
    if (repeatType === 'daily') {
      repeatInterval = 1;
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
  }

  const meetingChannelId = settings?.meeting_channel_id || channelId;

  // Insert into database
  const result = meetingQueries.insert.run(
    guildId,
    title,
    meetingDate.toISOString(),
    JSON.stringify(participants),
    meetingChannelId,
    JSON.stringify(reminderMinutesArray),
    dbRepeatType === 'none' ? null : dbRepeatType,
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

  let repeatText = '';
  if (repeatType !== 'none') {
    const repeatKey = `repeat${repeatType.charAt(0).toUpperCase() + repeatType.slice(1)}`;
    repeatText = t(repeatKey, lang, { 
      endDate: repeatEndDate ? t('repeatEndDate', lang, { date: formatDateTime(repeatEndDate) }) : ''
    });
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: t('meetingScheduled', lang, {
        title,
        date: formatDateTime(meetingDate),
        participants: participants.map(p => `<@${p}>`).join(', '),
        reminderTimes: reminderTimesText,
        repeatText,
        id: meetingId,
      }),
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

/**
 * Helper function to get next occurrence of a weekday
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
 * Helper function to get next occurrence of a day of month
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
 * Helper function to get next occurrence of nth weekday of month
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
          },
        });
      }
    }
  } catch (error) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: t('errorOccurred', lang, { message: 'Failed to parse GitHub repository URL.' }),
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
    },
  });
}

/**
 * Parse participants from string
 */
function parseParticipants(participantsStr) {
  const participants = [];
  
  const mentionRegex = /<@!?(\d+)>/g;
  let match;
  while ((match = mentionRegex.exec(participantsStr)) !== null) {
    participants.push(match[1]);
  }

  const parts = participantsStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (/^\d+$/.test(trimmed) && !participants.includes(trimmed)) {
      participants.push(trimmed);
    }
  }

  return participants;
}

/**
 * Get repeat interval in days
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
 * Schedule a meeting reminder
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

      const mentions = participants.map(p => `<@${p}>`).join(' ');
      const message = `**Meeting Reminder**\n\n${mentions}\n\n**${title}**\n**Date:** ${formatDateTime(date)}\n\nMeeting starts in ${reminderMinutes} minute(s)!`;

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
 * Handle recurring meeting - create next occurrence
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
 * Send a message to a Discord channel
 */
async function sendMessage(channelId, content) {
  return await DiscordRequest(`channels/${channelId}/messages`, {
    method: 'POST',
    body: {
      content,
    },
  });
}

/**
 * Handle GitHub push event
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
      const commitMessages = commits.slice(0, 5).map(c => `  • ${c.message.split('\n')[0]} (${c.author.name})`).join('\n');
      const moreCommits = commits.length > 5 ? `\n  ... and ${commits.length - 5} more commits` : '';
      const message = `**GitHub Push Event**\n\n**Repository:** ${repository.full_name}\n**Branch:** ${branch}\n**Author:** ${pusher.name}\n**Commits:** ${commits.length}\n\n**Commit History:**\n${commitMessages}${moreCommits}\n\n[View](${payload.compare})`;

      await sendMessage(guild.github_channel_id, message);
    } catch (error) {
      console.error(`Error sending GitHub push notification to guild ${guild.guild_id}:`, error);
    }
  }
}

/**
 * Handle GitHub pull request event
 */
async function handleGitHubPullRequest(payload, guilds) {
  const repository = payload.repository;
  const pullRequest = payload.pull_request;
  const action = payload.action;

  for (const guild of guilds) {
    if (!guild.github_channel_id) continue;

    try {
      let message = '';
      if (action === 'opened') {
        message = `**GitHub Pull Request Opened**\n\n**Repository:** ${repository.full_name}\n**PR Title:** ${pullRequest.title}\n**Author:** ${pullRequest.user.login}\n**Base:** ${pullRequest.base.ref} <- **Head:** ${pullRequest.head.ref}\n\n[View PR](${pullRequest.html_url})`;
      } else if (action === 'closed' && pullRequest.merged) {
        const merger = pullRequest.merged_by;
        message = `**GitHub Pull Request Merged**\n\n**Repository:** ${repository.full_name}\n**PR Title:** ${pullRequest.title}\n**Author:** ${pullRequest.user.login}\n**Merged by:** ${merger.login}\n**Base Branch:** ${pullRequest.base.ref}\n**Merge Branch:** ${pullRequest.head.ref}\n\n[View PR](${pullRequest.html_url})`;
      } else if (action === 'closed') {
        message = `**GitHub Pull Request Closed**\n\n**Repository:** ${repository.full_name}\n**PR Title:** ${pullRequest.title}\n**Author:** ${pullRequest.user.login}\n\n[View PR](${pullRequest.html_url})`;
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
 * Handle GitHub issue event
 */
async function handleGitHubIssue(payload, guilds) {
  const repository = payload.repository;
  const issue = payload.issue;
  const action = payload.action;

  for (const guild of guilds) {
    if (!guild.github_channel_id) continue;

    try {
      let message = '';
      if (action === 'opened') {
        message = `**GitHub Issue Opened**\n\n**Repository:** ${repository.full_name}\n**Title:** ${issue.title}\n**Author:** ${issue.user.login}\n**Labels:** ${issue.labels.map(l => l.name).join(', ') || 'None'}\n\n${issue.body ? issue.body.substring(0, 200) + (issue.body.length > 200 ? '...' : '') : ''}\n\n[View Issue](${issue.html_url})`;
      } else if (action === 'closed') {
        message = `**GitHub Issue Closed**\n\n**Repository:** ${repository.full_name}\n**Title:** ${issue.title}\n**Author:** ${issue.user.login}\n**Closed by:** ${issue.closed_by?.login || 'Unknown'}\n\n[View Issue](${issue.html_url})`;
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
 * Format date and time for display
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
            const mentions = participants.map(p => `<@${p}>`).join(' ');
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
