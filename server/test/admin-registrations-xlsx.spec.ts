import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminRegistrationsController,
  AdminRegistrationsService,
} from '../src/admin-registrations';

const XLSX_BYTES = Buffer.from('PK\u0003\u0004native-xlsx');

function responseStub(): Response {
  return { setHeader: vi.fn() } as unknown as Response;
}

function streamBytes(file: StreamableFile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    file.getStream().on('data', (chunk: Buffer) => chunks.push(chunk));
    file.getStream().on('end', () => resolve(Buffer.concat(chunks)));
    file.getStream().on('error', reject);
  });
}

describe('AdminRegistrationsController XLSX exports', () => {
  it.each([
    ['registration', 'exportXlsx', 'registrations-jrc-xiv.xlsx'],
    ['attendance', 'exportAttendanceXlsx', 'attendance-jrc-xiv.xlsx'],
  ] as const)(
    'returns the %s workbook as raw StreamableFile bytes',
    async (_label, method, filename) => {
      const registrations = {
        [method]: vi.fn().mockResolvedValue(XLSX_BYTES),
      } as unknown as AdminRegistrationsService;
      const controller = new AdminRegistrationsController(registrations);
      const response = responseStub();

      const result = await controller[method]({}, response);

      expect(result).toBeInstanceOf(StreamableFile);
      expect(await streamBytes(result)).toEqual(XLSX_BYTES);
      expect((response.setHeader as ReturnType<typeof vi.fn>).mock.calls).toEqual([
        [
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        [
          'Content-Disposition',
          expect.stringContaining(filename),
        ],
      ]);
    },
  );
});
