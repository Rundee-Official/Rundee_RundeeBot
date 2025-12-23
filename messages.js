/**
 * @file messages.js
 * @brief Localized messages for Rundee Bot (Korean and English)
 * @author Rundee
 * @date 2025-12-23
 * @copyright Copyright (c) 2025 Rundee. All rights reserved.
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
    
    // Timezone
    timezoneSet: 'Timezone set to {timezone}',
    
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
    meetingStart: 'Meeting Starting Now\n\n{mentions}\n\n**{title}**\n**Date:** {date}\n\nThe meeting is starting now!',
    
    // GitHub notifications
    githubPush: 'GitHub Push Event\n```\nRepository: {repo}\nBranch: {branch}\nAuthor: {author}\nCommits: {commitsCount}\n\nCommit History:\n{commitMessages}\n```[View]({compareUrl})',
    githubBranchCreated: 'New Branch Created\n```\nRepository: {repo}\nBranch: {branch}\nCreated By: {author}\n```[View Branch]({url})',
    githubBranchDeleted: 'Branch Deleted\n```\nRepository: {repo}\nBranch: {branch}\nDeleted By: {author}\n```',
    githubTagCreated: 'New Tag Created\n```\nRepository: {repo}\nTag: {tag}\nCreated By: {author}\n```[View Tag]({url})',
    githubTagDeleted: 'Tag Deleted\n```\nRepository: {repo}\nTag: {tag}\nDeleted By: {author}\n```',
    githubRevert: 'Revert Push Event\n```\nRepository: {repo}\nBranch: {branch}\nAuthor: {author}\nCommits: {commitsCount}\n\nCommit History:\n{commitMessages}\n```[View]({compareUrl})',
    githubMerge: 'Branch Merged\n```\nRepository: {repo}\nTarget Branch: {targetBranch}\nSource Branch: {sourceBranch}\nMerged by: {author}\nCommit: {commitId}\n```[View Commit]({commitUrl})',
    githubPROpened: 'Pull Request Opened\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAuthor: {author}\nBase: {baseRef} <- Head: {headRef}\n```[View PR]({prUrl})',
    githubPRMerged: 'Pull Request Merged\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAuthor: {author}\nMerged By: {merger}\nBase: {baseRef} <- Head: {headRef}\n```[View PR]({prUrl})',
    githubPRClosed: 'Pull Request Closed\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAuthor: {author}\n```[View PR]({prUrl})',
    githubPRReopened: 'Pull Request Reopened\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAuthor: {author}\nBase: {baseRef} <- Head: {headRef}\n```[View PR]({prUrl})',
    githubPRUpdated: 'Pull Request Updated\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAuthor: {author}\nBase: {baseRef} <- Head: {headRef}\n\nNew commits have been pushed.\n```[View PR]({prUrl})',
    githubPRAssigned: 'Pull Request Assigned\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAssigned To: {assignee}\nAuthor: {author}\n```[View PR]({prUrl})',
    githubPRReviewRequested: 'Review Requested\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nReview Requested From: {reviewer}\nAuthor: {author}\n```[View PR]({prUrl})',
    githubPRReadyForReview: 'Pull Request Ready for Review\n```\nRepository: {repo}\nPR #{number}: {prTitle}\nAuthor: {author}\nBase: {baseRef} <- Head: {headRef}\n```[View PR]({prUrl})',
    githubIssueOpened: 'Issue Opened\n```\nRepository: {repo}\nIssue #{number}: {issueTitle}\nAuthor: {author}\nLabels: {labels}{issueBody}\n```[View Issue]({issueUrl})',
    githubIssueClosed: 'Issue Closed\n```\nRepository: {repo}\nIssue #{number}: {issueTitle}\nAuthor: {author}\nClosed By: {closer}\n```[View Issue]({issueUrl})',
    githubIssueReopened: 'Issue Reopened\n```\nRepository: {repo}\nIssue #{number}: {issueTitle}\nAuthor: {author}\nLabels: {labels}\n```[View Issue]({issueUrl})',
    githubIssueAssigned: 'Issue Assigned\n```\nRepository: {repo}\nIssue #{number}: {issueTitle}\nAssigned To: {assignee}\nAuthor: {author}\n```[View Issue]({issueUrl})',
    githubIssueLabeled: 'Issue Labeled\n```\nRepository: {repo}\nIssue #{number}: {issueTitle}\nLabel Added: {label}\nAuthor: {author}\n```[View Issue]({issueUrl})',
    githubIssueUnlabeled: 'Issue Unlabeled\n```\nRepository: {repo}\nIssue #{number}: {issueTitle}\nLabel Removed: {label}\nAuthor: {author}\n```[View Issue]({issueUrl})',
    githubIssueComment: 'Comment on {type}\n```\nRepository: {repo}\n{typeLabel} #{number}: {title}\nComment by: {author}\n\n{comment}\n```[View Comment]({commentUrl})',
    githubCommitComment: 'Commit Comment\n```\nRepository: {repo}\nCommit: {commitId}\nComment by: {author}\n\n{comment}\n```[View Comment]({commentUrl})',
    githubReleasePublished: 'Release Published\n```\nRepository: {repo}\nRelease: {tagName} - {name}\nPublished by: {author}\n\n{description}\n```[View Release]({releaseUrl})',
    githubReleaseEdited: 'Release Edited\n```\nRepository: {repo}\nRelease: {tagName} - {name}\nEdited by: {author}\n```[View Release]({releaseUrl})',
    githubReleaseDeleted: 'Release Deleted\n```\nRepository: {repo}\nRelease: {tagName}\nDeleted by: {author}\n```',
    githubReleasePrereleased: 'Pre-release Published\n```\nRepository: {repo}\nPre-release: {tagName} - {name}\nPublished by: {author}\n\n{description}\n```[View Release]({releaseUrl})',
    githubReleaseReleased: 'Pre-release Released\n```\nRepository: {repo}\nRelease: {tagName} - {name}\nReleased by: {author}\n```[View Release]({releaseUrl})',
    githubFork: 'Repository Forked\n```\nRepository: {repo}\nForked by: {author}\nFork URL: {forkUrl}\n```',
    githubWatch: 'Repository Starred\n```\nRepository: {repo}\nStarred by: {author}\n```',
    githubStarCreated: 'Repository Starred\n```\nRepository: {repo}\nStarred by: {author}\nTotal Stars: {stars}\n```',
    githubStarDeleted: 'Repository Unstarred\n```\nRepository: {repo}\nUnstarred by: {author}\nTotal Stars: {stars}\n```',
    githubDeployment: 'Deployment Created\n```\nRepository: {repo}\nEnvironment: {environment}\nRef: {ref}\nCreated by: {author}\n\n{description}\n```[View Deployment]({deploymentUrl})',
    githubDeploymentStatusSuccess: 'Deployment Succeeded\n```\nRepository: {repo}\nEnvironment: {environment}\nRef: {ref}\nState: {state}\n```[View Deployment]({deploymentUrl})',
    githubDeploymentStatusFailure: 'Deployment Failed\n```\nRepository: {repo}\nEnvironment: {environment}\nRef: {ref}\nState: {state}\n```[View Deployment]({deploymentUrl})',
    githubDeploymentStatusPending: 'Deployment In Progress\n```\nRepository: {repo}\nEnvironment: {environment}\nRef: {ref}\nState: {state}\n```[View Deployment]({deploymentUrl})',
    githubGollum: 'Wiki Updated\n```\nRepository: {repo}\nPages: {pages}\nUpdated by: {author}\n```',
    githubMemberAdded: 'Collaborator Added\n```\nRepository: {repo}\nAdded: {member}\nAdded by: {author}\n```',
    githubMemberRemoved: 'Collaborator Removed\n```\nRepository: {repo}\nRemoved: {member}\nRemoved by: {author}\n```',
    githubPublic: 'Repository Made Public\n```\nRepository: {repo}\n```',
    githubRepositoryCreated: 'Repository Created\n```\nRepository: {repo}\nCreated by: {author}\n```',
    githubRepositoryDeleted: 'Repository Deleted\n```\nRepository: {repo}\nDeleted by: {author}\n```',
    githubRepositoryArchived: 'Repository Archived\n```\nRepository: {repo}\nArchived by: {author}\n```',
    githubRepositoryUnarchived: 'Repository Unarchived\n```\nRepository: {repo}\nUnarchived by: {author}\n```',
    
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
    
    // Timezone
    timezoneSet: '시간대가 {timezone}로 설정되었습니다.',
    
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
    meetingStart: '회의 시작\n\n{mentions}\n\n**{title}**\n**일시:** {date}\n\n지금 회의가 시작됩니다!',
    
    // GitHub notifications
    githubPush: 'GitHub Push 이벤트\n```\n저장소: {repo}\n브랜치: {branch}\n작성자: {author}\n커밋 수: {commitsCount}\n\n커밋 내역:\n{commitMessages}\n```[보기]({compareUrl})',
    githubBranchCreated: '새 브랜치 생성\n```\n저장소: {repo}\n브랜치: {branch}\n생성자: {author}\n```[브랜치 보기]({url})',
    githubBranchDeleted: '브랜치 삭제\n```\n저장소: {repo}\n브랜치: {branch}\n삭제자: {author}\n```',
    githubTagCreated: '새 태그 생성\n```\n저장소: {repo}\n태그: {tag}\n생성자: {author}\n```[태그 보기]({url})',
    githubTagDeleted: '태그 삭제\n```\n저장소: {repo}\n태그: {tag}\n삭제자: {author}\n```',
    githubRevert: 'Revert Push 이벤트\n```\n저장소: {repo}\n브랜치: {branch}\n작성자: {author}\n커밋 수: {commitsCount}\n\n커밋 내역:\n{commitMessages}\n```[보기]({compareUrl})',
    githubMerge: '브랜치 머지됨\n```\n저장소: {repo}\n대상 브랜치: {targetBranch}\n소스 브랜치: {sourceBranch}\n머지한 사람: {author}\n커밋: {commitId}\n```[커밋 보기]({commitUrl})',
    githubPROpened: 'Pull Request 열림\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n작성자: {author}\n베이스: {baseRef} <- 헤드: {headRef}\n```[PR 보기]({prUrl})',
    githubPRMerged: 'Pull Request 머지됨\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n작성자: {author}\n머지한 사람: {merger}\n베이스: {baseRef} <- 헤드: {headRef}\n```[PR 보기]({prUrl})',
    githubPRClosed: 'Pull Request 닫힘\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n작성자: {author}\n```[PR 보기]({prUrl})',
    githubPRReopened: 'Pull Request 다시 열림\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n작성자: {author}\n베이스: {baseRef} <- 헤드: {headRef}\n```[PR 보기]({prUrl})',
    githubPRUpdated: 'Pull Request 업데이트됨\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n작성자: {author}\n베이스: {baseRef} <- 헤드: {headRef}\n\n새 커밋이 푸시되었습니다.\n```[PR 보기]({prUrl})',
    githubPRAssigned: 'Pull Request 담당자 할당됨\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n담당자: {assignee}\n작성자: {author}\n```[PR 보기]({prUrl})',
    githubPRReviewRequested: '리뷰 요청됨\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n리뷰어: {reviewer}\n작성자: {author}\n```[PR 보기]({prUrl})',
    githubPRReadyForReview: 'Pull Request 리뷰 준비됨\n```\n저장소: {repo}\nPR #{number}: {prTitle}\n작성자: {author}\n베이스: {baseRef} <- 헤드: {headRef}\n```[PR 보기]({prUrl})',
    githubIssueOpened: 'Issue 열림\n```\n저장소: {repo}\nIssue #{number}: {issueTitle}\n작성자: {author}\n라벨: {labels}{issueBody}\n```[이슈 보기]({issueUrl})',
    githubIssueClosed: 'Issue 닫힘\n```\n저장소: {repo}\nIssue #{number}: {issueTitle}\n작성자: {author}\n닫은 사람: {closer}\n```[이슈 보기]({issueUrl})',
    githubIssueReopened: 'Issue 다시 열림\n```\n저장소: {repo}\nIssue #{number}: {issueTitle}\n작성자: {author}\n라벨: {labels}\n```[이슈 보기]({issueUrl})',
    githubIssueAssigned: 'Issue 담당자 할당됨\n```\n저장소: {repo}\nIssue #{number}: {issueTitle}\n담당자: {assignee}\n작성자: {author}\n```[이슈 보기]({issueUrl})',
    githubIssueLabeled: 'Issue 라벨 추가됨\n```\n저장소: {repo}\nIssue #{number}: {issueTitle}\n추가된 라벨: {label}\n작성자: {author}\n```[이슈 보기]({issueUrl})',
    githubIssueUnlabeled: 'Issue 라벨 제거됨\n```\n저장소: {repo}\nIssue #{number}: {issueTitle}\n제거된 라벨: {label}\n작성자: {author}\n```[이슈 보기]({issueUrl})',
    githubIssueComment: '{type}에 댓글 추가됨\n```\n저장소: {repo}\n{typeLabel} #{number}: {title}\n댓글 작성자: {author}\n\n{comment}\n```[댓글 보기]({commentUrl})',
    githubCommitComment: '커밋 댓글 추가됨\n```\n저장소: {repo}\n커밋: {commitId}\n댓글 작성자: {author}\n\n{comment}\n```[댓글 보기]({commentUrl})',
    githubReleasePublished: '릴리즈 출시됨\n```\n저장소: {repo}\n릴리즈: {tagName} - {name}\n출시자: {author}\n\n{description}\n```[릴리즈 보기]({releaseUrl})',
    githubReleaseEdited: '릴리즈 수정됨\n```\n저장소: {repo}\n릴리즈: {tagName} - {name}\n수정자: {author}\n```[릴리즈 보기]({releaseUrl})',
    githubReleaseDeleted: '릴리즈 삭제됨\n```\n저장소: {repo}\n릴리즈: {tagName}\n삭제자: {author}\n```',
    githubReleasePrereleased: '프리릴리즈 출시됨\n```\n저장소: {repo}\n프리릴리즈: {tagName} - {name}\n출시자: {author}\n\n{description}\n```[릴리즈 보기]({releaseUrl})',
    githubReleaseReleased: '프리릴리즈 정식 출시됨\n```\n저장소: {repo}\n릴리즈: {tagName} - {name}\n출시자: {author}\n```[릴리즈 보기]({releaseUrl})',
    githubFork: '저장소 포크됨\n```\n저장소: {repo}\n포크한 사용자: {author}\n포크 URL: {forkUrl}\n```',
    githubWatch: '저장소 워치됨\n```\n저장소: {repo}\n워치한 사용자: {author}\n```',
    githubStarCreated: '저장소 스타됨\n```\n저장소: {repo}\n스타한 사용자: {author}\n총 스타 수: {stars}\n```',
    githubStarDeleted: '저장소 언스타됨\n```\n저장소: {repo}\n언스타한 사용자: {author}\n총 스타 수: {stars}\n```',
    githubDeployment: '배포 생성됨\n```\n저장소: {repo}\n환경: {environment}\n브랜치: {ref}\n생성자: {author}\n\n{description}\n```[배포 보기]({deploymentUrl})',
    githubDeploymentStatusSuccess: '배포 성공\n```\n저장소: {repo}\n환경: {environment}\n브랜치: {ref}\n상태: {state}\n```[배포 보기]({deploymentUrl})',
    githubDeploymentStatusFailure: '배포 실패\n```\n저장소: {repo}\n환경: {environment}\n브랜치: {ref}\n상태: {state}\n```[배포 보기]({deploymentUrl})',
    githubDeploymentStatusPending: '배포 진행 중\n```\n저장소: {repo}\n환경: {environment}\n브랜치: {ref}\n상태: {state}\n```[배포 보기]({deploymentUrl})',
    githubGollum: '위키 업데이트됨\n```\n저장소: {repo}\n페이지: {pages}\n업데이트한 사용자: {author}\n```',
    githubMemberAdded: '협력자 추가됨\n```\n저장소: {repo}\n추가된 사용자: {member}\n추가한 사용자: {author}\n```',
    githubMemberRemoved: '협력자 제거됨\n```\n저장소: {repo}\n제거된 사용자: {member}\n제거한 사용자: {author}\n```',
    githubPublic: '저장소 공개됨\n```\n저장소: {repo}\n```',
    githubRepositoryCreated: '저장소 생성됨\n```\n저장소: {repo}\n생성자: {author}\n```',
    githubRepositoryDeleted: '저장소 삭제됨\n```\n저장소: {repo}\n삭제자: {author}\n```',
    githubRepositoryArchived: '저장소 보관됨\n```\n저장소: {repo}\n보관한 사용자: {author}\n```',
    githubRepositoryUnarchived: '저장소 보관 해제됨\n```\n저장소: {repo}\n보관 해제한 사용자: {author}\n```',
    
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

