// Localized messages
export const messages = {
  en: {
    // Common
    errorOccurred: '❌ An error occurred: {message}',
    serverOnlyCommand: '❌ This command can only be used in a server.',
    
    // Schedule meeting
    meetingScheduled: '✅ Meeting scheduled!\n\n**Title:** {title}\n**Date:** {date}\n**Participants:** {participants}\n**Reminder times:**\n{reminderTimes}{repeatText}\n**ID:** {id}',
    invalidDate: '❌ Invalid date format. Format: YYYY-MM-DD HH:mm (e.g., 2024-12-25 14:30)',
    pastDate: '❌ Cannot select past dates.',
    noMeetings: '📅 No scheduled meetings.',
    meetingsList: '📅 Scheduled meetings:\n\n{list}',
    
    // Delete meeting
    meetingNotFound: '❌ Meeting with ID {id} not found.',
    meetingDeleted: '✅ Meeting deleted: **{title}** ({date})',
    
    // Edit meeting
    meetingEdited: '✅ Meeting updated!\n\n**Title:** {title}\n**Date:** {date}\n**Participants:** {participants}\n**ID:** {id}',
    
    // Channel settings
    meetingChannelSet: '✅ Meeting announcement channel set to <#{channelId}>',
    githubChannelSet: '✅ GitHub announcement channel set to <#{channelId}>',
    
    // GitHub setup
    githubSetup: '✅ GitHub notifications set to <#{channelId}> channel.\n\n{repoInfo}**Webhook URL:** {webhookUrl}\n\n{steps}',
    githubRepoRegistered: '**Registered repository:** {repo}\n**Repository URL:** {url}\n\n',
    githubSteps: 'Next steps:\n1. Go to {url}/settings/hooks\n2. Click "Add webhook"\n3. Enter Payload URL: {webhookUrl}\n4. Content type: application/json\n5. Select events: Pushes, Pull requests, Issues\n6. Click "Add webhook"\n\nOnce configured, GitHub activities will be automatically sent to the Discord channel!',
    githubRepoNotSet: '**Webhook URL:** {webhookUrl}\n\nTo register a GitHub repository URL, use:\n`/setup-github repository:https://github.com/user/repo`',
    invalidGithubUrl: '❌ Invalid GitHub repository URL. Format: https://github.com/user/repo or user/repo (with or without .git)',
    
    // Language
    languageSet: '✅ Language set to English',
    
    // Recurring
    repeatNone: '',
    repeatDaily: '\n**Repeat:** Daily{endDate}',
    repeatWeekly: '\n**Repeat:** Weekly{endDate}',
    repeatBiweekly: '\n**Repeat:** Biweekly{endDate}',
    repeatMonthly: '\n**Repeat:** Monthly{endDate}',
    repeatEndDate: ' (Ends: {date})',
    
    // Reminders
    allRemindersPassed: 'All reminder times have passed.',
  },
  ko: {
    // Common
    errorOccurred: '❌ 오류가 발생했습니다: {message}',
    serverOnlyCommand: '❌ 서버 내에서만 사용할 수 있는 명령어입니다.',
    
    // Schedule meeting
    meetingScheduled: '✅ 회의 일정이 등록되었습니다!\n\n**제목:** {title}\n**일시:** {date}\n**참석자:** {participants}\n**알림 시간:**\n{reminderTimes}{repeatText}\n**ID:** {id}',
    invalidDate: '❌ 잘못된 날짜 형식입니다. 형식: YYYY-MM-DD HH:mm (예: 2024-12-25 14:30)',
    pastDate: '❌ 과거 날짜는 선택할 수 없습니다.',
    noMeetings: '📅 등록된 회의 일정이 없습니다.',
    meetingsList: '📅 등록된 회의 일정:\n\n{list}',
    
    // Delete meeting
    meetingNotFound: '❌ ID {id}인 회의를 찾을 수 없습니다.',
    meetingDeleted: '✅ 회의 일정이 삭제되었습니다: **{title}** ({date})',
    
    // Edit meeting
    meetingEdited: '✅ 회의 일정이 수정되었습니다!\n\n**제목:** {title}\n**일시:** {date}\n**참석자:** {participants}\n**ID:** {id}',
    
    // Channel settings
    meetingChannelSet: '✅ 회의 알림 채널이 <#{channelId}>로 설정되었습니다.',
    githubChannelSet: '✅ GitHub 알림 채널이 <#{channelId}>로 설정되었습니다.',
    
    // GitHub setup
    githubSetup: '✅ GitHub 알림이 <#{channelId}> 채널로 설정되었습니다.\n\n{repoInfo}**웹훅 URL:** {webhookUrl}\n\n{steps}',
    githubRepoRegistered: '**등록된 저장소:** {repo}\n**저장소 URL:** {url}\n\n',
    githubSteps: '다음 단계:\n1. {url}/settings/hooks 접속\n2. "Add webhook" 클릭\n3. Payload URL에 다음 입력: {webhookUrl}\n4. Content type: application/json 선택\n5. 이벤트 선택: Pushes, Pull requests, Issues\n6. "Add webhook" 저장\n\n설정 완료 후 GitHub 활동이 자동으로 Discord 채널에 알림으로 전송됩니다!',
    githubRepoNotSet: '**웹훅 URL:** {webhookUrl}\n\nGitHub 저장소 URL을 등록하려면 다음 명령어를 사용하세요:\n`/setup-github repository:https://github.com/user/repo`',
    invalidGithubUrl: '❌ 잘못된 GitHub 저장소 URL입니다. 형식: https://github.com/user/repo 또는 user/repo (.git 포함 가능)',
    
    // Language
    languageSet: '✅ 언어가 한국어로 설정되었습니다.',
    
    // Recurring
    repeatNone: '',
    repeatDaily: '\n**반복:** 매일{endDate}',
    repeatWeekly: '\n**반복:** 매주{endDate}',
    repeatBiweekly: '\n**반복:** 격주{endDate}',
    repeatMonthly: '\n**반복:** 매월{endDate}',
    repeatEndDate: ' (종료: {date})',
    
    // Reminders
    allRemindersPassed: '알림 시간이 모두 지났습니다.',
  },
};

/**
 * Get localized message
 */
export function t(key, language = 'en', params = {}) {
  const langMessages = messages[language] || messages.en;
  let message = langMessages[key] || messages.en[key] || key;
  
  // Replace placeholders
  Object.keys(params).forEach(param => {
    message = message.replace(new RegExp(`{${param}}`, 'g'), params[param]);
  });
  
  return message;
}

/**
 * Get language for guild (default: en)
 */
export function getGuildLanguage(guildSettings) {
  return guildSettings?.language || 'en';
}

