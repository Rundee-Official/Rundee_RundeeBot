# Rundee Bot

A Discord bot that provides meeting schedule reminders and GitHub integration notifications.

## Features

### 📅 Meeting Schedule Reminders
- Register meeting schedules and automatically send mention notifications to participants before the scheduled time
- View and delete registered meeting schedules

### 🔔 GitHub Integration
- Send notifications to Discord channels when push, commit, or merge events occur in GitHub repositories
- Monitor development activities in real-time through GitHub webhooks

## Getting Started

### Step 1: Prerequisites

Make sure you have the following:
- **Node.js 18.x or higher** installed
- **Discord Developer Account** and bot token
- **GitHub Repository** (for webhook functionality)
- **Publicly accessible server** or tunneling tool like ngrok (for local development)

### Step 2: Project Installation

#### 2-1. Clone Repository and Navigate to Directory
```bash
git clone <repository-url>
cd discord-example-app
```

#### 2-2. Install Dependencies
```bash
npm install
```

This will install all dependencies defined in `package.json`:
- discord-interactions: Discord API interaction handling
- express: Web server
- node-cron: Scheduling (for meeting reminders)
- dotenv: Environment variable management

### Step 3: Discord Bot Setup

#### 3-1. Create Application in Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** button in the top right
3. Enter an application name (e.g., "Rundee Bot")
4. Click **"Create"** button

#### 3-2. Create Bot

1. Click **"Bot"** tab in the left menu
2. Click **"Add Bot"** button and confirm
3. In the **"Token"** section, click **"Reset Token"** or **"Copy"** button to copy the token
   - ⚠️ **Warning**: Never share this token publicly! You'll use it in the `.env` file later
4. In the **"Privileged Gateway Intents"** section below, enable intents as needed
   - If you don't need to read message content, default settings are sufficient

#### 3-3. Copy Required Information

Copy the following information from Discord Developer Portal:

1. **APP ID (Application ID)**
   - Can be found in the **"General Information"** tab
   - Copy the number under "Application ID"

2. **PUBLIC KEY**
   - Can be found in the **"General Information"** tab
   - Copy the string under "Public Key"

3. **BOT TOKEN**
   - The token you copied earlier from the **"Bot"** tab

#### 3-4. Set Bot Permissions and Invite to Server

1. Go to **"OAuth2"** > **"URL Generator"** tab in the left menu
2. In the **"Scopes"** section, check:
   - ✅ `bot`
   - ✅ `applications.commands`
3. In the **"Bot Permissions"** section, check:
   - ✅ `Send Messages`
   - ✅ `Use Slash Commands`
   - ✅ `Mention Everyone` (optional, only if you need to mention all members for meeting reminders)
4. Copy the **"Generated URL"** shown at the bottom
5. Open this URL in your browser to invite the bot to your server

### Step 4: Environment Variables Setup

#### 4-1. Create .env File

Create a `.env` file in the project root directory:

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

#### 4-2. Write .env File Contents

Open the `.env` file and write the following format:

```env
# Discord Bot Configuration
APP_ID=1234567890123456789
DISCORD_TOKEN=your_discord_bot_token_here
PUBLIC_KEY=your_discord_public_key_here

# Server Configuration
PORT=3000
WEBHOOK_BASE_URL=https://your-domain.com

# GitHub Webhook (Optional)
# Secret for GitHub webhook signature verification (optional)
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_here
```

**Description of each field:**
- `APP_ID`: Discord Application ID copied in Step 3
- `DISCORD_TOKEN`: Bot Token copied in Step 3
- `PUBLIC_KEY`: Public Key copied in Step 3
- `PORT`: Port number the bot will run on (default: 3000)
- `WEBHOOK_BASE_URL`: Public URL of the bot (used for GitHub webhook setup)
  - For local development: Change to ngrok URL later
  - For production: Actual domain (e.g., https://my-bot.example.com)
- `GITHUB_WEBHOOK_SECRET`: Secret for GitHub webhook security (optional)

**Example:**
```env
APP_ID=987654321098765432
DISCORD_TOKEN=ODIzNDU2Nzg5MDEyMzQ1Njc4OS.ABC123.XYZ789-def456-ghi789-jkl012-mno345
PUBLIC_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
PORT=3000
WEBHOOK_BASE_URL=https://abc123.ngrok.io
GITHUB_WEBHOOK_SECRET=my-secret-webhook-key-12345
```

### Step 5: Register Slash Commands

Before running the bot, you need to register slash commands with Discord:

```bash
npm run register
```

**Success message example:**
```
Commands registered successfully!
```

Now when you type `/` in your Discord server, you should see the following commands:
- `/schedule-meeting`
- `/list-meetings`
- `/delete-meeting`
- `/setup-github`

⚠️ **Note**: If commands don't appear, wait a few minutes. It may take time for Discord to synchronize global commands.

### Step 6: Run the Bot

#### 6-1. Local Development Environment (using ngrok)

**6-1-1. Install ngrok (if not already installed)**

1. Sign up at [ngrok official website](https://ngrok.com/)
2. Download the version for your operating system from the download page
3. Extract and add the executable to PATH or run it directly

**6-1-2. Run ngrok**

Open a new terminal and run:

```bash
ngrok http 3000
```

**Output example:**
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

**Important**: Copy the URL like `https://abc123.ngrok.io` from the `Forwarding` line.

**6-1-3. Update .env File**

Since the ngrok URL has changed, update `WEBHOOK_BASE_URL` in the `.env` file:

```env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

**6-1-4. Set Discord Interactions Endpoint**

1. Select your bot application in [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"General Information"** tab in the left menu
3. Enter the following URL in the **"Interactions Endpoint URL"** field:
   ```
   https://abc123.ngrok.io/interactions
   ```
   (Replace abc123.ngrok.io with your actual ngrok URL)
4. Click **"Save Changes"** button
5. Discord will verify the URL. The bot server must be running for verification to succeed

**6-1-5. Run Bot Server**

Open a new terminal window (keep the ngrok terminal running):

```bash
npm start
```

Or run in development mode (auto-restart on file changes):

```bash
npm run dev
```

**Success message:**
```
Rundee Bot is listening on port 3000
```

Now the bot is running successfully! 🎉

#### 6-2. Production Environment

For production environments, use an actual server or cloud hosting (Heroku, Railway, AWS, etc.).

1. Upload project to server
2. Set up `.env` file (or use server environment variables)
3. Set `WEBHOOK_BASE_URL` to actual domain
4. Set Interactions Endpoint URL in Discord Developer Portal to actual URL
5. Run with `npm start` or a process manager like PM2

## Usage

### Meeting Schedule Management

#### Register Meeting Schedule

Type the following command in a Discord channel:

```
/schedule-meeting date:2024-12-25 14:30 title:Weekly Meeting participants:@user1 @user2 reminder_minutes:15
```

**Parameter descriptions:**
- `date`: Meeting date and time (format: `YYYY-MM-DD HH:mm`)
  - Example: `2024-12-25 14:30` (December 25, 2024 at 2:30 PM)
  - ⚠️ Use 24-hour format (2:30 PM = 14:30)
- `title`: Meeting title (e.g., "Weekly Meeting", "Project Review")
- `participants`: Participant mentions
  - Example: `@user1 @user2 @user3`
  - Or enter user IDs directly: `123456789,987654321`
  - ⚠️ When mentioning users, select users from Discord's autocomplete
- `reminder_minutes`: How many minutes before the meeting to send notification (optional, default: 15 minutes)
  - Example: `15` (send notification 15 minutes before meeting)

**Example 1: Basic usage (15 minutes before notification)**
```
/schedule-meeting date:2024-12-25 14:30 title:Weekly Meeting participants:@john @jane
```

**Example 2: 30 minutes before notification**
```
/schedule-meeting date:2024-12-25 14:30 title:Project Review participants:@john @jane @bob reminder_minutes:30
```

**Response example:**
```
✅ Meeting schedule has been registered!

**Title:** Weekly Meeting
**Date & Time:** 2024-12-25 14:30
**Participants:** @john, @jane
**Reminder Time:** 2024-12-25 14:15 (15 minutes before)
**ID:** 1
```

#### List Meetings

View all registered meeting schedules:

```
/list-meetings
```

**Response example:**
```
📅 Registered Meeting Schedules:

**ID: 1** - Weekly Meeting
Date & Time: 2024-12-25 14:30
Participants: @john, @jane

**ID: 2** - Project Review
Date & Time: 2024-12-26 10:00
Participants: @bob, @alice
```

#### Delete Meeting

Delete a registered meeting:

```
/delete-meeting meeting_id:1
```

- `meeting_id`: ID of the meeting to delete (can be found using `/list-meetings` command)

**Response example:**
```
✅ Meeting schedule has been deleted: **Weekly Meeting** (2024-12-25 14:30)
```

### GitHub Webhook Setup

#### Step 1: Set Notification Channel in Discord

Set the Discord channel to receive GitHub notifications:

**Set current channel:**
```
/setup-github
```

**Set specific channel:**
```
/setup-github channel:#alerts
```

**Response example:**
```
✅ GitHub notifications have been set to #alerts channel.

Webhook URL: https://abc123.ngrok.io/webhook/github

Use this URL as the webhook Payload URL in your GitHub repository settings.
```

Copy the webhook URL shown in the response.

#### Step 2: Set Up Webhook in GitHub Repository

1. **Go to GitHub Repository**
   - Navigate to the repository page you want to receive notifications for

2. **Open Settings Tab**
   - Click **"Settings"** in the top menu of the repository

3. **Access Webhooks Menu**
   - Click **"Webhooks"** in the left menu

4. **Add New Webhook**
   - Click **"Add webhook"** button

5. **Enter Webhook Information**
   - **Payload URL**: Enter the URL received from the `/setup-github` command
     ```
     https://your-domain.com/webhook/github
     ```
   - **Content type**: Select `application/json`
   - **Secret**: (Optional) Enter a secret key for security
     - This should match the `GITHUB_WEBHOOK_SECRET` value in your `.env` file
     - Example: `my-secret-webhook-key-12345`

6. **Select Events**
   - Select **"Just the push event"** (only receive push notifications)
   - Or select **"Let me select individual events"** and then:
     - ✅ Check `Pushes`
     - ✅ Check `Pull requests` (to receive merge notifications)

7. **Verify Webhook is Active**
   - Make sure the **"Active"** checkbox is checked

8. **Save**
   - Click **"Add webhook"** button

9. **Test**
   - Push code to the repository or merge a pull request
   - Notifications should automatically be sent to the Discord channel!

#### GitHub Event Notification Examples

**Push Event Notification:**
```
🔔 GitHub Push Event

**Repository:** username/repository
**Branch:** main
**Author:** john
**Commit Count:** 3

**Commits:**
  • Add new feature (John Doe)
  • Update README (John Doe)
  • Fix bug in authentication (John Doe)

🔗 [View](https://github.com/username/repository/compare/abc123...def456)
```

**Merge Event Notification:**
```
🔀 GitHub Merge Event

**Repository:** username/repository
**PR Title:** Add user authentication
**Author:** jane
**Merged by:** john
**Base Branch:** main
**Merge Branch:** feature/auth

🔗 [View PR](https://github.com/username/repository/pull/123)
```

## Project Structure

```
discord-example-app/
├── app.js          # Main application file
│                   # - Discord Interactions handling
│                   # - GitHub Webhook handling
│                   # - Meeting reminder scheduling
│
├── commands.js     # Slash command definitions and registration
│
├── utils.js        # Utility functions
│                   # - Discord API requests
│                   # - Command registration
│
├── package.json    # Project dependencies and scripts
│
├── README.md       # English documentation (this file)
├── README_KR.md    # Korean documentation
│
└── .env            # Environment variables (create required, included in .gitignore)
```

## Notes and Limitations

### Data Storage

⚠️ **Current version stores data in memory:**
- All registered meeting schedules will be deleted when the server restarts
- GitHub channel settings will also be reset

**Recommendations for production use:**
- Use a database (SQLite, PostgreSQL, MongoDB, etc.)
- Save to JSON file on file system
- Use cloud storage

### Timezone Settings

- Meeting reminders use **Asia/Seoul (KST, UTC+9)** timezone by default
- To use a different timezone, modify the cron scheduler settings in `app.js`:
  ```javascript
  cron.schedule(cronExpression, async () => {
    // ...
  }, {
    scheduled: true,
    timezone: 'America/New_York',  // Change to desired timezone
  });
  ```

### ngrok Free Version Limitations

- Free ngrok URLs change every time you restart
- You must update the Interactions Endpoint URL in Discord Developer Portal each time it changes
- For production environments, using a fixed domain is recommended

## Troubleshooting

### Bot Not Responding

1. **Check if bot server is running**
   ```bash
   # Check in terminal
   npm start
   ```

2. **Check if ngrok is running** (for local development)
   - Check if ngrok terminal is open and shows "online" status

3. **Check if Interactions Endpoint URL is correct**
   - Check in Discord Developer Portal
   - Make sure the URL ends with `/interactions`

4. **Check if environment variables are correct**
   - Verify values in `.env` file are correct
   - Especially check if `PUBLIC_KEY` and `DISCORD_TOKEN` are accurate

### Commands Not Appearing

1. **Check command registration**
   ```bash
   npm run register
   ```
   - Check if success message appears

2. **Wait a moment**
   - It may take a few minutes for Discord to synchronize global commands

3. **Restart Discord**
   - Completely close and restart the Discord app

### Meeting Reminders Not Coming

1. **Check meeting time**
   - Make sure the registered meeting time is in the future

2. **Check if bot server is running**
   - The bot server must be running continuously until the meeting time

3. **Check time format**
   - Make sure date format is `YYYY-MM-DD HH:mm`
   - Make sure you're using 24-hour format

### GitHub Notifications Not Coming

1. **Check channel setup**
   - Make sure you ran the `/setup-github` command

2. **Check GitHub webhook setup**
   - Check in GitHub repository Settings > Webhooks if webhook is active
   - Verify Payload URL is correct

3. **Test webhook**
   - Check "Recent Deliveries" in GitHub webhook settings page
   - If there are failed requests, check error messages

## Development

### Run in Development Mode

Development mode with auto-restart on file changes:

```bash
npm run dev
```

### Notes When Modifying Code

- After modifying `commands.js`, you must run `npm run register` again
- After modifying `app.js`, you must restart the bot server

## License

MIT
