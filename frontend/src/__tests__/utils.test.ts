// ============================================
// 工具函数单元测试
// ============================================
// 测试 src/components/ui/Common.tsx 中的纯工具函数：
// formatMoney, formatDate, formatMonth
//
// 这些是纯函数，无外部依赖，不需要 mock
// ============================================

import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatMonth } from '../components/ui/Common';

// ---------------------------------------------------------------------------
// formatMoney 测试
// ---------------------------------------------------------------------------

describe('formatMoney', () => {
  describe('happy path', () => {
    it('formats integer amounts with default prefix', () => {
      expect(formatMoney(1234)).toBe('¥1,234.00');
    });

    it('formats decimal amounts', () => {
      expect(formatMoney(1234567.89)).toBe('¥1,234,567.89');
    });

    it('formats amounts with custom prefix', () => {
      expect(formatMoney(1000, '$')).toBe('$1,000.00');
      expect(formatMoney(5000, '')).toBe('5,000.00');
    });

    it('formats string amounts', () => {
      expect(formatMoney('9999.99')).toBe('¥9,999.99');
    });

    it('formats zero', () => {
      expect(formatMoney(0)).toBe('¥0.00');
    });

    it('formats large amounts with correct grouping', () => {
      expect(formatMoney(10000000)).toBe('¥10,000,000.00');
    });
  });

  describe('edge cases', () => {
    it('handles undefined', () => {
      expect(formatMoney(undefined)).toBe('¥0.00');
    });

    it('handles null (via assertion)', () => {
      // The function checks undefined, null, and empty string
      const result = formatMoney(null as unknown as undefined);
      expect(result).toBe('¥0.00');
    });

    it('handles empty string', () => {
      // formatMoney checks === '', so pass it as a string
      expect(formatMoney('')).toBe('¥0.00');
    });

    it('handles NaN string', () => {
      expect(formatMoney('not-a-number')).toBe('¥0.00');
    });

    it('handles negative numbers', () => {
      // toLocaleString places the sign before the number, after the prefix
      expect(formatMoney(-1234.56)).toBe('¥-1,234.56');
    });
  });
});

// ---------------------------------------------------------------------------
// formatDate 测试
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  describe('happy path', () => {
    it('formats a Date object with default format', () => {
      const result = formatDate(new Date('2024-03-15T10:30:00'));
      expect(result).toBe('2024-03-15');
    });

    it('formats an ISO date string', () => {
      const result = formatDate('2024-12-25T08:00:00Z');
      expect(result).toMatch(/^2024-12-25/);
    });

    it('formats with custom YYYY年MM月DD日 format', () => {
      const result = formatDate(
        new Date('2024-06-01'),
        'YYYY年MM月DD日'
      );
      expect(result).toBe('2024年06月01日');
    });

    it('formats with time', () => {
      const result = formatDate(
        new Date('2024-01-15T14:30:45'),
        'YYYY-MM-DD HH:mm:ss'
      );
      expect(result).toBe('2024-01-15 14:30:45');
    });
  });

  describe('edge cases', () => {
    it('returns placeholder for undefined input', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('returns placeholder for null input', () => {
      expect(formatDate(null)).toBe('-');
    });

    it('returns placeholder for invalid date string', () => {
      expect(formatDate('invalid-date')).toBe('-');
    });

    it('returns placeholder for empty string', () => {
      expect(formatDate('')).toBe('-');
    });
  });
});

// ---------------------------------------------------------------------------
// formatMonth 测试
// ---------------------------------------------------------------------------

describe('formatMonth', () => {
  describe('happy path', () => {
    it('formats YYYY-MM to Chinese format', () => {
      expect(formatMonth('2024-01')).toBe('2024年01月');
    });

    it('formats December', () => {
      expect(formatMonth('2024-12')).toBe('2024年12月');
    });
  });

  describe('edge cases', () => {
    it('returns placeholder for undefined', () => {
      expect(formatMonth(undefined)).toBe('-');
    });

    it('returns placeholder for null', () => {
      expect(formatMonth(null)).toBe('-');
    });

    it('returns original string if format is unexpected', () => {
      expect(formatMonth('202401')).toBe('202401');
    });

    it('returns original for non-month string', () => {
      expect(formatMonth('hello')).toBe('hello');
    });
  });
});
