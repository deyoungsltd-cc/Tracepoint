// ============================================================
// TRACEPOINT — Scheduled Monitoring System
// Client-side scheduler that re-runs investigations at intervals.
// Persists schedules to localStorage. Works without a server cron.
// ============================================================

import { runRealInvestigation, type PipelineConfig, type PipelineCallbacks } from '@/lib/api/pipeline';
import type { Investigation, AIAssessment } from '@/lib/types';

export interface MonitorSchedule {
  id: string;
  label: string;
  config: PipelineConfig;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string;
  runCount: number;
  isActive: boolean;
  createdAt: string;
  latestInvestigationId: string | null;
}

export interface MonitorResult {
  scheduleId: string;
  investigation: Investigation;
  aiAssessment: AIAssessment | null;
  previousConfidence: number | null;
  confidenceDelta: number | null;
  hasNewEvidence: boolean;
  runNumber: number;
}

const STORAGE_KEY = 'tracepoint_monitor_schedules';
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
let resultCallback: ((result: MonitorResult) => void) | null = null;

// ---- Persistence ----

function loadSchedules(): MonitorSchedule[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveSchedules(schedules: MonitorSchedule[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

// ---- Schedule Management ----

/**
 * Create a new monitoring schedule.
 */
export function createSchedule(
  label: string,
  config: PipelineConfig,
  intervalMinutes: number
): MonitorSchedule {
  const schedule: MonitorSchedule = {
    id: crypto.randomUUID(),
    label,
    config,
    intervalMinutes: Math.max(5, intervalMinutes), // Minimum 5 minutes
    lastRunAt: null,
    nextRunAt: new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString(),
    runCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    latestInvestigationId: null,
  };

  const schedules = loadSchedules();
  schedules.push(schedule);
  saveSchedules(schedules);

  // Start the timer
  startScheduleTimer(schedule);

  return schedule;
}

/**
 * List all monitoring schedules.
 */
export function listSchedules(): MonitorSchedule[] {
  return loadSchedules();
}

/**
 * Activate or pause a schedule.
 */
export function toggleSchedule(scheduleId: string, isActive: boolean): MonitorSchedule | null {
  const schedules = loadSchedules();
  const idx = schedules.findIndex(s => s.id === scheduleId);
  if (idx === -1) return null;

  schedules[idx].isActive = isActive;
  if (isActive) {
    schedules[idx].nextRunAt = new Date(Date.now() + schedules[idx].intervalMinutes * 60 * 1000).toISOString();
    startScheduleTimer(schedules[idx]);
  } else {
    stopScheduleTimer(scheduleId);
  }

  saveSchedules(schedules);
  return schedules[idx];
}

/**
 * Delete a schedule.
 */
export function deleteSchedule(scheduleId: string): boolean {
  stopScheduleTimer(scheduleId);
  const schedules = loadSchedules().filter(s => s.id !== scheduleId);
  saveSchedules(schedules);
  return true;
}

/**
 * Manually trigger a schedule run.
 */
export async function runScheduleNow(scheduleId: string): Promise<MonitorResult | null> {
  const schedules = loadSchedules();
  const schedule = schedules.find(s => s.id === scheduleId);
  if (!schedule) return null;

  return executeScheduleRun(schedule);
}

/**
 * Set a callback for monitoring results.
 */
export function onMonitorResult(callback: (result: MonitorResult) => void): void {
  resultCallback = callback;
}

/**
 * Initialize all active schedules on page load.
 */
export function initMonitoring(): void {
  const schedules = loadSchedules().filter(s => s.isActive);
  for (const schedule of schedules) {
    // Recalculate nextRunAt if it's in the past
    const nextRun = new Date(schedule.nextRunAt);
    if (nextRun.getTime() < Date.now()) {
      schedule.nextRunAt = new Date(Date.now() + schedule.intervalMinutes * 60 * 1000).toISOString();
      const allSchedules = loadSchedules();
      const idx = allSchedules.findIndex(s => s.id === schedule.id);
      if (idx >= 0) {
        allSchedules[idx].nextRunAt = schedule.nextRunAt;
        saveSchedules(allSchedules);
      }
    }
    startScheduleTimer(schedule);
  }
}

/**
 * Stop all active timers.
 */
export function stopAllMonitoring(): void {
  for (const [id] of activeTimers) {
    stopScheduleTimer(id);
  }
}

// ---- Internal ----

function startScheduleTimer(schedule: MonitorSchedule): void {
  stopScheduleTimer(schedule.id);

  const delay = Math.max(5000, new Date(schedule.nextRunAt).getTime() - Date.now());
  const timer = setTimeout(() => {
    executeScheduleRun(schedule);
  }, delay);

  activeTimers.set(schedule.id, timer);
}

function stopScheduleTimer(scheduleId: string): void {
  const timer = activeTimers.get(scheduleId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(scheduleId);
  }
}

async function executeScheduleRun(schedule: MonitorSchedule): Promise<MonitorResult | null> {
  const schedules = loadSchedules();
  const idx = schedules.findIndex(s => s.id === schedule.id);
  if (idx === -1) return null;

  const prevConfidence = schedules[idx].latestInvestigationId
    ? null // Could look up previous investigation confidence
    : null;

  const callbacks: PipelineCallbacks = {
    onProgress: () => {}, // Silent mode for monitoring
  };

  try {
    const { investigation, aiAssessment } = await runRealInvestigation(schedule.config, callbacks);

    // Update schedule
    schedules[idx].lastRunAt = new Date().toISOString();
    schedules[idx].nextRunAt = new Date(Date.now() + schedules[idx].intervalMinutes * 60 * 1000).toISOString();
    schedules[idx].runCount++;
    schedules[idx].latestInvestigationId = investigation.id;
    saveSchedules(schedules);

    // Reschedule next run
    if (schedules[idx].isActive) {
      startScheduleTimer(schedules[idx]);
    }

    const result: MonitorResult = {
      scheduleId: schedule.id,
      investigation,
      aiAssessment,
      previousConfidence: prevConfidence,
      confidenceDelta: prevConfidence !== null ? (investigation.confidence || 0) - prevConfidence : null,
      hasNewEvidence: true, // Simplified — always true on new run
      runNumber: schedules[idx].runCount,
    };

    resultCallback?.(result);
    return result;
  } catch (err) {
    console.error(`[Monitor] Schedule ${schedule.id} run failed:`, err);
    // Reschedule even on failure
    schedules[idx].nextRunAt = new Date(Date.now() + schedules[idx].intervalMinutes * 60 * 1000).toISOString();
    saveSchedules(schedules);
    if (schedules[idx].isActive) {
      startScheduleTimer(schedules[idx]);
    }
    return null;
  }
}
