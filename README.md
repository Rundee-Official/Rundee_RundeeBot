# Rundee Bot

Discord bot for meeting reminders and GitHub integration

---

## 한국어 (Korean)

### 소개

Rundee Bot은 Discord 서버에서 회의 일정 관리와 GitHub 활동 알림을 제공하는 봇입니다.

### 주요 기능

#### 회의 일정 관리
- **단일 회의 등록**: 일회성 회의 일정을 등록하고 알림을 받을 수 있습니다
- **반복 회의 등록**: 매일, 매주, 격주, 매월 등 반복되는 회의를 등록할 수 있습니다
- **회의 목록 조회**: 등록된 모든 회의 일정을 확인할 수 있습니다
- **회의 수정/삭제**: 등록된 회의 일정을 수정하거나 삭제할 수 있습니다
- **자동 알림**: 설정한 시간에 자동으로 회의 알림을 전송합니다
- **언어 설정**: 한국어 또는 영어로 봇 메시지를 설정할 수 있습니다
- **타임존 설정**: 서버의 타임존을 설정하여 시간을 정확하게 관리할 수 있습니다

#### GitHub 통합
- **웹훅 연동**: GitHub 저장소와 연동하여 활동을 실시간으로 모니터링합니다
- **다양한 이벤트 지원**: 
  - Push, Pull Request, Issue 이벤트
  - 브랜치/태그 생성/삭제
  - 커밋 댓글, 이슈 댓글
  - 릴리즈, 포크, 스타
  - 배포, 위키 업데이트
  - 협력자 추가/제거 등
- **세분화된 알림**: 각 이벤트 타입에 맞는 상세한 알림 메시지를 제공합니다

### 사용 방법

#### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```
PUBLIC_KEY=your_discord_public_key
APPLICATION_ID=your_discord_application_id
BOT_TOKEN=your_discord_bot_token
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
PORT=8080
```

#### 2. 의존성 설치

```bash
npm install
```

#### 3. 명령어 등록

Discord 슬래시 명령어를 등록합니다:

```bash
npm run register
```

#### 4. 봇 실행

```bash
npm start
```

개발 모드 (자동 재시작):

```bash
npm run dev
```

### 명령어

#### 회의 관리 (`/meeting`)

- `/meeting list` - 등록된 회의 목록 조회
- `/meeting create` - 단일 회의 등록
  - `title`: 회의 제목
  - `date`: 날짜 및 시간 (YYYY-MM-DD HH:mm)
  - `participants`: 참석자 (@멘션 또는 @역할)
  - `reminder_minutes`: 알림 시간 (분 전, 쉼표로 구분)
- `/meeting create-recurring` - 반복 회의 등록
  - `title`: 회의 제목
  - `time`: 시간 (HH:mm)
  - `participants`: 참석자
  - `repeat_type`: 반복 타입 (Daily, Weekly, Bi-weekly, Monthly)
  - `weekday`: 요일 (0=일요일, 1=월요일, ..., 6=토요일)
  - `exclude_weekdays`: 제외할 요일 (쉼표로 구분)
  - `reminder_minutes`: 알림 시간
  - `repeat_end_date`: 반복 종료 날짜 (선택)
- `/meeting edit` - 회의 수정
- `/meeting delete` - 회의 삭제
- `/meeting channel` - 회의 알림 채널 설정

#### 설정 (`/config`)

- `/config language` - 언어 설정 (한국어/영어)
- `/config timezone` - 타임존 설정

#### GitHub (`/setup-github`)

- `/setup-github channel` - GitHub 알림 채널 설정
- `/setup-github repository` - GitHub 저장소 URL 등록

### 기술 스택

- **Node.js** 18.x 이상
- **Express** - 웹 서버
- **better-sqlite3** - 데이터베이스
- **node-cron** - 스케줄링
- **discord-interactions** - Discord API

### 라이선스

Copyright (c) 2025 Rundee. All Rights Reserved.

이 소프트웨어는 Rundee의 독점 소프트웨어입니다. 무단 복사, 수정, 배포는 금지됩니다.

---

## English

### Introduction

Rundee Bot is a Discord bot that provides meeting schedule management and GitHub activity notifications for Discord servers.

### Key Features

#### Meeting Schedule Management
- **Single Meeting Registration**: Register one-time meetings and receive notifications
- **Recurring Meeting Registration**: Register recurring meetings (daily, weekly, bi-weekly, monthly, etc.)
- **Meeting List**: View all registered meeting schedules
- **Meeting Edit/Delete**: Modify or delete registered meetings
- **Automatic Notifications**: Automatically send meeting reminders at scheduled times
- **Language Settings**: Configure bot messages in Korean or English
- **Timezone Settings**: Set server timezone for accurate time management

#### GitHub Integration
- **Webhook Integration**: Connect with GitHub repositories to monitor activities in real-time
- **Multiple Event Support**:
  - Push, Pull Request, Issue events
  - Branch/Tag creation/deletion
  - Commit comments, Issue comments
  - Releases, Forks, Stars
  - Deployments, Wiki updates
  - Collaborator addition/removal, etc.
- **Detailed Notifications**: Provide detailed notification messages for each event type

### Usage

#### 1. Environment Variables

Create a `.env` file and set the following variables:

```
PUBLIC_KEY=your_discord_public_key
APPLICATION_ID=your_discord_application_id
BOT_TOKEN=your_discord_bot_token
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
PORT=8080
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Register Commands

Register Discord slash commands:

```bash
npm run register
```

#### 4. Run Bot

```bash
npm start
```

Development mode (auto-restart):

```bash
npm run dev
```

### Commands

#### Meeting Management (`/meeting`)

- `/meeting list` - View registered meetings
- `/meeting create` - Register a single meeting
  - `title`: Meeting title
  - `date`: Date and time (YYYY-MM-DD HH:mm)
  - `participants`: Participants (@mentions or @role mentions)
  - `reminder_minutes`: Reminder time (minutes before, comma-separated)
- `/meeting create-recurring` - Register a recurring meeting
  - `title`: Meeting title
  - `time`: Time (HH:mm)
  - `participants`: Participants
  - `repeat_type`: Repeat type (Daily, Weekly, Bi-weekly, Monthly)
  - `weekday`: Weekday (0=Sunday, 1=Monday, ..., 6=Saturday)
  - `exclude_weekdays`: Excluded weekdays (comma-separated)
  - `reminder_minutes`: Reminder time
  - `repeat_end_date`: Repeat end date (optional)
- `/meeting edit` - Edit meeting
- `/meeting delete` - Delete meeting
- `/meeting channel` - Set meeting notification channel

#### Configuration (`/config`)

- `/config language` - Set language (Korean/English)
- `/config timezone` - Set timezone

#### GitHub (`/setup-github`)

- `/setup-github channel` - Set GitHub notification channel
- `/setup-github repository` - Register GitHub repository URL

### Tech Stack

- **Node.js** 18.x or higher
- **Express** - Web server
- **better-sqlite3** - Database
- **node-cron** - Scheduling
- **discord-interactions** - Discord API

### License

Copyright (c) 2025 Rundee. All Rights Reserved.

This software is proprietary software of Rundee. Unauthorized copying, modification, or distribution is prohibited.

---

## Support

For issues and questions, please contact Rundee.

