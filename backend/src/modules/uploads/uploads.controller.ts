import { BadRequestException, Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { stat } from 'fs/promises';
import { join, resolve } from 'path';
import { RequirePermissions } from '../auth/permissions.decorator';

const MARKETING_POPUP_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

@Controller('uploads')
export class UploadsController {
  @Get('payment-proofs/:fileName')
  @RequirePermissions('subscriptions.manage')
  async getPaymentProof(@Param('fileName') fileName: string, @Res() response: any) {
    const cleanFileName = String(fileName || '').trim();
    if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|pdf|txt)$/i.test(cleanFileName)) {
      throw new BadRequestException('Invalid upload file name');
    }

    const uploadRoot = resolve(process.cwd(), 'uploads', 'payment-proofs');
    const filePath = resolve(join(uploadRoot, cleanFileName));
    if (!filePath.startsWith(`${uploadRoot}/`)) {
      throw new BadRequestException('Invalid upload path');
    }

    const fileStats = await stat(filePath).catch(() => null);
    if (!fileStats?.isFile()) {
      throw new NotFoundException('File not found');
    }

    response.setHeader('Content-Type', this.mimeTypeForPaymentProof(cleanFileName));
    response.setHeader('Content-Length', String(fileStats.size));
    response.setHeader('Content-Disposition', `attachment; filename="${cleanFileName.replace(/["\r\n]+/g, '_')}"`);
    response.setHeader('Cache-Control', 'private, max-age=60');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.sendFile(filePath);
  }

  @Get('marketing-popups/:fileName')
  async getMarketingPopupImage(@Param('fileName') fileName: string, @Res() response: any) {
    const cleanFileName = String(fileName || '').trim();
    if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(cleanFileName)) {
      throw new BadRequestException('Invalid upload file name');
    }

    const extension = cleanFileName.split('.').pop()?.toLowerCase() || '';
    const mimeType = MARKETING_POPUP_MIME_TYPES[extension];
    if (!mimeType) {
      throw new BadRequestException('Unsupported upload file type');
    }

    const uploadRoot = resolve(process.cwd(), 'uploads', 'marketing-popups');
    const filePath = resolve(join(uploadRoot, cleanFileName));
    if (!filePath.startsWith(`${uploadRoot}/`)) {
      throw new BadRequestException('Invalid upload path');
    }

    const fileStats = await stat(filePath).catch(() => null);
    if (!fileStats?.isFile()) {
      throw new NotFoundException('File not found');
    }

    response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Length', String(fileStats.size));
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.sendFile(filePath);
  }

  private mimeTypeForPaymentProof(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    if (extension === 'pdf') return 'application/pdf';
    if (extension === 'png') return 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    if (extension === 'txt') return 'text/plain; charset=utf-8';
    return 'application/octet-stream';
  }
}
