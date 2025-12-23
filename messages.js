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
    githubPush: 'GitHub Push Event\n\n**Repository:** {repo}\n**Branch:** {branch}\n**Author:** {author}\n**Commits:** {commitsCount}\n\n**Commit History:**\n{commitMessages}\n\n[View]({compareUrl})',
    githubBranchCreated: 'New Branch Created\n\n**Repository:** {repo}\n**Branch:** {branch}\n**Created By:** {author}\n\n[View Branch]({url})',
    githubBranchDeleted: 'Branch Deleted\n\n**Repository:** {repo}\n**Branch:** {branch}\n**Deleted By:** {author}',
    githubTagCreated: 'New Tag Created\n\n**Repository:** {repo}\n**Tag:** {tag}\n**Created By:** {author}\n\n[View Tag]({url})',
    githubTagDeleted: 'Tag Deleted\n\n**Repository:** {repo}\n**Tag:** {tag}\n**Deleted By:** {author}',
    githubRevert: 'Revert Push Event\n\n**Repository:** {repo}\n**Branch:** {branch}\n**Author:** {author}\n**Commits:** {commitsCount}\n\n**Commit History:**\n{commitMessages}\n\n[View]({compareUrl})',
    githubPROpened: 'Pull Request Opened\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Author:** {author}\n**Base:** {baseRef} <- **Head:** {headRef}\n\n[View PR]({prUrl})',
    githubPRMerged: 'Pull Request Merged\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Author:** {author}\n**Merged By:** {merger}\n**Base:** {baseRef} <- **Head:** {headRef}\n\n[View PR]({prUrl})',
    githubPRClosed: 'Pull Request Closed\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Author:** {author}\n\n[View PR]({prUrl})',
    githubPRReopened: 'Pull Request Reopened\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Author:** {author}\n**Base:** {baseRef} <- **Head:** {headRef}\n\n[View PR]({prUrl})',
    githubPRUpdated: 'Pull Request Updated\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Author:** {author}\n**Base:** {baseRef} <- **Head:** {headRef}\n\nNew commits have been pushed.\n\n[View PR]({prUrl})',
    githubPRAssigned: 'Pull Request Assigned\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Assigned To:** {assignee}\n**Author:** {author}\n\n[View PR]({prUrl})',
    githubPRReviewRequested: 'Review Requested\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Review Requested From:** {reviewer}\n**Author:** {author}\n\n[View PR]({prUrl})',
    githubPRReadyForReview: 'Pull Request Ready for Review\n\n**Repository:** {repo}\n**PR #{number}:** {prTitle}\n**Author:** {author}\n**Base:** {baseRef} <- **Head:** {headRef}\n\n[View PR]({prUrl})',
    githubIssueOpened: 'Issue Opened\n\n**Repository:** {repo}\n**Issue #{number}:** {issueTitle}\n**Author:** {author}\n**Labels:** {labels}\n\n{issueBody}\n\n[View Issue]({issueUrl})',
    githubIssueClosed: 'Issue Closed\n\n**Repository:** {repo}\n**Issue #{number}:** {issueTitle}\n**Author:** {author}\n**Closed By:** {closer}\n\n[View Issue]({issueUrl})',
    githubIssueReopened: 'Issue Reopened\n\n**Repository:** {repo}\n**Issue #{number}:** {issueTitle}\n**Author:** {author}\n**Labels:** {labels}\n\n[View Issue]({issueUrl})',
    githubIssueAssigned: 'Issue Assigned\n\n**Repository:** {repo}\n**Issue #{number}:** {issueTitle}\n**Assigned To:** {assignee}\n**Author:** {author}\n\n[View Issue]({issueUrl})',
    githubIssueLabeled: 'Issue Labeled\n\n**Repository:** {repo}\n**Issue #{number}:** {issueTitle}\n**Label Added:** {label}\n**Author:** {author}\n\n[View Issue]({issueUrl})',
    githubIssueUnlabeled: 'Issue Unlabeled\n\n**Repository:** {repo}\n**Issue #{number}:** {issueTitle}\n**Label Removed:** {label}\n**Author:** {author}\n\n[View Issue]({issueUrl})',
    githubIssueComment: 'Comment on {type}\n\n**Repository:** {repo}\n**{typeLabel} #{number}:** {title}\n**Comment by:** {author}\n\n{comment}\n\n[View Comment]({commentUrl})',
    githubCommitComment: 'Commit Comment\n\n**Repository:** {repo}\n**Commit:** {commitId}\n**Comment by:** {author}\n\n{comment}\n\n[View Comment]({commentUrl})',
    githubReleasePublished: 'Release Published\n\n**Repository:** {repo}\n**Release:** {tagName} - {name}\n**Published by:** {author}\n\n{description}\n\n[View Release]({releaseUrl})',
    githubReleaseEdited: 'Release Edited\n\n**Repository:** {repo}\n**Release:** {tagName} - {name}\n**Edited by:** {author}\n\n[View Release]({releaseUrl})',
    githubReleaseDeleted: 'Release Deleted\n\n**Repository:** {repo}\n**Release:** {tagName}\n**Deleted by:** {author}',
    githubReleasePrereleased: 'Pre-release Published\n\n**Repository:** {repo}\n**Pre-release:** {tagName} - {name}\n**Published by:** {author}\n\n{description}\n\n[View Release]({releaseUrl})',
    githubReleaseReleased: 'Pre-release Released\n\n**Repository:** {repo}\n**Release:** {tagName} - {name}\n**Released by:** {author}\n\n[View Release]({releaseUrl})',
    githubFork: 'Repository Forked\n\n**Repository:** {repo}\n**Forked by:** {author}\n**Fork URL:** {forkUrl}',
    githubWatch: 'Repository Starred\n\n**Repository:** {repo}\n**Starred by:** {author}',
    githubStarCreated: 'Repository Starred\n\n**Repository:** {repo}\n**Starred by:** {author}\n**Total Stars:** {stars}',
    githubStarDeleted: 'Repository Unstarred\n\n**Repository:** {repo}\n**Unstarred by:** {author}\n**Total Stars:** {stars}',
    githubDeployment: 'Deployment Created\n\n**Repository:** {repo}\n**Environment:** {environment}\n**Ref:** {ref}\n**Created by:** {author}\n\n{description}\n\n[View Deployment]({deploymentUrl})',
    githubDeploymentStatusSuccess: 'Deployment Succeeded\n\n**Repository:** {repo}\n**Environment:** {environment}\n**Ref:** {ref}\n**State:** {state}\n\n[View Deployment]({deploymentUrl})',
    githubDeploymentStatusFailure: 'Deployment Failed\n\n**Repository:** {repo}\n**Environment:** {environment}\n**Ref:** {ref}\n**State:** {state}\n\n[View Deployment]({deploymentUrl})',
    githubDeploymentStatusPending: 'Deployment In Progress\n\n**Repository:** {repo}\n**Environment:** {environment}\n**Ref:** {ref}\n**State:** {state}\n\n[View Deployment]({deploymentUrl})',
    githubGollum: 'Wiki Updated\n\n**Repository:** {repo}\n**Pages:** {pages}\n**Updated by:** {author}',
    githubMemberAdded: 'Collaborator Added\n\n**Repository:** {repo}\n**Added:** {member}\n**Added by:** {author}',
    githubMemberRemoved: 'Collaborator Removed\n\n**Repository:** {repo}\n**Removed:** {member}\n**Removed by:** {author}',
    githubPublic: 'Repository Made Public\n\n**Repository:** {repo}',
    githubRepositoryCreated: 'Repository Created\n\n**Repository:** {repo}\n**Created by:** {author}',
    githubRepositoryDeleted: 'Repository Deleted\n\n**Repository:** {repo}\n**Deleted by:** {author}',
    githubRepositoryArchived: 'Repository Archived\n\n**Repository:** {repo}\n**Archived by:** {author}',
    githubRepositoryUnarchived: 'Repository Unarchived\n\n**Repository:** {repo}\n**Unarchived by:** {author}',
    
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
    githubPush: 'GitHub Push 이벤트\n\n**저장소:** {repo}\n**브랜치:** {branch}\n**작성자:** {author}\n**커밋 수:** {commitsCount}\n\n**커밋 내역:**\n{commitMessages}\n\n[보기]({compareUrl})',
    githubBranchCreated: '새 브랜치 생성\n\n**저장소:** {repo}\n**브랜치:** {branch}\n**생성자:** {author}\n\n[브랜치 보기]({url})',
    githubBranchDeleted: '브랜치 삭제\n\n**저장소:** {repo}\n**브랜치:** {branch}\n**삭제자:** {author}',
    githubTagCreated: '새 태그 생성\n\n**저장소:** {repo}\n**태그:** {tag}\n**생성자:** {author}\n\n[태그 보기]({url})',
    githubTagDeleted: '태그 삭제\n\n**저장소:** {repo}\n**태그:** {tag}\n**삭제자:** {author}',
    githubRevert: 'Revert Push 이벤트\n\n**저장소:** {repo}\n**브랜치:** {branch}\n**작성자:** {author}\n**커밋 수:** {commitsCount}\n\n**커밋 내역:**\n{commitMessages}\n\n[보기]({compareUrl})',
    githubPROpened: 'Pull Request 열림\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**작성자:** {author}\n**베이스:** {baseRef} <- **헤드:** {headRef}\n\n[PR 보기]({prUrl})',
    githubPRMerged: 'Pull Request 머지됨\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**작성자:** {author}\n**머지한 사람:** {merger}\n**베이스:** {baseRef} <- **헤드:** {headRef}\n\n[PR 보기]({prUrl})',
    githubPRClosed: 'Pull Request 닫힘\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**작성자:** {author}\n\n[PR 보기]({prUrl})',
    githubPRReopened: 'Pull Request 다시 열림\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**작성자:** {author}\n**베이스:** {baseRef} <- **헤드:** {headRef}\n\n[PR 보기]({prUrl})',
    githubPRUpdated: 'Pull Request 업데이트됨\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**작성자:** {author}\n**베이스:** {baseRef} <- **헤드:** {headRef}\n\n새 커밋이 푸시되었습니다.\n\n[PR 보기]({prUrl})',
    githubPRAssigned: 'Pull Request 담당자 할당됨\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**담당자:** {assignee}\n**작성자:** {author}\n\n[PR 보기]({prUrl})',
    githubPRReviewRequested: '리뷰 요청됨\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**리뷰어:** {reviewer}\n**작성자:** {author}\n\n[PR 보기]({prUrl})',
    githubPRReadyForReview: 'Pull Request 리뷰 준비됨\n\n**저장소:** {repo}\n**PR #{number}:** {prTitle}\n**작성자:** {author}\n**베이스:** {baseRef} <- **헤드:** {headRef}\n\n[PR 보기]({prUrl})',
    githubIssueOpened: 'Issue 열림\n\n**저장소:** {repo}\n**Issue #{number}:** {issueTitle}\n**작성자:** {author}\n**라벨:** {labels}{issueBody}\n\n[이슈 보기]({issueUrl})',
    githubIssueClosed: 'Issue 닫힘\n\n**저장소:** {repo}\n**Issue #{number}:** {issueTitle}\n**작성자:** {author}\n**닫은 사람:** {closer}\n\n[이슈 보기]({issueUrl})',
    githubIssueReopened: 'Issue 다시 열림\n\n**저장소:** {repo}\n**Issue #{number}:** {issueTitle}\n**작성자:** {author}\n**라벨:** {labels}\n\n[이슈 보기]({issueUrl})',
    githubIssueAssigned: 'Issue 담당자 할당됨\n\n**저장소:** {repo}\n**Issue #{number}:** {issueTitle}\n**담당자:** {assignee}\n**작성자:** {author}\n\n[이슈 보기]({issueUrl})',
    githubIssueLabeled: 'Issue 라벨 추가됨\n\n**저장소:** {repo}\n**Issue #{number}:** {issueTitle}\n**추가된 라벨:** {label}\n**작성자:** {author}\n\n[이슈 보기]({issueUrl})',
    githubIssueUnlabeled: 'Issue 라벨 제거됨\n\n**저장소:** {repo}\n**Issue #{number}:** {issueTitle}\n**제거된 라벨:** {label}\n**작성자:** {author}\n\n[이슈 보기]({issueUrl})',
    githubIssueComment: '{type}에 댓글 추가됨\n\n**저장소:** {repo}\n**{typeLabel} #{number}:** {title}\n**댓글 작성자:** {author}\n\n{comment}\n\n[댓글 보기]({commentUrl})',
    githubCommitComment: '커밋 댓글 추가됨\n\n**저장소:** {repo}\n**커밋:** {commitId}\n**댓글 작성자:** {author}\n\n{comment}\n\n[댓글 보기]({commentUrl})',
    githubReleasePublished: '릴리즈 출시됨\n\n**저장소:** {repo}\n**릴리즈:** {tagName} - {name}\n**출시자:** {author}\n\n{description}\n\n[릴리즈 보기]({releaseUrl})',
    githubReleaseEdited: '릴리즈 수정됨\n\n**저장소:** {repo}\n**릴리즈:** {tagName} - {name}\n**수정자:** {author}\n\n[릴리즈 보기]({releaseUrl})',
    githubReleaseDeleted: '릴리즈 삭제됨\n\n**저장소:** {repo}\n**릴리즈:** {tagName}\n**삭제자:** {author}',
    githubReleasePrereleased: '프리릴리즈 출시됨\n\n**저장소:** {repo}\n**프리릴리즈:** {tagName} - {name}\n**출시자:** {author}\n\n{description}\n\n[릴리즈 보기]({releaseUrl})',
    githubReleaseReleased: '프리릴리즈 정식 출시됨\n\n**저장소:** {repo}\n**릴리즈:** {tagName} - {name}\n**출시자:** {author}\n\n[릴리즈 보기]({releaseUrl})',
    githubFork: '저장소 포크됨\n\n**저장소:** {repo}\n**포크한 사용자:** {author}\n**포크 URL:** {forkUrl}',
    githubWatch: '저장소 워치됨\n\n**저장소:** {repo}\n**워치한 사용자:** {author}',
    githubStarCreated: '저장소 스타됨\n\n**저장소:** {repo}\n**스타한 사용자:** {author}\n**총 스타 수:** {stars}',
    githubStarDeleted: '저장소 언스타됨\n\n**저장소:** {repo}\n**언스타한 사용자:** {author}\n**총 스타 수:** {stars}',
    githubDeployment: '배포 생성됨\n\n**저장소:** {repo}\n**환경:** {environment}\n**브랜치:** {ref}\n**생성자:** {author}\n\n{description}\n\n[배포 보기]({deploymentUrl})',
    githubDeploymentStatusSuccess: '배포 성공\n\n**저장소:** {repo}\n**환경:** {environment}\n**브랜치:** {ref}\n**상태:** {state}\n\n[배포 보기]({deploymentUrl})',
    githubDeploymentStatusFailure: '배포 실패\n\n**저장소:** {repo}\n**환경:** {environment}\n**브랜치:** {ref}\n**상태:** {state}\n\n[배포 보기]({deploymentUrl})',
    githubDeploymentStatusPending: '배포 진행 중\n\n**저장소:** {repo}\n**환경:** {environment}\n**브랜치:** {ref}\n**상태:** {state}\n\n[배포 보기]({deploymentUrl})',
    githubGollum: '위키 업데이트됨\n\n**저장소:** {repo}\n**페이지:** {pages}\n**업데이트한 사용자:** {author}',
    githubMemberAdded: '협력자 추가됨\n\n**저장소:** {repo}\n**추가된 사용자:** {member}\n**추가한 사용자:** {author}',
    githubMemberRemoved: '협력자 제거됨\n\n**저장소:** {repo}\n**제거된 사용자:** {member}\n**제거한 사용자:** {author}',
    githubPublic: '저장소 공개됨\n\n**저장소:** {repo}',
    githubRepositoryCreated: '저장소 생성됨\n\n**저장소:** {repo}\n**생성자:** {author}',
    githubRepositoryDeleted: '저장소 삭제됨\n\n**저장소:** {repo}\n**삭제자:** {author}',
    githubRepositoryArchived: '저장소 보관됨\n\n**저장소:** {repo}\n**보관한 사용자:** {author}',
    githubRepositoryUnarchived: '저장소 보관 해제됨\n\n**저장소:** {repo}\n**보관 해제한 사용자:** {author}',
    
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

