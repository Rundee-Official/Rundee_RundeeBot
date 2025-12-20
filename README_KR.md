# Rundee Bot

Discord 봇으로 회의 일정 알림과 GitHub 연동 알림 기능을 제공합니다.

## 주요 기능

### 📅 회의 일정 알림
- 회의 일정을 등록하고 지정된 시간 전에 참석자들에게 자동으로 멘션 알림을 보냅니다
- 등록된 회의 목록을 확인하고 삭제할 수 있습니다

### 🔔 GitHub 연동
- GitHub 저장소에서 push, commit, merge 이벤트 발생 시 Discord 채널에 알림을 보냅니다
- GitHub 웹훅을 통해 실시간으로 개발 활동을 모니터링할 수 있습니다

## 시작하기

### 1단계: 필수 요구사항 확인

다음이 준비되어 있어야 합니다:
- **Node.js 18.x 이상** 설치되어 있어야 합니다
- **Discord 개발자 계정** 및 봇 토큰
- **GitHub 저장소** (웹훅 기능 사용 시)
- **공개 접근 가능한 서버** 또는 ngrok 같은 터널링 도구 (로컬 개발 시)

### 2단계: 프로젝트 설치

#### 2-1. 저장소 클론 및 디렉토리 이동
```bash
git clone <repository-url>
cd discord-example-app
```

#### 2-2. 의존성 패키지 설치
```bash
npm install
```

이 명령어를 실행하면 `package.json`에 정의된 모든 의존성이 설치됩니다:
- discord-interactions: Discord API 상호작용 처리
- express: 웹 서버
- node-cron: 스케줄링 (회의 알림용)
- dotenv: 환경 변수 관리

### 3단계: Discord 봇 설정

#### 3-1. Discord Developer Portal에서 애플리케이션 생성

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속합니다
2. 우측 상단의 **"New Application"** 버튼을 클릭합니다
3. 애플리케이션 이름을 입력합니다 (예: "Rundee Bot")
4. **"Create"** 버튼을 클릭합니다

#### 3-2. 봇 생성

1. 좌측 메뉴에서 **"Bot"** 탭을 클릭합니다
2. **"Add Bot"** 버튼을 클릭하고 확인합니다
3. **"Token"** 섹션에서 **"Reset Token"** 또는 **"Copy"** 버튼을 클릭하여 토큰을 복사합니다
   - ⚠️ **주의**: 이 토큰은 절대 공개하지 마세요! 나중에 `.env` 파일에 사용합니다
4. 아래쪽의 **"Privileged Gateway Intents"** 섹션에서 필요에 따라 인텐트를 활성화합니다
   - 메시지 내용을 읽을 필요가 없다면 기본 설정으로 충분합니다

#### 3-3. 필요한 정보 복사

Discord Developer Portal에서 다음 정보들을 복사해 둡니다:

1. **APP ID (Application ID)**
   - **"General Information"** 탭에서 확인 가능
   - "Application ID" 아래에 있는 숫자 복사

2. **PUBLIC KEY**
   - **"General Information"** 탭에서 확인 가능
   - "Public Key" 아래에 있는 문자열 복사

3. **BOT TOKEN**
   - **"Bot"** 탭에서 이전에 복사한 토큰

#### 3-4. 봇 권한 설정 및 서버 초대

1. 좌측 메뉴에서 **"OAuth2"** > **"URL Generator"** 탭으로 이동합니다
2. **"Scopes"** 섹션에서 다음을 체크합니다:
   - ✅ `bot`
   - ✅ `applications.commands`
3. **"Bot Permissions"** 섹션에서 다음 권한을 체크합니다:
   - ✅ `Send Messages`
   - ✅ `Use Slash Commands`
   - ✅ `Mention Everyone` (선택사항, 회의 알림에 모든 멤버 멘션이 필요할 때만)
4. 하단에 생성된 **"Generated URL"**을 복사합니다
5. 브라우저에서 이 URL을 열어 봇을 서버에 초대합니다

### 4단계: 환경 변수 설정

#### 4-1. .env 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성합니다:

**Windows (PowerShell):**
```powershell
New-Item -ItemType File -Name .env
```

**Windows (CMD):**
```cmd
type nul > .env
```

**Mac/Linux:**
```bash
touch .env
```

#### 4-2. .env 파일 내용 작성

`.env` 파일을 열고 다음 형식으로 작성합니다:

```env
# Discord Bot Configuration
APP_ID=1234567890123456789
DISCORD_TOKEN=your_discord_bot_token_here
PUBLIC_KEY=your_discord_public_key_here

# Server Configuration
PORT=3000
WEBHOOK_BASE_URL=https://your-domain.com

# GitHub Webhook (Optional)
# GitHub 웹훅 서명 검증을 위한 시크릿 (선택사항)
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_here
```

**각 항목 설명:**
- `APP_ID`: 3단계에서 복사한 Discord Application ID
- `DISCORD_TOKEN`: 3단계에서 복사한 Bot Token
- `PUBLIC_KEY`: 3단계에서 복사한 Public Key
- `PORT`: 봇이 실행될 포트 번호 (기본값: 3000)
- `WEBHOOK_BASE_URL`: 봇의 공개 URL (GitHub 웹훅 설정 시 사용)
  - 로컬 개발 시: 나중에 ngrok URL로 변경
  - 프로덕션: 실제 도메인 (예: https://my-bot.example.com)
- `GITHUB_WEBHOOK_SECRET`: GitHub 웹훅 보안을 위한 시크릿 (선택사항)

**예시:**
```env
APP_ID=987654321098765432
DISCORD_TOKEN=ODIzNDU2Nzg5MDEyMzQ1Njc4OS.ABC123.XYZ789-def456-ghi789-jkl012-mno345
PUBLIC_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
PORT=3000
WEBHOOK_BASE_URL=https://abc123.ngrok.io
GITHUB_WEBHOOK_SECRET=my-secret-webhook-key-12345
```

### 5단계: 슬래시 커맨드 등록

봇을 실행하기 전에 Discord에 슬래시 커맨드를 등록해야 합니다:

```bash
npm run register
```

**성공 메시지 예시:**
```
Commands registered successfully!
```

이제 Discord 서버에서 `/`를 입력하면 다음 명령어들을 볼 수 있습니다:
- `/schedule-meeting`
- `/list-meetings`
- `/delete-meeting`
- `/setup-github`

⚠️ **참고**: 커맨드가 나타나지 않으면 몇 분 정도 기다려보세요. Discord가 전역 커맨드를 동기화하는 데 시간이 걸릴 수 있습니다.

### 6단계: 봇 실행

#### 6-1. 로컬 개발 환경 (ngrok 사용)

**6-1-1. ngrok 설치 (아직 설치하지 않은 경우)**

1. [ngrok 공식 웹사이트](https://ngrok.com/)에서 가입
2. 다운로드 페이지에서 운영체제에 맞는 버전 다운로드
3. 압축 해제 후 실행 파일을 PATH에 추가하거나 직접 실행

**6-1-2. ngrok 실행**

터미널을 새로 열어서 다음 명령어를 실행합니다:

```bash
ngrok http 3000
```

**출력 예시:**
```
ngrok                                                                            

Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**중요**: `Forwarding` 줄에 있는 `https://abc123.ngrok.io` 같은 URL을 복사해 둡니다.

**6-1-3. .env 파일 업데이트**

ngrok URL이 변경되었으므로 `.env` 파일의 `WEBHOOK_BASE_URL`을 업데이트합니다:

```env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

**6-1-4. Discord Interactions Endpoint 설정**

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 봇 애플리케이션 선택
2. 좌측 메뉴에서 **"General Information"** 탭 클릭
3. **"Interactions Endpoint URL"** 필드에 다음 URL 입력:
   ```
   https://abc123.ngrok.io/interactions
   ```
   (abc123.ngrok.io를 실제 ngrok URL로 변경)
4. **"Save Changes"** 버튼 클릭
5. Discord가 URL을 검증합니다. 봇 서버가 실행 중이어야 검증이 성공합니다

**6-1-5. 봇 서버 실행**

새 터미널 창을 열어서 (ngrok이 실행 중인 터미널은 그대로 둡니다):

```bash
npm start
```

또는 개발 모드로 실행 (파일 변경 시 자동 재시작):

```bash
npm run dev
```

**성공 메시지:**
```
Rundee Bot is listening on port 3000
```

이제 봇이 정상적으로 실행되고 있습니다! 🎉

#### 6-2. 프로덕션 환경

프로덕션 환경에서는 실제 서버나 클라우드 호스팅(Heroku, Railway, AWS 등)을 사용합니다.

1. 서버에 프로젝트 업로드
2. `.env` 파일 설정 (서버 환경 변수로 설정)
3. `WEBHOOK_BASE_URL`을 실제 도메인으로 설정
4. Discord Developer Portal에서 Interactions Endpoint URL을 실제 URL로 설정
5. `npm start` 또는 PM2 같은 프로세스 매니저로 실행

## 사용 방법

### 회의 일정 관리

#### 회의 일정 등록

Discord 채널에서 다음 명령어를 입력합니다:

```
/schedule-meeting date:2024-12-25 14:30 title:주간 회의 participants:@user1 @user2 reminder_minutes:15
```

**파라미터 설명:**
- `date`: 회의 날짜 및 시간 (형식: `YYYY-MM-DD HH:mm`)
  - 예: `2024-12-25 14:30` (2024년 12월 25일 오후 2시 30분)
  - ⚠️ 24시간 형식을 사용하세요 (오후 2시 30분 = 14:30)
- `title`: 회의 제목 (예: "주간 회의", "프로젝트 리뷰")
- `participants`: 참석자 멘션
  - 예: `@user1 @user2 @user3`
  - 또는 사용자 ID를 직접 입력: `123456789,987654321`
  - ⚠️ 사용자를 멘션할 때는 Discord에서 자동완성된 사용자를 선택하세요
- `reminder_minutes`: 회의 몇 분 전에 알림을 보낼지 (선택사항, 기본값: 15분)
  - 예: `15` (회의 15분 전에 알림)

**예시 1: 기본 사용 (15분 전 알림)**
```
/schedule-meeting date:2024-12-25 14:30 title:주간 회의 participants:@john @jane
```

**예시 2: 30분 전 알림**
```
/schedule-meeting date:2024-12-25 14:30 title:프로젝트 리뷰 participants:@john @jane @bob reminder_minutes:30
```

**응답 예시:**
```
✅ 회의 일정이 등록되었습니다!

**제목:** 주간 회의
**일시:** 2024-12-25 14:30
**참석자:** @john, @jane
**알림 시간:** 2024-12-25 14:15 (15분 전)
**ID:** 1
```

#### 회의 목록 확인

등록된 모든 회의 일정을 확인합니다:

```
/list-meetings
```

**응답 예시:**
```
📅 등록된 회의 일정:

**ID: 1** - 주간 회의
일시: 2024-12-25 14:30
참석자: @john, @jane

**ID: 2** - 프로젝트 리뷰
일시: 2024-12-26 10:00
참석자: @bob, @alice
```

#### 회의 삭제

등록된 회의를 삭제합니다:

```
/delete-meeting meeting_id:1
```

- `meeting_id`: 삭제할 회의의 ID (`/list-meetings` 명령어로 확인 가능)

**응답 예시:**
```
✅ 회의 일정이 삭제되었습니다: **주간 회의** (2024-12-25 14:30)
```

### GitHub 웹훅 설정

#### 1단계: Discord에서 알림 채널 설정

GitHub 알림을 받을 Discord 채널을 설정합니다:

**현재 채널로 설정:**
```
/setup-github
```

**특정 채널로 설정:**
```
/setup-github channel:#alerts
```

**응답 예시:**
```
✅ GitHub 알림이 #alerts 채널로 설정되었습니다.

웹훅 URL: https://abc123.ngrok.io/webhook/github

GitHub 저장소 설정에서 이 URL을 웹훅 Payload URL로 사용하세요.
```

응답에 표시된 웹훅 URL을 복사해 둡니다.

#### 2단계: GitHub 저장소에서 웹훅 설정

1. **GitHub 저장소로 이동**
   - 알림을 받고 싶은 저장소의 페이지로 이동합니다

2. **Settings 탭 열기**
   - 저장소 상단 메뉴에서 **"Settings"** 클릭

3. **Webhooks 메뉴 접근**
   - 좌측 메뉴에서 **"Webhooks"** 클릭

4. **새 웹훅 추가**
   - **"Add webhook"** 버튼 클릭

5. **웹훅 정보 입력**
   - **Payload URL**: `/setup-github` 명령어에서 받은 URL 입력
     ```
     https://your-domain.com/webhook/github
     ```
   - **Content type**: `application/json` 선택
   - **Secret**: (선택사항) 보안을 위해 시크릿 키 입력
     - 이 값은 `.env` 파일의 `GITHUB_WEBHOOK_SECRET`과 동일하게 설정
     - 예: `my-secret-webhook-key-12345`

6. **이벤트 선택**
   - **"Just the push event"** 선택 (push만 알림받기)
   - 또는 **"Let me select individual events"** 선택 후:
     - ✅ `Pushes` 체크
     - ✅ `Pull requests` 체크 (merge 알림을 받으려면)

7. **웹훅 활성화 확인**
   - **"Active"** 체크박스가 체크되어 있는지 확인

8. **저장**
   - **"Add webhook"** 버튼 클릭

9. **테스트**
   - 저장소에 코드를 push하거나 pull request를 merge해보세요
   - Discord 채널에 자동으로 알림이 전송됩니다!

#### GitHub 이벤트 알림 예시

**Push 이벤트 알림:**
```
🔔 GitHub Push 이벤트

**저장소:** username/repository
**브랜치:** main
**작성자:** john
**커밋 수:** 3

**커밋 내역:**
  • Add new feature (John Doe)
  • Update README (John Doe)
  • Fix bug in authentication (John Doe)

🔗 [보기](https://github.com/username/repository/compare/abc123...def456)
```

**Merge 이벤트 알림:**
```
🔀 GitHub Merge 이벤트

**저장소:** username/repository
**PR 제목:** Add user authentication
**작성자:** jane
**머지한 사람:** john
**베이스 브랜치:** main
**머지 브랜치:** feature/auth

🔗 [PR 보기](https://github.com/username/repository/pull/123)
```

## 프로젝트 구조

```
discord-example-app/
├── app.js          # 메인 애플리케이션 파일
│                   # - Discord Interactions 처리
│                   # - GitHub Webhook 처리
│                   # - 회의 알림 스케줄링
│
├── commands.js     # 슬래시 커맨드 정의 및 등록
│
├── utils.js        # 유틸리티 함수
│                   # - Discord API 요청
│                   # - 커맨드 등록
│
├── package.json    # 프로젝트 의존성 및 스크립트
│
├── README_KR.md    # 한국어 문서 (이 파일)
├── README_EN.md    # 영어 문서
│
└── .env            # 환경 변수 (생성 필요, .gitignore에 포함)
```

## 주의사항 및 제한사항

### 데이터 저장

⚠️ **현재 버전은 메모리에 데이터를 저장합니다:**
- 서버가 재시작되면 등록된 회의 일정이 모두 삭제됩니다
- GitHub 채널 설정도 초기화됩니다

**프로덕션 사용 권장사항:**
- 데이터베이스 사용 (SQLite, PostgreSQL, MongoDB 등)
- 파일 시스템에 JSON 파일로 저장
- 클라우드 저장소 활용

### 시간대 설정

- 회의 알림은 기본적으로 **Asia/Seoul (KST, UTC+9)** 시간대를 사용합니다
- 다른 시간대를 사용하려면 `app.js` 파일의 cron 스케줄러 설정을 수정하세요:
  ```javascript
  cron.schedule(cronExpression, async () => {
    // ...
  }, {
    scheduled: true,
    timezone: 'America/New_York',  // 원하는 시간대로 변경
  });
  ```

### ngrok 무료 버전 제한사항

- 무료 ngrok URL은 재시작할 때마다 변경됩니다
- 변경될 때마다 Discord Developer Portal에서 Interactions Endpoint URL을 업데이트해야 합니다
- 프로덕션 환경에서는 고정된 도메인을 사용하는 것을 권장합니다

## 트러블슈팅

### 봇이 응답하지 않아요

1. **봇 서버가 실행 중인지 확인**
   ```bash
   # 터미널에서 확인
   npm start
   ```

2. **ngrok이 실행 중인지 확인** (로컬 개발 시)
   - ngrok 터미널이 열려 있고 "online" 상태인지 확인

3. **Interactions Endpoint URL이 올바른지 확인**
   - Discord Developer Portal에서 확인
   - URL 끝에 `/interactions`가 포함되어 있는지 확인

4. **환경 변수가 올바른지 확인**
   - `.env` 파일의 값들이 정확한지 확인
   - 특히 `PUBLIC_KEY`와 `DISCORD_TOKEN`이 정확한지 확인

### 커맨드가 나타나지 않아요

1. **커맨드 등록 확인**
   ```bash
   npm run register
   ```
   - 성공 메시지가 나오는지 확인

2. **잠시 기다리기**
   - Discord가 전역 커맨드를 동기화하는 데 몇 분 걸릴 수 있습니다

3. **Discord 재시작**
   - Discord 앱을 완전히 종료하고 다시 실행

### 회의 알림이 오지 않아요

1. **회의 시간 확인**
   - 등록한 회의 시간이 현재 시간보다 미래인지 확인

2. **봇 서버가 실행 중인지 확인**
   - 회의 시간까지 봇 서버가 계속 실행되어 있어야 합니다

3. **시간 형식 확인**
   - 날짜 형식이 `YYYY-MM-DD HH:mm`인지 확인
   - 24시간 형식을 사용했는지 확인

### GitHub 알림이 오지 않아요

1. **채널 설정 확인**
   - `/setup-github` 명령어를 실행했는지 확인

2. **GitHub 웹훅 설정 확인**
   - GitHub 저장소의 Settings > Webhooks에서 웹훅이 활성화되어 있는지 확인
   - Payload URL이 올바른지 확인

3. **웹훅 테스트**
   - GitHub에서 웹훅 설정 페이지에서 "Recent Deliveries"를 확인
   - 실패한 요청이 있다면 에러 메시지 확인

## 개발

### 개발 모드 실행

파일 변경 시 자동으로 재시작되는 개발 모드:

```bash
npm run dev
```

### 코드 수정 시 주의사항

- `commands.js` 파일을 수정한 후에는 `npm run register`를 다시 실행해야 합니다
- `app.js` 파일을 수정한 후에는 봇 서버를 재시작해야 합니다

## 라이선스

MIT

