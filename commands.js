/**
 * @fileoverview Discord slash command definitions for Rundee Bot
 * @copyright Rundee 2024
 * @license MIT
 */

import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

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

// Edit meeting command
const EDIT_MEETING_COMMAND = {
  name: 'edit-meeting',
  description: '회의 일정을 수정합니다 (Edit a meeting schedule)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 4, // INTEGER
      name: 'meeting_id',
      description: '수정할 회의 ID',
      required: true,
    },
    {
      type: 3, // STRING
      name: 'date',
      description: '새로운 회의 날짜 및 시간 (예: 2024-12-25 14:30)',
      required: false,
    },
    {
      type: 3, // STRING
      name: 'title',
      description: '새로운 회의 제목',
      required: false,
    },
    {
      type: 3, // STRING
      name: 'participants',
      description: '새로운 참석자 멘션',
      required: false,
    },
    {
      type: 3, // STRING
      name: 'reminder_minutes',
      description: '새로운 알림 시간 (예: 1,5,10)',
      required: false,
    },
  ],
};

// Set meeting channel command
const SET_MEETING_CHANNEL_COMMAND = {
  name: 'set-meeting-channel',
  description: '회의 알림을 받을 채널을 설정합니다 (Set channel for meeting announcements)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 7, // CHANNEL
      name: 'channel',
      description: '회의 알림을 받을 채널 (기본값: 현재 채널)',
      required: false,
    },
  ],
};

// Set GitHub channel command
const SET_GITHUB_CHANNEL_COMMAND = {
  name: 'set-github-channel',
  description: 'GitHub 알림을 받을 채널을 설정합니다 (Set channel for GitHub announcements)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 7, // CHANNEL
      name: 'channel',
      description: 'GitHub 알림을 받을 채널 (기본값: 현재 채널)',
      required: false,
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
      description: 'GitHub 저장소 URL (예: https://github.com/user/repo 또는 user/repo)',
      required: true,
    },
    {
      type: 7, // CHANNEL
      name: 'channel',
      description: '알림을 받을 채널 (기본값: 현재 채널)',
      required: false,
    },
  ],
};

// Set language command
const SET_LANGUAGE_COMMAND = {
  name: 'set-language',
  description: 'Set the bot language (한국어/English)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 3, // STRING
      name: 'language',
      description: 'Language to use (ko/en)',
      required: true,
      choices: [
        { name: 'English', value: 'en' },
        { name: '한국어', value: 'ko' },
      ],
    },
  ],
};

// Schedule meeting command (interactive GUI)
const SET_MEETING_TIME_COMMAND = {
  name: 'set-meeting-time',
  description: 'Schedule a meeting with interactive setup (회의 일정을 등록합니다)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Channel status command
const CHANNEL_STATUS_COMMAND = {
  name: 'channel-status',
  description: 'Show current channel settings for meetings and GitHub',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [
  SET_MEETING_TIME_COMMAND,
  LIST_MEETINGS_COMMAND,
  DELETE_MEETING_COMMAND,
  EDIT_MEETING_COMMAND,
  SET_MEETING_CHANNEL_COMMAND,
  SET_GITHUB_CHANNEL_COMMAND,
  SETUP_GITHUB_COMMAND,
  SET_LANGUAGE_COMMAND,
  CHANNEL_STATUS_COMMAND,
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
