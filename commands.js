import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Meeting schedule command
const SCHEDULE_MEETING_COMMAND = {
  name: 'schedule-meeting',
  description: '회의 일정을 등록합니다 (Register a meeting schedule)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 3, // STRING
      name: 'date',
      description: '회의 날짜 및 시간 (예: 2024-12-25 14:30)',
      required: true,
    },
    {
      type: 3, // STRING
      name: 'title',
      description: '회의 제목',
      required: true,
    },
    {
      type: 3, // STRING
      name: 'participants',
      description: '참석자 멘션 (예: @user1 @user2 또는 user1,user2)',
      required: true,
    },
    {
      type: 3, // STRING
      name: 'reminder_minutes',
      description: '몇 분 전에 알림을 보낼지 (여러 시간 가능: 예: 1,5,10 또는 15, 기본값: 15)',
      required: false,
    },
  ],
};

// List meetings command
const LIST_MEETINGS_COMMAND = {
  name: 'list-meetings',
  description: '등록된 회의 일정 목록을 보여줍니다 (Show list of scheduled meetings)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Delete meeting command
const DELETE_MEETING_COMMAND = {
  name: 'delete-meeting',
  description: '회의 일정을 삭제합니다 (Delete a scheduled meeting)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 4, // INTEGER
      name: 'meeting_id',
      description: '삭제할 회의 ID (list-meetings로 확인 가능)',
      required: true,
    },
  ],
};

// Setup GitHub webhook command
const SETUP_GITHUB_COMMAND = {
  name: 'setup-github',
  description: 'GitHub 웹훅을 설정합니다 (Setup GitHub webhook)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 3, // STRING
      name: 'repository',
      description: 'GitHub 저장소 URL (예: https://github.com/user/repo)',
      required: false,
    },
    {
      type: 7, // CHANNEL
      name: 'channel',
      description: '알림을 받을 채널',
      required: false,
    },
  ],
};

const ALL_COMMANDS = [
  SCHEDULE_MEETING_COMMAND,
  LIST_MEETINGS_COMMAND,
  DELETE_MEETING_COMMAND,
  SETUP_GITHUB_COMMAND,
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
