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

export function calcExpiryGrade(expiryDays: number): 'critical' | 'warning' | 'normal' {
  if (expiryDays < 0) return 'critical';
  if (expiryDays <= 7) return 'critical';
  if (expiryDays <= 15) return 'warning';
  return 'normal';
}

export function getExpiryGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    critical: '紧急(≤7天)',
    warning: '预警(8-15天)',
    normal: '正常(>15天)',
    expired: '已过期'
  };
  return labels[grade] || grade;
}

export function getCategoryDefaultStrategy(category: string, isRefrigerated: number, expiryDays: number): 'promotion' | 'allocation' | 'pending' {
  if (expiryDays <= 7) {
    return 'promotion';
  }
  if (isRefrigerated === 1 && expiryDays <= 10) {
    return 'promotion';
  }
  const dairyCategories = ['乳制品', '冷冻食品', '肉制品'];
  if (dairyCategories.includes(category)) {
    return expiryDays <= 10 ? 'promotion' : 'allocation';
  }
  const longShelfCategories = ['方便食品', '休闲食品', '饮料'];
  if (longShelfCategories.includes(category)) {
    return 'allocation';
  }
  return 'allocation';
}

export function getProcessStrategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    promotion: "门店促销",
    allocation: "跨店调拨",
    review: "人工复核"
  };
  return labels[strategy] || strategy;
}

export function getCategoryDefaultStrategy(category: string, isRefrigerated: number, expiryDays: number): string {
  if (isRefrigerated === 1 && expiryDays <= 3) {
    return "promotion";
  }
  const dairyCategories = ["乳制品", "冷冻食品"];
  if (dairyCategories.includes(category)) {
    return expiryDays <= 7 ? "promotion" : "allocation";
  }
  const longShelfCategories = ["方便食品", "休闲食品", "饮料"];
  if (longShelfCategories.includes(category)) {
    return "allocation";
  }
  return "review";
}

