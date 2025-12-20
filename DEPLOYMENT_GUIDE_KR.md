# Rundee Bot 배포 및 사용 가이드 (상세)

이 문서는 Rundee Bot을 사용하고 배포하는 방법을 단계별로 상세하게 설명합니다.

---

## 📋 목차

1. [로컬 개발 환경 설정 (ngrok 사용)](#1-로컬-개발-환경-설정-ngrok-사용)
2. [프로덕션 배포 옵션](#2-프로덕션-배포-옵션)
   - [옵션 A: Railway 배포](#옵션-a-railway-배포-추천)
   - [옵션 B: Heroku 배포](#옵션-b-heroku-배포)
   - [옵션 C: Render 배포](#옵션-c-render-배포)
   - [옵션 D: VPS/클라우드 서버 배포](#옵션-d-vps클라우드-서버-배포)
3. [봇 사용 방법](#3-봇-사용-방법)

---

## 1. 로컬 개발 환경 설정 (ngrok 사용)

로컬 컴퓨터에서 봇을 테스트하고 개발하려면 다음 단계를 따르세요.

### 1-1. 사전 준비

#### Node.js 설치 확인
```bash
node --version
# v18.x 이상이어야 합니다
```

#### 프로젝트 클론 및 의존성 설치
```bash
# 프로젝트 디렉토리로 이동
cd rundee-bot

# 의존성 설치
npm install
```

### 1-2. Discord Developer Portal 설정

#### Step 1: Discord 애플리케이션 생성

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속
2. **"New Application"** 버튼 클릭
3. 애플리케이션 이름 입력 (예: "Rundee Bot")
4. **"Create"** 클릭

#### Step 2: 봇 생성 및 토큰 발급

1. 좌측 메뉴에서 **"Bot"** 탭 클릭
2. **"Add Bot"** 버튼 클릭 후 확인
3. **"Token"** 섹션에서 **"Reset Token"** 클릭 → 토큰 복사 (⚠️ 나중에 `.env` 파일에 사용)
4. **"Privileged Gateway Intents"** 섹션:
   - 메시지 내용을 읽을 필요가 없다면 기본 설정 유지
   - 필요시 `MESSAGE CONTENT INTENT` 활성화

#### Step 3: 필요한 정보 복사

**General Information 탭에서:**
- **Application ID**: 복사해 두기
- **Public Key**: 복사해 두기

**Bot 탭에서:**
- **Token**: 복사해 두기

#### Step 4: 봇 초대 URL 생성 (Guild Install)

⚠️ **중요:** 이 봇은 **Guild Install (서버 설치)** 방식입니다. User Install (개인 설치)도 기술적으로 지원하지만, 회의 일정 관리와 GitHub 웹훅 기능은 서버 컨텍스트에서만 작동합니다.

1. **"OAuth2"** > **"URL Generator"** 탭으로 이동
2. **"Scopes"** 섹션:
   - ✅ `bot` 체크
   - ✅ `applications.commands` 체크
   - ⚠️ `bot`과 `applications.commands`만 체크 (Guild Install용)
3. **"Bot Permissions"** 섹션:
   - ✅ `Send Messages`
   - ✅ `Use Slash Commands`
   - ✅ `Mention Everyone` (회의 알림에 모든 멤버 멘션이 필요할 때만)
   - ✅ `Read Message History` (선택사항)
4. 하단의 **"Generated URL"** 복사
5. 브라우저에서 URL 열어서 봇을 **서버(Guild)에 초대**

**Guild Install vs User Install:**
- **Guild Install (서버 설치)**: 서버에 봇을 추가하여 서버 내 모든 멤버가 사용 가능 ✅ **권장**
- **User Install (개인 설치)**: 개인이 봇을 설치하여 DM이나 개인 채널에서 사용 (현재 봇은 Guild 기능에 의존하므로 비권장)

### 1-3. 환경 변수 설정 (.env 파일)

프로젝트 루트에 `.env` 파일 생성:

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

`.env` 파일 내용 작성 (아래 예시 참고):
```env
# Discord Bot Configuration
APP_ID=1234567890123456789
DISCORD_TOKEN=your_discord_bot_token_here
PUBLIC_KEY=your_discord_public_key_here

# Server Configuration
PORT=3000
WEBHOOK_BASE_URL=https://abc123.ngrok.io

# GitHub Webhook (Optional)
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_here
```

**⚠️ 주의:** 
- `APP_ID`, `DISCORD_TOKEN`, `PUBLIC_KEY`는 실제 값으로 교체
- `WEBHOOK_BASE_URL`은 ngrok 실행 후 업데이트 필요 (아래 단계 참고)

### 1-4. ngrok 설치 및 실행

#### ngrok 설치

1. [ngrok 공식 웹사이트](https://ngrok.com/)에서 가입 (무료)
2. 다운로드 페이지에서 OS에 맞는 버전 다운로드
3. 압축 해제 후 실행 파일을 PATH에 추가하거나 직접 실행

**Windows 예시:**
- 다운로드한 `ngrok.exe`를 `C:\ngrok` 폴더에 저장
- 환경 변수 PATH에 `C:\ngrok` 추가

#### ngrok 실행

새 터미널 창을 열어서:
```bash
ngrok http 3000
```

출력 예시:
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

**중요:** `Forwarding` 줄의 `https://abc123.ngrok.io` URL을 복사해 두세요.

### 1-5. .env 파일 업데이트

ngrok URL을 `.env` 파일의 `WEBHOOK_BASE_URL`에 업데이트:

```env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

(abc123.ngrok.io를 실제 ngrok URL로 변경)

### 1-6. Discord Interactions Endpoint 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 봇 애플리케이션 선택
2. **"General Information"** 탭 클릭
3. **"Interactions Endpoint URL"** 필드에 입력:
   ```
   https://abc123.ngrok.io/interactions
   ```
   (abc123.ngrok.io를 실제 ngrok URL로 변경)
4. **"Save Changes"** 클릭
5. Discord가 URL을 검증합니다 (봇 서버가 실행 중이어야 검증 성공)

### 1-7. 슬래시 커맨드 등록

봇을 실행하기 전에 Discord에 슬래시 커맨드를 등록해야 합니다:

```bash
npm run register
```

성공 메시지 예시:
```
Commands registered successfully!
```

⚠️ **참고:** 
- 커맨드가 Discord에 표시되는 데 몇 분 걸릴 수 있습니다
- 커맨드가 나타나지 않으면 Discord 앱을 재시작해보세요

### 1-8. 봇 실행

새 터미널 창을 열어서 (ngrok이 실행 중인 터미널은 그대로 둡니다):

**일반 실행:**
```bash
npm start
```

**개발 모드 (파일 변경 시 자동 재시작):**
```bash
npm run dev
```

성공 메시지:
```
Rundee Bot is listening on port 3000
```

### 1-9. 로컬 개발 환경 주의사항

- ⚠️ ngrok 무료 버전은 재시작할 때마다 URL이 변경됩니다
- URL이 변경되면 `.env` 파일과 Discord Developer Portal의 Interactions Endpoint URL을 업데이트해야 합니다
- 컴퓨터를 끄면 봇이 작동하지 않습니다 (프로덕션 배포 필요)

---

## 2. 프로덕션 배포 옵션

24/7 봇을 운영하려면 클라우드 서비스나 서버에 배포해야 합니다.

---

### 옵션 A: Railway 배포 (추천)

Railway는 간단하고 사용하기 쉬운 배포 플랫폼입니다.

#### A-1. Railway 계정 생성 및 프로젝트 설정

1. [Railway](https://railway.app/)에 가입 (GitHub 계정으로 가입 가능)
2. **"New Project"** 클릭
3. **"Deploy from GitHub repo"** 선택
4. GitHub 저장소 선택 (프로젝트가 GitHub에 있어야 함)
5. 또는 **"Empty Project"** 선택 후 수동으로 코드 배포

#### A-2. 환경 변수 설정

Railway 대시보드에서:
1. 프로젝트 선택
2. **"Variables"** 탭 클릭
3. 다음 환경 변수 추가:

```
APP_ID=your_app_id
DISCORD_TOKEN=your_discord_token
PUBLIC_KEY=your_public_key
PORT=3000
WEBHOOK_BASE_URL=https://your-project.railway.app
GITHUB_WEBHOOK_SECRET=your_secret (선택사항)
```

⚠️ **중요:** `WEBHOOK_BASE_URL`은 Railway가 자동으로 생성하는 도메인을 사용하거나 커스텀 도메인을 설정할 수 있습니다.

#### A-3. 도메인 확인 (Railway 기본 도메인 사용 시)

1. Railway 대시보드에서 **"Settings"** 탭
2. **"Domains"** 섹션에서 생성된 도메인 확인 (예: `your-project.railway.app`)
3. 이 도메인을 `.env`의 `WEBHOOK_BASE_URL`로 사용
4. Discord Developer Portal의 Interactions Endpoint URL을 업데이트:
   ```
   https://your-project.railway.app/interactions
   ```

#### A-4. 배포 트리거

Railway는 GitHub 저장소에 연결되어 있으면 자동으로 배포됩니다:
- 코드를 push하면 자동 배포
- 수동 배포도 가능 (Railway 대시보드에서)

#### A-5. 슬래시 커맨드 등록

Railway 콘솔에서:
```bash
npm run register
```

또는 로컬에서 `.env` 파일을 Railway 환경 변수와 동일하게 설정한 후:
```bash
npm run register
```

#### A-6. Railway 가격

- 무료 플랜: $5 크레딧/월 (충분한 트래픽 제공)
- 유료 플랜: 사용량 기반

---

### 옵션 B: Heroku 배포

#### B-1. Heroku 계정 생성 및 CLI 설치

1. [Heroku](https://www.heroku.com/)에 가입
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) 설치

#### B-2. Heroku 앱 생성

터미널에서:
```bash
# Heroku 로그인
heroku login

# 프로젝트 디렉토리에서
cd rundee-bot

# Heroku 앱 생성
heroku create your-app-name

# 또는 웹 대시보드에서 앱 생성 후
heroku git:remote -a your-app-name
```

#### B-3. 환경 변수 설정

```bash
heroku config:set APP_ID=your_app_id
heroku config:set DISCORD_TOKEN=your_discord_token
heroku config:set PUBLIC_KEY=your_public_key
heroku config:set PORT=3000
heroku config:set WEBHOOK_BASE_URL=https://your-app-name.herokuapp.com
heroku config:set GITHUB_WEBHOOK_SECRET=your_secret
```

또는 Heroku 대시보드에서 **Settings** > **Config Vars**에서 설정

#### B-4. package.json에 start 스크립트 확인

`package.json`에 다음이 있는지 확인:
```json
"scripts": {
  "start": "node app.js"
}
```

#### B-5. Procfile 생성 (선택사항)

프로젝트 루트에 `Procfile` 생성:
```
web: node app.js
```

#### B-6. 배포

```bash
# Git 초기화 (아직 안 했다면)
git init
git add .
git commit -m "Initial commit"

# Heroku에 배포
git push heroku main
# 또는
git push heroku master
```

#### B-7. Discord 설정 업데이트

1. Heroku 앱 URL 확인: `https://your-app-name.herokuapp.com`
2. Discord Developer Portal에서 Interactions Endpoint URL 업데이트:
   ```
   https://your-app-name.herokuapp.com/interactions
   ```

#### B-8. 슬래시 커맨드 등록

로컬에서 Heroku 환경 변수 사용하여:
```bash
heroku run npm run register
```

또는 로컬 `.env` 파일 설정 후:
```bash
npm run register
```

#### B-9. Heroku 가격

- 무료 플랜: 2022년 11월부터 종료됨 (더 이상 제공 안 함)
- 유료 플랜: $5/월부터 시작

---

### 옵션 C: Render 배포

#### C-1. Render 계정 생성

1. [Render](https://render.com/)에 가입 (GitHub 계정으로 가입 가능)

#### C-2. 새 Web Service 생성

1. 대시보드에서 **"New +"** > **"Web Service"** 클릭
2. GitHub 저장소 연결
3. 설정:
   - **Name**: 원하는 이름
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (또는 유료 플랜)

#### C-3. 환경 변수 설정

**Environment Variables** 섹션에서:
```
APP_ID=your_app_id
DISCORD_TOKEN=your_discord_token
PUBLIC_KEY=your_public_key
PORT=3000
WEBHOOK_BASE_URL=https://your-service.onrender.com
GITHUB_WEBHOOK_SECRET=your_secret
```

#### C-4. 배포 및 도메인 확인

1. **"Create Web Service"** 클릭
2. 배포 완료 후 생성된 URL 확인 (예: `https://your-service.onrender.com`)
3. Discord Developer Portal에서 Interactions Endpoint URL 업데이트

#### C-5. 슬래시 커맨드 등록

로컬에서 Render 환경 변수와 동일하게 `.env` 설정 후:
```bash
npm run register
```

#### C-6. Render 가격

- 무료 플랜: 제한적 (15분 비활성 시 sleep)
- 유료 플랜: $7/월부터 (항상 활성)

⚠️ **주의:** Render 무료 플랜은 15분간 요청이 없으면 sleep 모드로 전환됩니다. Discord 봇은 주기적인 요청이 필요하므로 유료 플랜을 권장합니다.

---

### 옵션 D: VPS/클라우드 서버 배포

AWS, Google Cloud, Azure, DigitalOcean 등의 VPS를 사용할 수 있습니다.

#### D-1. 서버 준비

**Ubuntu 서버 예시:**

```bash
# 서버에 SSH 접속
ssh user@your-server-ip

# Node.js 18.x 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git 설치 (아직 안 되어 있다면)
sudo apt-get install git

# PM2 설치 (프로세스 매니저)
sudo npm install -g pm2
```

#### D-2. 프로젝트 배포

```bash
# 프로젝트 디렉토리 생성
mkdir -p ~/rundee-bot
cd ~/rundee-bot

# GitHub에서 클론 (또는 직접 업로드)
git clone https://github.com/your-username/rundee-bot.git .

# 의존성 설치
npm install
```

#### D-3. 환경 변수 설정

```bash
# .env 파일 생성
nano .env
```

`.env` 파일 내용:
```env
APP_ID=your_app_id
DISCORD_TOKEN=your_discord_token
PUBLIC_KEY=your_public_key
PORT=3000
WEBHOOK_BASE_URL=https://your-domain.com
GITHUB_WEBHOOK_SECRET=your_secret
```

#### D-4. Nginx 설정 (리버스 프록시, 선택사항)

```bash
# Nginx 설치
sudo apt-get install nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/rundee-bot
```

설정 내용:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/rundee-bot /etc/nginx/sites-enabled/

# Nginx 재시작
sudo nginx -t
sudo systemctl restart nginx
```

#### D-5. SSL 인증서 설치 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt-get install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 설정 (이미 자동 설정됨)
```

#### D-6. PM2로 봇 실행

```bash
# 봇 디렉토리로 이동
cd ~/rundee-bot

# PM2로 시작
pm2 start app.js --name rundee-bot

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs rundee-bot
```

#### D-7. 슬래시 커맨드 등록

```bash
cd ~/rundee-bot
npm run register
```

#### D-8. 방화벽 설정

```bash
# UFW 방화벽 활성화
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## 3. 봇 사용 방법

### 3-1. 기본 명령어

봇이 배포되고 Discord에 초대되었다면, 서버에서 `/`를 입력하면 다음 명령어들을 볼 수 있습니다:

- `/schedule-meeting` - 회의 일정 등록
- `/list-meetings` - 등록된 회의 목록 확인
- `/delete-meeting` - 회의 일정 삭제
- `/setup-github` - GitHub 웹훅 설정

### 3-2. 회의 일정 등록

```
/schedule-meeting date:2024-12-25 14:30 title:주간 회의 participants:@user1 @user2 reminder_minutes:15
```

**파라미터:**
- `date`: 회의 날짜 및 시간 (YYYY-MM-DD HH:mm 형식, 24시간 형식)
- `title`: 회의 제목
- `participants`: 참석자 멘션 (예: @user1 @user2 또는 user1,user2)
- `reminder_minutes`: 몇 분 전에 알림 (선택사항, 기본값: 15분)

**예시:**
```
/schedule-meeting date:2024-12-25 14:30 title:주간 회의 participants:@john @jane
```

### 3-3. 회의 목록 확인

```
/list-meetings
```

등록된 모든 회의 일정이 표시됩니다.

### 3-4. 회의 삭제

```
/delete-meeting meeting_id:1
```

`meeting_id`는 `/list-meetings` 명령어로 확인할 수 있습니다.

### 3-5. GitHub 웹훅 설정

#### Step 1: Discord에서 알림 채널 설정

```
/setup-github
```

또는 특정 채널 지정:
```
/setup-github channel:#alerts
```

응답에 웹훅 URL이 표시됩니다 (예: `https://your-domain.com/webhook/github`)

#### Step 2: GitHub 저장소에서 웹훅 설정

1. GitHub 저장소로 이동
2. **Settings** > **Webhooks** 클릭
3. **"Add webhook"** 클릭
4. 설정:
   - **Payload URL**: `/setup-github` 명령어에서 받은 URL
   - **Content type**: `application/json`
   - **Secret**: `.env` 파일의 `GITHUB_WEBHOOK_SECRET`과 동일 (선택사항)
   - **Events**: `Just the push event` 또는 개별 이벤트 선택
5. **"Add webhook"** 클릭

이제 GitHub에서 push나 merge가 발생하면 Discord 채널에 자동으로 알림이 전송됩니다!

---

## 4. 트러블슈팅

### 봇이 응답하지 않아요

1. **봇 서버가 실행 중인지 확인**
   - Railway/Heroku/Render 대시보드에서 상태 확인
   - VPS의 경우: `pm2 status` 명령어로 확인

2. **Interactions Endpoint URL 확인**
   - Discord Developer Portal에서 URL이 올바른지 확인
   - URL 끝에 `/interactions`가 포함되어 있는지 확인

3. **환경 변수 확인**
   - 배포 플랫폼의 환경 변수가 올바르게 설정되어 있는지 확인
   - 특히 `PUBLIC_KEY`와 `DISCORD_TOKEN` 확인

### 커맨드가 나타나지 않아요

1. **커맨드 등록 확인**
   ```bash
   npm run register
   ```
   - 성공 메시지 확인

2. **잠시 기다리기**
   - Discord가 전역 커맨드를 동기화하는 데 몇 분 걸릴 수 있음

3. **Discord 재시작**
   - Discord 앱을 완전히 종료하고 다시 실행

### 회의 알림이 오지 않아요

1. **봇 서버가 계속 실행 중인지 확인**
   - 회의 시간까지 봇 서버가 실행되어 있어야 함

2. **회의 시간 확인**
   - 등록한 회의 시간이 현재 시간보다 미래인지 확인

3. **시간 형식 확인**
   - 날짜 형식이 `YYYY-MM-DD HH:mm`인지 확인
   - 24시간 형식을 사용했는지 확인 (예: 오후 2시 30분 = 14:30)

### GitHub 알림이 오지 않아요

1. **채널 설정 확인**
   - `/setup-github` 명령어를 실행했는지 확인

2. **GitHub 웹훅 설정 확인**
   - GitHub 저장소의 Settings > Webhooks에서 웹훅이 활성화되어 있는지 확인
   - Payload URL이 올바른지 확인
   - "Recent Deliveries"에서 실패한 요청이 있는지 확인

3. **서버 로그 확인**
   - 배포 플랫폼의 로그를 확인하여 에러 메시지 확인

---

## 5. 참고사항

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
- 다른 시간대를 사용하려면 `app.js` 파일의 cron 스케줄러 설정을 수정하세요

### 비용 비교

| 플랫폼 | 무료 플랜 | 유료 플랜 시작 가격 | 추천도 |
|--------|-----------|---------------------|--------|
| Railway | $5 크레딧/월 | - | ⭐⭐⭐⭐⭐ |
| Heroku | 없음 (종료됨) | $5/월 | ⭐⭐⭐ |
| Render | 제한적 (sleep) | $7/월 | ⭐⭐⭐⭐ |
| VPS | 없음 | $5-10/월 | ⭐⭐⭐⭐ |

---

## 6. 추가 리소스

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord API 문서](https://discord.com/developers/docs/intro)
- [GitHub Webhooks 문서](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [Railway 문서](https://docs.railway.app/)
- [Heroku 문서](https://devcenter.heroku.com/)

---

**문의사항이나 문제가 있으면 GitHub Issues에 등록해주세요!**

