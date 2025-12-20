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

const app = express();
const PORT = process.env.PORT || 3000;

// Store meetings in memory (in production, use a database)
const meetings = [];
let meetingIdCounter = 1;

// Store GitHub webhook channels (in production, use a database)
const githubChannels = new Map(); // guildId -> channelId
const githubRepositories = new Map(); // guildId -> repository URL

// Middleware for GitHub webhooks (raw body for signature verification)
app.use('/webhook/github', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Verify signature if secret is set
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

// Middleware for Discord interactions - use raw body for signature verification
// verifyKeyMiddleware needs raw body to verify the signature
app.use('/interactions', express.raw({ type: 'application/json' }));

/**
 * Discord Interactions endpoint
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { id, type, data } = req.body;
  const guildId = req.body.guild_id;
  const channelId = req.body.channel?.id;

  // Handle verification requests
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // Handle slash command requests
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    try {
      if (name === 'schedule-meeting') {
        return await handleScheduleMeeting(data, channelId, res);
      } else if (name === 'list-meetings') {
        return await handleListMeetings(res);
      } else if (name === 'delete-meeting') {
        return await handleDeleteMeeting(data, res);
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
});

/**
 * GitHub Webhook endpoint
 */
app.post('/webhook/github', async (req, res) => {
  const event = req.headers['x-github-event'];
  
  // Parse JSON from raw body (already verified by middleware)
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (error) {
    console.error('Error parsing GitHub webhook payload:', error);
    return res.status(400).send('Invalid JSON');
  }

  console.log(`GitHub webhook received: ${event}`);

  try {
    if (event === 'push') {
      await handleGitHubPush(payload);
    } else if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
      await handleGitHubMerge(payload);
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
async function handleScheduleMeeting(data, channelId, res) {
  const dateStr = data.options?.find(opt => opt.name === 'date')?.value;
  const title = data.options?.find(opt => opt.name === 'title')?.value;
  const participantsStr = data.options?.find(opt => opt.name === 'participants')?.value;
  const reminderMinutesStr = data.options?.find(opt => opt.name === 'reminder_minutes')?.value || '15';

  // Parse reminder minutes (support comma-separated values like "1,5,10")
  const reminderMinutesArray = reminderMinutesStr
    .split(',')
    .map(m => parseInt(m.trim()))
    .filter(m => !isNaN(m) && m > 0)
    .sort((a, b) => b - a); // Sort descending (send earlier reminders first)

  if (reminderMinutesArray.length === 0) {
    reminderMinutesArray.push(15); // Default to 15 minutes if invalid
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

  // Parse participants (support both @mentions and comma-separated user IDs)
  const participants = parseParticipants(participantsStr);

  const meeting = {
    id: meetingIdCounter++,
    title,
    date: meetingDate,
    participants,
    channelId,
    reminderMinutes: reminderMinutesArray,
    reminded: new Set(), // Track which reminder times have been sent
  };

  meetings.push(meeting);

  // Schedule reminders for each time
  let scheduledReminders = 0;
  const reminderTimes = reminderMinutesArray.map(minutes => {
    const reminderTime = new Date(meetingDate.getTime() - minutes * 60 * 1000);
    if (reminderTime > new Date()) {
      scheduleMeetingReminder(meeting, minutes);
      scheduledReminders++;
      return { minutes, time: reminderTime };
    }
    return null;
  }).filter(Boolean);

  const reminderTimesText = reminderTimes.length > 0
    ? reminderTimes.map(rt => `${formatDateTime(rt.time)} (${rt.minutes}분 전)`).join('\n')
    : '알림 시간이 모두 지났습니다.';

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 회의 일정이 등록되었습니다!\n\n**제목:** ${title}\n**일시:** ${formatDateTime(meetingDate)}\n**참석자:** ${participants.map(p => `<@${p}>`).join(', ')}\n**알림 시간:**\n${reminderTimesText}\n**ID:** ${meeting.id}`,
    },
  });
}

/**
 * Handle list-meetings command
 */
async function handleListMeetings(res) {
  const upcomingMeetings = meetings
    .filter(m => m.date > new Date() && m.reminded.size < m.reminderMinutes.length)
    .sort((a, b) => a.date - b.date);

  if (upcomingMeetings.length === 0) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '📅 등록된 회의 일정이 없습니다.',
      },
    });
  }

  const meetingList = upcomingMeetings
    .map(m => `**ID: ${m.id}** - ${m.title}\n일시: ${formatDateTime(m.date)}\n참석자: ${m.participants.map(p => `<@${p}>`).join(', ')}`)
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

  const index = meetings.findIndex(m => m.id === meetingId);
  if (index === -1) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ ID ${meetingId}인 회의를 찾을 수 없습니다.`,
      },
    });
  }

  const meeting = meetings[index];
  meetings.splice(index, 1);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 회의 일정이 삭제되었습니다: **${meeting.title}** (${formatDateTime(meeting.date)})`,
    },
  });
}

/**
 * Handle setup-github command
 */
async function handleSetupGitHub(data, guildId, channelId, res) {
  // Get channel from option or use current channel
  const channelOption = data.options?.find(opt => opt.name === 'channel');
  const repositoryOption = data.options?.find(opt => opt.name === 'repository');
  const targetChannelId = channelOption?.value || channelId;
  const repositoryUrl = repositoryOption?.value;

  if (!guildId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 서버 내에서만 사용할 수 있는 명령어입니다.',
      },
    });
  }

  if (!targetChannelId) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 채널을 지정해주세요.',
      },
    });
  }

  // Parse GitHub repository URL
  let repositoryInfo = null;
  if (repositoryUrl) {
    try {
      // Support formats: https://github.com/user/repo, github.com/user/repo, user/repo
      const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w\-\.]+)\/([\w\-\.]+)/i;
      const match = repositoryUrl.match(urlPattern);
      
      if (match) {
        repositoryInfo = {
          owner: match[1],
          repo: match[2],
          full_name: `${match[1]}/${match[2]}`,
          url: `https://github.com/${match[1]}/${match[2]}`,
        };
        githubRepositories.set(guildId, repositoryInfo);
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 잘못된 GitHub 저장소 URL입니다. 형식: https://github.com/user/repo 또는 user/repo',
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

  githubChannels.set(guildId, targetChannelId);

  const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'http://your-domain.com'}/webhook/github`;
  
  let responseMessage = `✅ GitHub 알림이 <#${targetChannelId}> 채널로 설정되었습니다.\n\n`;
  
  if (repositoryInfo) {
    responseMessage += `**등록된 저장소:** ${repositoryInfo.full_name}\n`;
    responseMessage += `**저장소 URL:** ${repositoryInfo.url}\n\n`;
  }
  
  responseMessage += `**웹훅 URL:** ${webhookUrl}\n\n`;
  
  if (repositoryInfo) {
    responseMessage += `다음 단계:\n`;
    responseMessage += `1. ${repositoryInfo.url}/settings/hooks 접속\n`;
    responseMessage += `2. "Add webhook" 클릭\n`;
    responseMessage += `3. Payload URL에 다음 입력: ${webhookUrl}\n`;
    responseMessage += `4. Content type: application/json 선택\n`;
    responseMessage += `5. 이벤트 선택: Pushes, Pull requests\n`;
    responseMessage += `6. "Add webhook" 저장\n\n`;
    responseMessage += `설정 완료 후 GitHub 활동이 자동으로 Discord 채널에 알림으로 전송됩니다!`;
  } else {
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
 * Parse participants from string (supports @mentions, user IDs, comma-separated)
 */
function parseParticipants(participantsStr) {
  const participants = [];
  
  // Extract user IDs from mentions (e.g., <@123456789>)
  const mentionRegex = /<@!?(\d+)>/g;
  let match;
  while ((match = mentionRegex.exec(participantsStr)) !== null) {
    participants.push(match[1]);
  }

  // Also check for comma-separated user IDs
  const parts = participantsStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    // If it's a numeric ID, add it
    if (/^\d+$/.test(trimmed) && !participants.includes(trimmed)) {
      participants.push(trimmed);
    }
  }

  return participants;
}

/**
 * Schedule a meeting reminder using cron
 */
function scheduleMeetingReminder(meeting, reminderMinutes) {
  const reminderTime = new Date(meeting.date.getTime() - reminderMinutes * 60 * 1000);
  
  // Format: minute hour day month weekday
  const minute = reminderTime.getMinutes();
  const hour = reminderTime.getHours();
  const day = reminderTime.getDate();
  const month = reminderTime.getMonth() + 1;

  const cronExpression = `${minute} ${hour} ${day} ${month} *`;

  cron.schedule(cronExpression, async () => {
    // Check if this specific reminder has already been sent
    if (meeting.reminded.has(reminderMinutes)) return;

    try {
      const mentions = meeting.participants.map(p => `<@${p}>`).join(' ');
      const message = `📢 **회의 알림**\n\n${mentions}\n\n**${meeting.title}**\n⏰ 일시: ${formatDateTime(meeting.date)}\n\n${reminderMinutes}분 후 회의가 시작됩니다!`;

      await sendMessage(meeting.channelId, message);
      meeting.reminded.add(reminderMinutes);
    } catch (error) {
      console.error('Error sending meeting reminder:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul',
  });
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
async function handleGitHubPush(payload) {
  const repository = payload.repository;
  const pusher = payload.pusher;
  const commits = payload.commits || [];
  const ref = payload.ref;

  const branch = ref.replace('refs/heads/', '');

  for (const [guildId, channelId] of githubChannels.entries()) {
    try {
      const commitMessages = commits.map(c => `  • ${c.message.split('\n')[0]} (${c.author.name})`).join('\n');
      const message = `🔔 **GitHub Push 이벤트**\n\n**저장소:** ${repository.full_name}\n**브랜치:** ${branch}\n**작성자:** ${pusher.name}\n**커밋 수:** ${commits.length}\n\n**커밋 내역:**\n${commitMessages}\n\n🔗 [보기](${payload.compare})`;

      await sendMessage(channelId, message);
    } catch (error) {
      console.error(`Error sending GitHub push notification to guild ${guildId}:`, error);
    }
  }
}

/**
 * Handle GitHub merge event (pull request merged)
 */
async function handleGitHubMerge(payload) {
  const repository = payload.repository;
  const pullRequest = payload.pull_request;
  const merger = pullRequest.merged_by;

  for (const [guildId, channelId] of githubChannels.entries()) {
    try {
      const message = `🔀 **GitHub Merge 이벤트**\n\n**저장소:** ${repository.full_name}\n**PR 제목:** ${pullRequest.title}\n**작성자:** ${pullRequest.user.login}\n**머지한 사람:** ${merger.login}\n**베이스 브랜치:** ${pullRequest.base.ref}\n**머지 브랜치:** ${pullRequest.head.ref}\n\n🔗 [PR 보기](${pullRequest.html_url})`;

      await sendMessage(channelId, message);
    } catch (error) {
      console.error(`Error sending GitHub merge notification to guild ${guildId}:`, error);
    }
  }
}

/**
 * Format date and time for display
 */
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Start checking for upcoming meetings every minute (fallback)
 */
cron.schedule('* * * * *', () => {
  const now = new Date();
  const oneMinuteLater = new Date(now.getTime() + 60 * 1000);

  meetings.forEach(async (meeting) => {
    if (!meeting.reminderMinutes || !Array.isArray(meeting.reminderMinutes)) return;

    // Check each reminder time
    for (const reminderMinutes of meeting.reminderMinutes) {
      if (meeting.reminded.has(reminderMinutes)) continue;

      const reminderTime = new Date(meeting.date.getTime() - reminderMinutes * 60 * 1000);
      
      if (reminderTime >= now && reminderTime <= oneMinuteLater) {
        try {
          const mentions = meeting.participants.map(p => `<@${p}>`).join(' ');
          const message = `📢 **회의 알림**\n\n${mentions}\n\n**${meeting.title}**\n⏰ 일시: ${formatDateTime(meeting.date)}\n\n${reminderMinutes}분 후 회의가 시작됩니다!`;

          await sendMessage(meeting.channelId, message);
          meeting.reminded.add(reminderMinutes);
        } catch (error) {
          console.error('Error sending meeting reminder:', error);
        }
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Rundee Bot is listening on port ${PORT}`);
});
