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
      const body = JSON.parse(req.body.toString());
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
          }

          console.error(`unknown command: ${name}`);
          return res.status(400).json({ error: 'unknown command' });
        } catch (error) {
          console.error('Error handling command:', error);
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ 오류가 발생했습니다: ${error.message}`,
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
  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 서버 내에서만 사용할 수 있는 명령어입니다.',
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
        content: '❌ 잘못된 날짜 형식입니다. 형식: YYYY-MM-DD HH:mm (예: 2024-12-25 14:30)',
      },
    });
  }

  if (meetingDate < new Date()) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 과거 날짜는 선택할 수 없습니다.',
      },
    });
  }

  // Parse participants
  const participants = parseParticipants(participantsStr);

  // Get meeting channel from settings or use current channel
  const settings = guildSettingsQueries.get.get(guildId);
  const meetingChannelId = settings?.meeting_channel_id || channelId;

  // Parse repeat end date if provided
  let repeatEndDate = null;
  if (repeatEndStr && repeatType !== 'none') {
    repeatEndDate = new Date(repeatEndStr);
    if (isNaN(repeatEndDate.getTime())) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ 잘못된 반복 종료 날짜 형식입니다.',
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
    ? reminderTimes.map(rt => `${formatDateTime(rt.time)} (${rt.minutes}분 전)`).join('\n')
    : '알림 시간이 모두 지났습니다.';

  let repeatText = '';
  if (repeatType !== 'none') {
    const repeatNames = {
      daily: '매일',
      weekly: '매주',
      biweekly: '격주',
      monthly: '매월',
    };
    repeatText = `\n**반복:** ${repeatNames[repeatType] || repeatType}`;
    if (repeatEndDate) {
      repeatText += ` (종료: ${formatDateTime(repeatEndDate)})`;
    }
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 회의 일정이 등록되었습니다!\n\n**제목:** ${title}\n**일시:** ${formatDateTime(meetingDate)}\n**참석자:** ${participants.map(p => `<@${p}>`).join(', ')}\n**알림 시간:**\n${reminderTimesText}${repeatText}\n**ID:** ${meetingId}`,
    },
  });
}

/**
 * Handle list-meetings command
 */
async function handleListMeetings(guildId, res) {
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
        content: '📅 등록된 회의 일정이 없습니다.',
      },
    });
  }

  const meetingList = upcomingMeetings
    .map(m => {
      const participants = JSON.parse(m.participants);
      return `**ID: ${m.id}** - ${m.title}\n일시: ${formatDateTime(new Date(m.date))}\n참석자: ${participants.map(p => `<@${p}>`).join(', ')}`;
    })
    .join('\n\n');

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `📅 등록된 회의 일정:\n\n${meetingList}`,
    },
  });
}

/**
 * Handle delete-meeting command
 */
async function handleDeleteMeeting(data, res) {
  const meetingId = parseInt(data.options?.find(opt => opt.name === 'meeting_id')?.value);

  const meeting = meetingQueries.getById.get(meetingId);
  if (!meeting) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ ID ${meetingId}인 회의를 찾을 수 없습니다.`,
      },
    });
  }

  meetingQueries.delete.run(meetingId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 회의 일정이 삭제되었습니다: **${meeting.title}** (${formatDateTime(new Date(meeting.date))})`,
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
        content: `❌ ID ${meetingId}인 회의를 찾을 수 없습니다.`,
      },
    });
  }

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
          content: '❌ 잘못된 날짜 형식입니다.',
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
      content: `✅ 회의 일정이 수정되었습니다!\n\n**제목:** ${title}\n**일시:** ${formatDateTime(date)}\n**참석자:** ${participants.map(p => `<@${p}>`).join(', ')}\n**ID:** ${meetingId}`,
    },
  });
}

/**
 * Handle set-meeting-channel command
 */
async function handleSetMeetingChannel(data, guildId, channelId, res) {
  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 서버 내에서만 사용할 수 있는 명령어입니다.',
      },
    });
  }

  const channelOption = data.options?.find(opt => opt.name === 'channel');
  const targetChannelId = channelOption?.value || channelId;

  guildSettingsQueries.setMeetingChannel.run(guildId, targetChannelId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 회의 알림 채널이 <#${targetChannelId}>로 설정되었습니다.`,
    },
  });
}

/**
 * Handle set-github-channel command
 */
async function handleSetGithubChannel(data, guildId, channelId, res) {
  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 서버 내에서만 사용할 수 있는 명령어입니다.',
      },
    });
  }

  const channelOption = data.options?.find(opt => opt.name === 'channel');
  const targetChannelId = channelOption?.value || channelId;

  guildSettingsQueries.setGithubChannel.run(guildId, targetChannelId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ GitHub 알림 채널이 <#${targetChannelId}>로 설정되었습니다.`,
    },
  });
}

/**
 * Handle setup-github command
 */
async function handleSetupGitHub(data, guildId, channelId, res) {
  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 서버 내에서만 사용할 수 있는 명령어입니다.',
      },
    });
  }

  const channelOption = data.options?.find(opt => opt.name === 'channel');
  const repositoryOption = data.options?.find(opt => opt.name === 'repository');
  const targetChannelId = channelOption?.value || channelId;
  const repositoryUrl = repositoryOption?.value;

  // Update channel
  if (targetChannelId) {
    guildSettingsQueries.setGithubChannel.run(guildId, targetChannelId);
  }

  // Parse and update repository
  let repositoryInfo = null;
  if (repositoryUrl) {
    try {
      const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w\-\.]+)\/([\w\-\.]+)/i;
      const match = repositoryUrl.match(urlPattern);
      
      if (match) {
        repositoryInfo = {
          owner: match[1],
          repo: match[2],
          full_name: `${match[1]}/${match[2]}`,
          url: `https://github.com/${match[1]}/${match[2]}`,
        };
        guildSettingsQueries.setGithubRepository.run(guildId, repositoryInfo.full_name);
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 잘못된 GitHub 저장소 URL입니다.',
          },
        });
      }
    } catch (error) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ GitHub 저장소 URL을 파싱하는 중 오류가 발생했습니다.',
        },
      });
    }
  }

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'https://rundeerundeebot-production.up.railway.app'}/webhook/github`;
  
  let responseMessage = `✅ GitHub 알림이 <#${targetChannelId}> 채널로 설정되었습니다.\n\n`;
  
  if (repositoryInfo) {
    responseMessage += `**등록된 저장소:** ${repositoryInfo.full_name}\n`;
    responseMessage += `**저장소 URL:** ${repositoryInfo.url}\n\n`;
    responseMessage += `**웹훅 URL:** ${webhookUrl}\n\n`;
    responseMessage += `다음 단계:\n`;
    responseMessage += `1. ${repositoryInfo.url}/settings/hooks 접속\n`;
    responseMessage += `2. "Add webhook" 클릭\n`;
    responseMessage += `3. Payload URL에 다음 입력: ${webhookUrl}\n`;
    responseMessage += `4. Content type: application/json 선택\n`;
    responseMessage += `5. 이벤트 선택: Pushes, Pull requests, Issues\n`;
    responseMessage += `6. "Add webhook" 저장\n\n`;
    responseMessage += `설정 완료 후 GitHub 활동이 자동으로 Discord 채널에 알림으로 전송됩니다!`;
  } else {
    responseMessage += `**웹훅 URL:** ${webhookUrl}\n\n`;
    responseMessage += `GitHub 저장소 URL을 등록하려면 다음 명령어를 사용하세요:\n`;
    responseMessage += `\`/setup-github repository:https://github.com/user/repo\``;
  }

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
      const message = `📢 **회의 알림**\n\n${mentions}\n\n**${title}**\n⏰ 일시: ${formatDateTime(date)}\n\n${reminderMinutes}분 후 회의가 시작됩니다!`;

      await sendMessage(channelId, message);
      
      reminded.push(reminderMinutes);
      meetingQueries.updateReminded.run(JSON.stringify(reminded), meetingId);

      // Handle recurring meetings - schedule next occurrence after reminder sent
      if (meeting.repeat_type && meeting.repeat_type !== 'none') {
        // Wait a bit, then create next occurrence
        setTimeout(() => handleRecurringMeeting(meeting), 1000);
      }
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

  // Calculate next date
  const nextDate = new Date(currentDate);
  if (dbMeeting.repeatType === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (dbMeeting.repeatType === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (dbMeeting.repeatType === 'biweekly') {
    nextDate.setDate(nextDate.getDate() + 14);
  } else if (dbMeeting.repeatType === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  // Check if next date exceeds end date
  if (repeatEndDate && nextDate > repeatEndDate) {
    return;
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
      const moreCommits = commits.length > 5 ? `\n  ... 및 ${commits.length - 5}개의 커밋 더` : '';
      const message = `🔔 **GitHub Push 이벤트**\n\n**저장소:** ${repository.full_name}\n**브랜치:** ${branch}\n**작성자:** ${pusher.name}\n**커밋 수:** ${commits.length}\n\n**커밋 내역:**\n${commitMessages}${moreCommits}\n\n🔗 [보기](${payload.compare})`;

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
        message = `🔀 **GitHub Pull Request 열림**\n\n**저장소:** ${repository.full_name}\n**PR 제목:** ${pullRequest.title}\n**작성자:** ${pullRequest.user.login}\n**베이스:** ${pullRequest.base.ref} ← **헤드:** ${pullRequest.head.ref}\n\n🔗 [PR 보기](${pullRequest.html_url})`;
      } else if (action === 'closed' && pullRequest.merged) {
        const merger = pullRequest.merged_by;
        message = `✅ **GitHub Pull Request 머지됨**\n\n**저장소:** ${repository.full_name}\n**PR 제목:** ${pullRequest.title}\n**작성자:** ${pullRequest.user.login}\n**머지한 사람:** ${merger.login}\n**베이스 브랜치:** ${pullRequest.base.ref}\n**머지 브랜치:** ${pullRequest.head.ref}\n\n🔗 [PR 보기](${pullRequest.html_url})`;
      } else if (action === 'closed') {
        message = `❌ **GitHub Pull Request 닫힘**\n\n**저장소:** ${repository.full_name}\n**PR 제목:** ${pullRequest.title}\n**작성자:** ${pullRequest.user.login}\n\n🔗 [PR 보기](${pullRequest.html_url})`;
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
        message = `📝 **GitHub Issue 열림**\n\n**저장소:** ${repository.full_name}\n**제목:** ${issue.title}\n**작성자:** ${issue.user.login}\n**라벨:** ${issue.labels.map(l => l.name).join(', ') || '없음'}\n\n${issue.body ? issue.body.substring(0, 200) + (issue.body.length > 200 ? '...' : '') : ''}\n\n🔗 [Issue 보기](${issue.html_url})`;
      } else if (action === 'closed') {
        message = `✅ **GitHub Issue 닫힘**\n\n**저장소:** ${repository.full_name}\n**제목:** ${issue.title}\n**작성자:** ${issue.user.login}\n**닫은 사람:** ${issue.closed_by?.login || '알 수 없음'}\n\n🔗 [Issue 보기](${issue.html_url})`;
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
            const participants = JSON.parse(meeting.participants);
            const mentions = participants.map(p => `<@${p}>`).join(' ');
            const message = `📢 **회의 알림**\n\n${mentions}\n\n**${meeting.title}**\n⏰ 일시: ${formatDateTime(meetingDate)}\n\n${reminderMinutesValue}분 후 회의가 시작됩니다!`;

            await sendMessage(meeting.channelId, message);
            
            reminded.push(reminderMinutesValue);
            meetingQueries.updateReminded.run(JSON.stringify(reminded), meeting.id);
          } catch (error) {
            console.error('Error sending meeting reminder:', error);
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
