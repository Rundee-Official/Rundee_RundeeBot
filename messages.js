/**
 * @fileoverview Localized messages for Rundee Bot
 * @copyright Rundee 2024
 * @license MIT
 */

// Localized messages
export const messages = {
  en: {
    // Common
    errorOccurred: 'Error: {message}',
    serverOnlyCommand: 'This command can only be used in a server.',
    
    // Schedule meeting
    meetingScheduled: 'Meeting scheduled!\n\n**Title:** {title}\n**Date:** {date}\n**Participants:** {participants}\n**Reminder times:**\n{reminderTimes}{repeatText}\n**ID:** {id}',
    invalidDate: 'Invalid date format. Format: YYYY-MM-DD HH:mm (e.g., 2024-12-25 14:30)',
    pastDate: 'Cannot select past dates.',
    noMeetings: 'No scheduled meetings.',
    meetingsList: 'Scheduled meetings:\n\n{list}',
    
    // Delete meeting
    meetingNotFound: 'Meeting with ID {id} not found.',
    meetingDeleted: 'Meeting deleted: **{title}** ({date})',
    
    // Edit meeting
    meetingEdited: 'Meeting updated!\n\n**Title:** {title}\n**Date:** {date}\n**Participants:** {participants}\n**ID:** {id}',
    
    // Channel settings
    meetingChannelSet: 'Meeting announcement channel set to <#{channelId}>',
    githubChannelSet: 'GitHub announcement channel set to <#{channelId}>',
    channelStatusTitle: 'Current Channel Settings',
    channelStatusMeeting: 'Meeting Channel: {channel}',
    channelStatusGithub: 'GitHub Channel: {channel}',
    channelStatusRepo: 'GitHub Repository: {repo}',
    channelNotSet: 'Not set',
    channelInvalid: 'Invalid or inaccessible channel',
    channelNotFound: 'Channel not found or bot does not have access',
    invalidChannelError: 'Invalid or inaccessible channel. Please ensure the bot has permissions to view and send messages to the channel.',
    
    // GitHub setup
    githubSetup: 'GitHub notifications set to <#{channelId}> channel.\n\n{repoInfo}**Webhook URL:** {webhookUrl}\n\n{steps}',
    githubRepoRegistered: '**Registered repository:** {repo}\n**Repository URL:** {url}\n\n',
    githubSteps: 'Next steps:\n1. Go to {url}/settings/hooks\n2. Click "Add webhook"\n3. Enter Payload URL: {webhookUrl}\n4. Content type: application/json\n5. Select events: Pushes, Pull requests, Issues\n6. Click "Add webhook"\n\nOnce configured, GitHub activities will be automatically sent to the Discord channel!',
    githubRepoNotSet: '**Webhook URL:** {webhookUrl}\n\nTo register a GitHub repository URL, use:\n`/setup-github repository:https://github.com/user/repo`',
    invalidGithubUrl: 'Invalid GitHub repository URL. Format: https://github.com/user/repo or user/repo (with or without .git)',
    
    // Language
    languageSet: 'Language set to English',
    
    // Recurring
    repeatNone: '',
    repeatDaily: '\n**Repeat:** Daily{endDate}',
    repeatWeekly: '\n**Repeat:** Weekly{endDate}',
    repeatBiweekly: '\n**Repeat:** Biweekly{endDate}',
    repeatMonthly: '\n**Repeat:** Monthly{endDate}',
    repeatEndDate: ' (Ends: {date})',
    
    // Reminders
    allRemindersPassed: 'All reminder times have passed.',
    meetingReminder: 'Meeting Reminder\n\n{mentions}\n\n**{title}**\n**Date:** {date}\n\nMeeting starts in {minutes} minute(s)!',
    
    // GitHub notifications
    githubPush: 'GitHub Push Event\n\n**Repository:** {repo}\n**Branch:** {branch}\n**Author:** {author}\n**Commits:** {commitsCount}\n\n**Commit History:**\n{commitMessages}{moreCommits}\n\n[View]({compareUrl})',
    githubPROpened: 'GitHub Pull Request Opened\n\n**Repository:** {repo}\n**PR Title:** {prTitle}\n**Author:** {author}\n**Base:** {baseRef} <- **Head:** {headRef}\n\n[View PR]({prUrl})',
    githubPRMerged: 'GitHub Pull Request Merged\n\n**Repository:** {repo}\n**PR Title:** {prTitle}\n**Author:** {author}\n**Merged By:** {merger}\n**Base Branch:** {baseRef}\n**Merged Branch:** {headRef}\n\n[View PR]({prUrl})',
    githubPRClosed: 'GitHub Pull Request Closed\n\n**Repository:** {repo}\n**PR Title:** {prTitle}\n**Author:** {author}\n\n[View PR]({prUrl})',
    githubIssueOpened: 'GitHub Issue Opened\n\n**Repository:** {repo}\n**Title:** {issueTitle}\n**Author:** {author}\n**Labels:** {labels}\n\n{issueBody}\n\n[View Issue]({issueUrl})',
    githubIssueClosed: 'GitHub Issue Closed\n\n**Repository:** {repo}\n**Title:** {issueTitle}\n**Author:** {author}\n**Closed By:** {closer}\n\n[View Issue]({issueUrl})',
    
    // Recurring meeting details
    repeatDailyExcept: '\n**Repeat:** Daily (except {excludedDays}){endDate}',
    repeatWeeklyWithDay: '\n**Repeat:** Weekly on {weekday}{endDate}',
    repeatBiweeklyWithDay: '\n**Repeat:** Bi-weekly on {weekday}{endDate}',
    repeatMonthlyDay: '\n**Repeat:** Monthly on day {dayOfMonth}{endDate}',
    repeatMonthlyWeekday: '\n**Repeat:** Monthly on the {weekOfMonth} {weekday}{endDate}',
    
    // Weekday names
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    
    // Week of month names
    firstWeek: '1st week',
    secondWeek: '2nd week',
    thirdWeek: '3rd week',
    fourthWeek: '4th week',
    lastWeek: 'last week',
  },
  ko: {
    // Common
    errorOccurred: '오류: {message}',
    serverOnlyCommand: '서버 내에서만 사용할 수 있는 명령어입니다.',
    
    // Schedule meeting
    meetingScheduled: '회의 일정이 등록되었습니다.\n\n**제목:** {title}\n**일시:** {date}\n**참석자:** {participants}\n**알림 시간:**\n{reminderTimes}{repeatText}\n**ID:** {id}',
    invalidDate: '잘못된 날짜 형식입니다. 형식: YYYY-MM-DD HH:mm (예: 2024-12-25 14:30)',
    pastDate: '과거 날짜는 선택할 수 없습니다.',
    noMeetings: '등록된 회의 일정이 없습니다.',
    meetingsList: '등록된 회의 일정:\n\n{list}',
    
    // Delete meeting
    meetingNotFound: 'ID {id}인 회의를 찾을 수 없습니다.',
    meetingDeleted: '회의 일정이 삭제되었습니다: **{title}** ({date})',
    
    // Edit meeting
    meetingEdited: '회의 일정이 수정되었습니다.\n\n**제목:** {title}\n**일시:** {date}\n**참석자:** {participants}\n**ID:** {id}',
    
    // Channel settings
    meetingChannelSet: '회의 알림 채널이 <#{channelId}>로 설정되었습니다.',
    githubChannelSet: 'GitHub 알림 채널이 <#{channelId}>로 설정되었습니다.',
    channelStatusTitle: '현재 채널 설정',
    channelStatusMeeting: '회의 알림 채널: {channel}',
    channelStatusGithub: 'GitHub 알림 채널: {channel}',
    channelStatusRepo: 'GitHub 저장소: {repo}',
    channelNotSet: '설정되지 않음',
    channelInvalid: '유효하지 않거나 접근할 수 없는 채널',
    channelNotFound: '채널을 찾을 수 없거나 봇이 접근 권한이 없습니다',
    invalidChannelError: '유효하지 않거나 접근할 수 없는 채널입니다. 봇이 채널을 보고 메시지를 보낼 권한이 있는지 확인해 주세요.',
    
    // GitHub setup
    githubSetup: 'GitHub 알림이 <#{channelId}> 채널로 설정되었습니다.\n\n{repoInfo}**웹훅 URL:** {webhookUrl}\n\n{steps}',
    githubRepoRegistered: '**등록된 저장소:** {repo}\n**저장소 URL:** {url}\n\n',
    githubSteps: '다음 단계:\n1. {url}/settings/hooks 접속\n2. "Add webhook" 클릭\n3. Payload URL에 다음 입력: {webhookUrl}\n4. Content type: application/json 선택\n5. 이벤트 선택: Pushes, Pull requests, Issues\n6. "Add webhook" 저장\n\n설정 완료 후 GitHub 활동이 자동으로 Discord 채널에 알림으로 전송됩니다.',
    githubRepoNotSet: '**웹훅 URL:** {webhookUrl}\n\nGitHub 저장소 URL을 등록하려면 다음 명령어를 사용하세요:\n`/setup-github repository:https://github.com/user/repo`',
    invalidGithubUrl: '잘못된 GitHub 저장소 URL입니다. 형식: https://github.com/user/repo 또는 user/repo (.git 포함 가능)',
    
    // Language
    languageSet: '언어가 한국어로 설정되었습니다.',
    
    // Recurring
    repeatNone: '',
    repeatDaily: '\n**반복:** 매일{endDate}',
    repeatWeekly: '\n**반복:** 매주{endDate}',
    repeatBiweekly: '\n**반복:** 격주{endDate}',
    repeatMonthly: '\n**반복:** 매월{endDate}',
    repeatEndDate: ' (종료: {date})',
    
    // Reminders
    allRemindersPassed: '알림 시간이 모두 지났습니다.',
    meetingReminder: '회의 알림\n\n{mentions}\n\n**{title}**\n**일시:** {date}\n\n{minutes}분 후 회의가 시작됩니다!',
    
    // GitHub notifications
    githubPush: 'GitHub Push 이벤트\n\n**저장소:** {repo}\n**브랜치:** {branch}\n**작성자:** {author}\n**커밋 수:** {commitsCount}\n\n**커밋 내역:**\n{commitMessages}{moreCommits}\n\n[보기]({compareUrl})',
    githubPROpened: 'GitHub Pull Request 열림\n\n**저장소:** {repo}\n**PR 제목:** {prTitle}\n**작성자:** {author}\n**베이스:** {baseRef} <- **헤드:** {headRef}\n\n[PR 보기]({prUrl})',
    githubPRMerged: 'GitHub Pull Request 머지됨\n\n**저장소:** {repo}\n**PR 제목:** {prTitle}\n**작성자:** {author}\n**머지한 사람:** {merger}\n**베이스 브랜치:** {baseRef}\n**머지 브랜치:** {headRef}\n\n[PR 보기]({prUrl})',
    githubPRClosed: 'GitHub Pull Request 닫힘\n\n**저장소:** {repo}\n**PR 제목:** {prTitle}\n**작성자:** {author}\n\n[PR 보기]({prUrl})',
    githubIssueOpened: 'GitHub Issue 열림\n\n**저장소:** {repo}\n**제목:** {issueTitle}\n**작성자:** {author}\n**라벨:** {labels}\n\n{issueBody}\n\n[이슈 보기]({issueUrl})',
    githubIssueClosed: 'GitHub Issue 닫힘\n\n**저장소:** {repo}\n**제목:** {issueTitle}\n**작성자:** {author}\n**닫은 사람:** {closer}\n\n[이슈 보기]({issueUrl})',
    
    // Recurring meeting details
    repeatDailyExcept: '\n**반복:** 매일 (제외: {excludedDays}){endDate}',
    repeatWeeklyWithDay: '\n**반복:** 매주 {weekday}{endDate}',
    repeatBiweeklyWithDay: '\n**반복:** 격주 {weekday}{endDate}',
    repeatMonthlyDay: '\n**반복:** 매월 {dayOfMonth}일{endDate}',
    repeatMonthlyWeekday: '\n**반복:** 매월 {weekOfMonth} {weekday}{endDate}',
    
    // Weekday names
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일',
    
    // Week of month names
    firstWeek: '첫째 주',
    secondWeek: '둘째 주',
    thirdWeek: '셋째 주',
    fourthWeek: '넷째 주',
    lastWeek: '마지막 주',
  },
};

/**
 * Get localized message
 * @param {string} key - Message key
 * @param {string} language - Language code (en/ko)
 * @param {Object} params - Parameters to replace in message
 * @returns {string} Localized message
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
 * @param {Object|null} guildSettings - Guild settings object
 * @returns {string} Language code
 */
export function getGuildLanguage(guildSettings) {
  return guildSettings?.language || 'en';
}

