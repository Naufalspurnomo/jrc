import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const config = readFileSync(resolve(__dirname, '../deploy/apache-jrc.conf'), 'utf8');

type ActiveDirective = { line: string; offset: number };
type Range = { body: string; start: number; end: number };

function logicalLines(source: string): ActiveDirective[] {
  const lines: ActiveDirective[] = [];
  let logical = '';
  let logicalOffset = 0;
  let offset = 0;
  let continuedComment = false;

  for (const physical of source.match(/.*(?:\r?\n|$)/g) ?? []) {
    if (physical === '') continue;
    const line = physical.replace(/\r?\n$/, '');
    const trimmedPhysical = line.trim();

    if (continuedComment) {
      if (trimmedPhysical !== '' && !trimmedPhysical.startsWith('#')) {
        throw new Error(`Ambiguous active directive after continued comment: ${trimmedPhysical}`);
      }
      continuedComment = /\\\s*$/.test(line);
      offset += physical.length;
      continue;
    }

    if (logical === '' && trimmedPhysical.startsWith('#')) {
      continuedComment = /\\\s*$/.test(line);
      offset += physical.length;
      continue;
    }

    if (logical === '') logicalOffset = offset;
    const continued = /\\\s*$/.test(line);
    const fragment = continued ? line.replace(/\\\s*$/, '') : line;
    logical += `${logical === '' ? '' : ' '}${fragment.trim()}`;

    if (!continued) {
      const trimmed = logical.trim();
      if (trimmed !== '') lines.push({ line: trimmed, offset: logicalOffset });
      logical = '';
    }
    offset += physical.length;
  }

  if (logical.trim() !== '') lines.push({ line: logical.trim(), offset: logicalOffset });
  return lines;
}

function activeDirectives(source: string, name: string): ActiveDirective[] {
  const pattern = new RegExp(`^${name}\\b`, 'i');
  return logicalLines(source).filter(({ line }) => pattern.test(line));
}

function virtualHost(source: string, port: 80 | 443): Range {
  const match = new RegExp(`<VirtualHost\\s+\\*:(${port})>([\\s\\S]*?)<\\/VirtualHost>`, 'i').exec(
    source,
  );
  if (!match || match.index === undefined) throw new Error(`Missing port-${port} virtual host`);

  return { body: match[2], start: match.index, end: match.index + match[0].length };
}

function parseNamedLogFormat(line: string): { format: string; name: string } | undefined {
  const match = /^LogFormat\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s+(\S+)\s*$/i.exec(line);
  if (!match) return undefined;
  return { format: match[1] ?? match[2], name: match[3] };
}

const canonicalLogFormat = String.raw`%a %l %u %t \"%m %U %H\" %>s %b`;

function semanticLogFormat(format: string): string[] {
  return format.trim().split(/\s+/);
}

function assertProductionContract(source: string): void {
  const http = virtualHost(source, 80);
  const https = virtualHost(source, 443);
  const inRange = (offset: number, range: Range) => offset >= range.start && offset < range.end;
  const isInVirtualHost = (offset: number) => inRange(offset, http) || inRange(offset, https);

  const traceDirectives = activeDirectives(source, 'TraceEnable');
  expect(traceDirectives).toHaveLength(1);
  expect(traceDirectives[0].line).toMatch(/^TraceEnable\s+Off\s*$/i);
  expect(isInVirtualHost(traceDirectives[0].offset)).toBe(false);

  const hstsDirectives = activeDirectives(source, 'Header').filter(({ line }) =>
    /\bStrict-Transport-Security\b/i.test(line),
  );
  expect(hstsDirectives).toHaveLength(1);
  expect(inRange(hstsDirectives[0].offset, https)).toBe(true);
  const hsts = hstsDirectives[0].line.match(
    /^Header\s+always\s+set\s+Strict-Transport-Security\s+"([^"]+)"\s*$/i,
  )?.[1];
  expect(hsts).toBeDefined();
  expect(Number(hsts?.match(/(?:^|;)\s*max-age=(\d+)\s*(?:;|$)/i)?.[1])).toBeGreaterThanOrEqual(
    31_536_000,
  );
  expect(hsts).toMatch(/(?:^|;)\s*includeSubDomains\s*(?:;|$)/i);

  expect(http.body).toMatch(/^\s*Redirect\s+permanent\s+\/\s+https:\/\//m);
  expect(activeDirectives(source, 'TransferLog')).toHaveLength(0);
  expect(activeDirectives(source, 'GlobalLog')).toHaveLength(0);
  expect(activeDirectives(source, 'Include')).toHaveLength(0);
  expect(activeDirectives(source, 'IncludeOptional')).toHaveLength(0);

  const logFormats = activeDirectives(source, 'LogFormat');
  expect(logFormats).toHaveLength(1);
  const parsedLogFormat = parseNamedLogFormat(logFormats[0].line);
  expect(
    parsedLogFormat,
    `LogFormat must have a quoted format and explicit name: ${logFormats[0].line}`,
  ).toBeDefined();
  expect(parsedLogFormat?.name).toBe('jrc_no_query');
  expect(semanticLogFormat(parsedLogFormat?.format ?? '')).toEqual(
    semanticLogFormat(canonicalLogFormat),
  );

  const customLogs = activeDirectives(source, 'CustomLog');
  expect(customLogs).toHaveLength(1);
  expect(customLogs[0].line).toMatch(
    /^CustomLog\s+\$\{APACHE_LOG_DIR\}\/jrc-access\.log\s+jrc_no_query\s*$/,
  );
}

const mutants = [
  ['global HSTS', `Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"\n${config}`],
  [
    'HTTP HSTS',
    config.replace(
      '<VirtualHost *:80>',
      '<VirtualHost *:80>\n    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    ),
  ],
  ['later TRACE override', `${config}\nTraceEnable On\n`],
  [
    '%q LogFormat',
    config.replace('</VirtualHost>', '    LogFormat "%m %U%q" query_log\n</VirtualHost>'),
  ],
  [
    'query-bearing CustomLog',
    config.replace(
      '</VirtualHost>',
      '    CustomLog ${APACHE_LOG_DIR}/query-access.log "%m %U%q"\n</VirtualHost>',
    ),
  ],
  [
    '%r LogFormat',
    config.replace('</VirtualHost>', '    LogFormat "%a %r" request_line\n</VirtualHost>'),
  ],
  [
    'combined CustomLog',
    config.replace(
      '</VirtualHost>',
      '    CustomLog ${APACHE_LOG_DIR}/alternate-access.log combined\n</VirtualHost>',
    ),
  ],
  [
    'TransferLog',
    config.replace('</VirtualHost>', '    TransferLog ${APACHE_LOG_DIR}/transfer.log\n</VirtualHost>'),
  ],
  [
    'backslash-continued duplicate HSTS',
    config.replace(
      '    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"',
      '    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"\n    Header always set \\\n      Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    ),
  ],
  ['backslash-continued TRACE override', `${config}\nTraceEnable \\\n  On\n`],
  [
    '%Q LogFormat',
    config.replace('</VirtualHost>', '    LogFormat "%m %U%Q" raw_query_log\n</VirtualHost>'),
  ],
  [
    'unnamed LogFormat',
    config.replace('</VirtualHost>', '    LogFormat "%a %m %U"\n</VirtualHost>'),
  ],
  [
    'unknown named CustomLog',
    config.replace(
      '</VirtualHost>',
      '    CustomLog ${APACHE_LOG_DIR}/alternate-access.log unknown_safe_format\n</VirtualHost>',
    ),
  ],
  [
    'request-target LogFormat',
    config.replace(
      '</VirtualHost>',
      '    LogFormat "%a %{REQUEST_URI}e" request_target_log\n</VirtualHost>',
    ),
  ],
  [
    'referrer LogFormat',
    config.replace('</VirtualHost>', '    LogFormat "%a %{Referer}i" referrer_log\n</VirtualHost>'),
  ],
  [
    'Cookie request-header LogFormat',
    config.replace('%m %U %H', '%m %{Cookie}i %H'),
  ],
  [
    'Authorization request-header LogFormat',
    config.replace('%m %U %H', '%m %{Authorization}i %H'),
  ],
  [
    'X-Original-URL request-header LogFormat',
    config.replace('%m %U %H', '%m %{X-Original-URL}i %H'),
  ],
  [
    'X-Rewrite-URL request-header LogFormat',
    config.replace('%m %U %H', '%m %{X-Rewrite-URL}i %H'),
  ],
  [
    'QUERY_COPY environment LogFormat',
    config.replace('%m %U %H', '%m %{QUERY_COPY}e %H'),
  ],
  [
    'QUERY_COPY note LogFormat',
    config.replace('%m %U %H', '%m %{QUERY_COPY}n %H'),
  ],
  [
    'extra safe-looking LogFormat',
    config.replace('</VirtualHost>', '    LogFormat "%a %m %U" alternate_safe_log\n</VirtualHost>'),
  ],
  [
    'extra CustomLog using jrc_no_query',
    config.replace(
      '</VirtualHost>',
      '    CustomLog ${APACHE_LOG_DIR}/alternate-access.log jrc_no_query\n</VirtualHost>',
    ),
  ],
  ['GlobalLog with predefined combined', `${config}\nGlobalLog /var/log/apache2/global.log combined\n`],
  ['GlobalLog with inline %r', `${config}\nGlobalLog /var/log/apache2/global.log "%a %r"\n`],
  ['backslash-continued GlobalLog', `${config}\nGlobalLog \\\n  /var/log/apache2/global.log combined\n`],
  ['Include of an external file', `${config}\nInclude /etc/apache2/conf-enabled/external.conf\n`],
  ['IncludeOptional glob', `${config}\nIncludeOptional /etc/apache2/conf-enabled/*.conf\n`],
  [
    'directive after a backslash-continued comment',
    `${config}\n# seemingly continued comment \\\nGlobalLog /var/log/apache2/hidden.log combined\n`,
  ],
] as const;

describe('production Apache configuration', () => {
  it('enforces the complete production security and query-free logging contract', () => {
    assertProductionContract(config);
  });

  it('allows harmless whitespace normalization inside the canonical LogFormat', () => {
    const whitespaceNormalized = config.replace(
      '%a %l %u %t \\"%m %U %H\\" %>s %b',
      '%a  %l\t%u   %t \\"%m\t%U  %H\\"   %>s\t%b',
    );
    expect(whitespaceNormalized).not.toBe(config);
    assertProductionContract(whitespaceNormalized);
  });

  it.each(mutants)('rejects the %s mutant', (_name, mutant) => {
    expect(() => assertProductionContract(mutant)).toThrow();
  });
});
