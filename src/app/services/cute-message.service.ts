import { Injectable } from '@angular/core';

const MESSAGES = [
  'You are someone\'s reason to smile today.',
  'The world is brighter because you\'re in it.',
  'You are enough, exactly as you are.',
  'Your kindness creates ripples you\'ll never fully see.',
  'Today is going to be a beautiful day — just like you.',
  'You are loved more than you know.',
  'Somewhere, someone is thinking of how wonderful you are.',
  'You make ordinary moments feel extraordinary.',
  'Your smile can light up the darkest room.',
  'You are a gift to everyone lucky enough to know you.',
  'Every day with you in it is a good day.',
  'You have a way of making everything feel okay.',
  'The best is yet to come, and you deserve all of it.',
  'You are stronger, braver, and more beautiful than you believe.',
  'Just a little reminder: you are absolutely wonderful.'
];

@Injectable({ providedIn: 'root' })
export class CuteMessageService {

  /** Returns the message assigned to today — same for the whole day, changes at midnight. */
  getMessage(): string {
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return MESSAGES[dayIndex % MESSAGES.length];
  }

  /** Milliseconds until the next midnight (local time). */
  msUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return midnight.getTime() - now.getTime();
  }
}
