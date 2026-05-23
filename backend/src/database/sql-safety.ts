import { BadRequestException } from '@nestjs/common';

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function sqlIdentifier(value: string, allowedValues?: Iterable<string>, label = 'SQL identifier') {
  const raw = String(value || '').trim();
  const allowed = allowedValues ? new Set(Array.from(allowedValues).map((item) => String(item))) : null;

  if (!raw || (allowed && !allowed.has(raw))) {
    throw new BadRequestException(`${label} is not allowed`);
  }

  const parts = raw.split('.');
  if (!parts.every((part) => SQL_IDENTIFIER_PATTERN.test(part))) {
    throw new BadRequestException(`${label} is invalid`);
  }

  return parts.map((part) => `\`${part}\``).join('.');
}

export function allowedSqlFragment(value: string, allowedValues: Iterable<string>, label = 'SQL fragment') {
  const raw = String(value || '').trim();
  const allowed = new Set(Array.from(allowedValues).map((item) => String(item)));
  if (!allowed.has(raw)) {
    throw new BadRequestException(`${label} is not allowed`);
  }
  return raw;
}

export function sqlPlaceholders(values: readonly unknown[]) {
  return values.map(() => '?').join(',');
}
