/**
 * @fileoverview Discord slash command definitions for Rundee Bot
 * @copyright Rundee 2024
 * @license MIT
 */

import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Meeting command with subcommands
const MEETING_COMMAND = {
  name: 'meeting',
  description: '회의 일정 관리 (Manage meetings)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    // list subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'list',
      description: '등록된 회의 일정 목록을 보여줍니다 (Show list of scheduled meetings)',
    },
    // create subcommand (single meeting)
    {
      type: 1, // SUB_COMMAND
      name: 'create',
      description: '단일 회의 일정을 등록합니다 (Schedule a single meeting)',
      options: [
        {
          type: 3, // STRING
          name: 'title',
          description: 'Meeting title (회의 제목)',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'date',
          description: 'Date & time (YYYY-MM-DD HH:mm) (예: 2024-12-25 14:30)',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'participants',
          description: 'Participants (@mentions or @role mentions) (참석자)',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'reminder_minutes',
          description: 'Reminder minutes before meeting (comma-separated) (예: 1,5,10)',
          required: false,
        },
      ],
    },
    // create-recurring subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'create-recurring',
      description: '반복 회의 일정을 등록합니다 (Schedule a recurring meeting)',
      options: [
        {
          type: 3, // STRING
          name: 'title',
          description: 'Meeting title (회의 제목)',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'time',
          description: 'Time (HH:mm) (예: 14:30)',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'participants',
          description: 'Participants (@mentions or @role mentions) (참석자)',
          required: true,
        },
        {
          type: 3, // STRING
          name: 'repeat_type',
          description: 'Repeat type (반복 주기)',
          required: true,
          choices: [
            { name: 'Daily', value: 'daily' },
            { name: 'Weekly', value: 'weekly' },
            { name: 'Bi-weekly', value: 'biweekly' },
            { name: 'Monthly (Day)', value: 'monthly_day' },
            { name: 'Monthly (Weekday)', value: 'monthly_weekday' },
          ],
        },
        {
          type: 4, // INTEGER
          name: 'weekday',
          description: 'Weekday (0=Sunday, 1=Monday, ..., 6=Saturday) (weekly/biweekly/monthly_weekday 필수)',
          required: false,
        },
        {
          type: 4, // INTEGER
          name: 'day_of_month',
          description: 'Day of month (1-31) (monthly_day 필수)',
          required: false,
        },
        {
          type: 4, // INTEGER
          name: 'week_of_month',
          description: 'Week of month (1-4, or -1 for last week) (monthly_weekday 필수)',
          required: false,
        },
        {
          type: 3, // STRING
          name: 'exclude_weekdays',
          description: 'Exclude weekdays for daily meetings (comma-separated: 0=Sun,1=Mon,...,6=Sat) (daily 타입에서만 사용)',
          required: false,
        },
        {
          type: 3, // STRING
          name: 'reminder_minutes',
          description: 'Reminder minutes before meeting (comma-separated) (예: 1,5,10)',
          required: false,
        },
        {
          type: 3, // STRING
          name: 'repeat_end_date',
          description: 'Repeat end date (YYYY-MM-DD) (반복 종료 날짜)',
          required: false,
        },
      ],
    },
    // edit subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'edit',
      description: '회의 일정을 수정합니다 (Edit a meeting schedule)',
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
    },
    // delete subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'delete',
      description: '회의 일정을 삭제합니다 (Delete a scheduled meeting)',
      options: [
        {
          type: 4, // INTEGER
          name: 'meeting_id',
          description: '삭제할 회의 ID (meeting list로 확인 가능)',
          required: true,
        },
      ],
    },
    // channel subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'channel',
      description: '회의 알림을 받을 채널을 설정합니다 (Set channel for meeting announcements)',
      options: [
        {
          type: 7, // CHANNEL
          name: 'channel',
          description: '회의 알림을 받을 채널 (기본값: 현재 채널)',
          required: false,
        },
      ],
    },
  ],
};

// GitHub command with subcommands
const GITHUB_COMMAND = {
  name: 'github',
  description: 'GitHub 통합 관리 (Manage GitHub integration)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    // setup subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'setup',
      description: 'GitHub 웹훅을 설정합니다 (Setup GitHub webhook)',
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
    },
    // channel subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'channel',
      description: 'GitHub 알림을 받을 채널을 설정합니다 (Set channel for GitHub announcements)',
      options: [
        {
          type: 7, // CHANNEL
          name: 'channel',
          description: 'GitHub 알림을 받을 채널 (기본값: 현재 채널)',
          required: false,
        },
      ],
    },
    // status subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'status',
      description: 'GitHub 설정 상태를 확인합니다 (Check GitHub settings status)',
    },
  ],
};

// Config command with subcommands
const CONFIG_COMMAND = {
  name: 'config',
  description: '봇 설정 관리 (Manage bot configuration)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    // language subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'language',
      description: '봇 언어를 설정합니다 (Set the bot language)',
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
    },
    // status subcommand
    {
      type: 1, // SUB_COMMAND
      name: 'status',
      description: '현재 채널 설정을 확인합니다 (Show current channel settings)',
    },
  ],
};

const ALL_COMMANDS = [
  MEETING_COMMAND,
  GITHUB_COMMAND,
  CONFIG_COMMAND,
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
