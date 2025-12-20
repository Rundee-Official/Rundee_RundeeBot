# Railway 배포 가이드 (빠른 버전)

## Railway 배포 단계별 가이드

### 1단계: Railway 계정 생성 및 프로젝트 생성

1. [Railway](https://railway.app/) 접속
2. **"Start a New Project"** 클릭
3. **"Deploy from GitHub repo"** 선택
   - GitHub 계정 연동 (처음이면)
   - 저장소 선택
4. 또는 **"Empty Project"** 선택 후 수동 배포

### 2단계: 환경 변수 설정

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
```

⚠️ **주의:** `WEBHOOK_BASE_URL`은 나중에 실제 도메인으로 업데이트해야 합니다.

### 3단계: 도메인 확인 및 업데이트

1. Railway 대시보드에서 **"Settings"** 탭
2. **"Domains"** 섹션에서 생성된 도메인 확인
   - 예: `rundee-bot-production.up.railway.app`
3. **"Variables"** 탭에서 `WEBHOOK_BASE_URL` 업데이트:
   ```
   WEBHOOK_BASE_URL=https://rundee-bot-production.up.railway.app
   ```
   (실제 도메인으로 변경)

### 4단계: Discord Developer Portal 설정

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. 봇 애플리케이션 선택 (Application ID: 1451975300404482239)
3. **"General Information"** 탭
4. **"Interactions Endpoint URL"** 입력:
   ```
   https://rundee-bot-production.up.railway.app/interactions
   ```
   (Railway에서 받은 실제 도메인으로 변경)
5. **"Save Changes"** 클릭
6. Discord가 URL을 검증합니다 (봇이 배포 완료되어야 검증 성공)

### 5단계: 슬래시 커맨드 등록

로컬에서 `.env` 파일을 Railway 환경 변수와 동일하게 설정한 후:

```bash
npm run register
```

또는 Railway 대시보드에서 **"Deployments"** > **"View Logs"** 확인하여 배포 상태 확인

### 6단계: 테스트

Discord 서버에서:
- `/schedule-meeting` - 회의 일정 등록 테스트
- `/list-meetings` - 회의 목록 확인
- `/setup-github repository:https://github.com/user/repo` - GitHub URL 등록 테스트

## 업데이트 방법

코드 수정 후:
1. GitHub에 push하면 Railway가 자동으로 재배포
2. 또는 Railway 대시보드에서 수동 재배포

## 문제 해결

### 봇이 응답하지 않아요
1. Railway 로그 확인: **"Deployments"** > **"View Logs"**
2. Discord Developer Portal에서 Interactions Endpoint URL 확인
3. 환경 변수가 올바른지 확인

### 커맨드가 나타나지 않아요
```bash
npm run register
```
명령어를 다시 실행해보세요.

## Railway 가격

- 무료 플랜: $5 크레딧/월 (충분한 트래픽 제공)
- 유료 플랜: 사용량 기반

