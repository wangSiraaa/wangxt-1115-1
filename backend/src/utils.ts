import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function generateNo(prefix: string): string {
  const now = dayjs();
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${now.format('YYYYMMDDHHmmss')}${rand}`;
}

export function calcExpiryDays(expiryDate: string): number {
  const today = dayjs().startOf('day');
  const expiry = dayjs(expiryDate).startOf('day');
  return expiry.diff(today, 'day');
}

export function isExpired(expiryDate: string): boolean {
  return calcExpiryDays(expiryDate) < 0;
}

export function isExpiring(expiryDate: string, thresholdDays: number = 30): boolean {
  const days = calcExpiryDays(expiryDate);
  return days >= 0 && days <= thresholdDays;
}
