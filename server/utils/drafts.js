const fs = require('fs');
const path = require('path');
const logger = require('./logger');

async function saveDraft(caseId, formId, buffer, req) {
  if (!buffer || buffer.length === 0) {
    logger.warn('draft_invalid_pdf', {
      caseId,
      formId,
      reason: 'empty_buffer',
      requestId: req.id,
    });
    return undefined;
  }
  const pdfSignature = buffer.slice(0, 5).toString() === '%PDF-';
  if (!pdfSignature) {
    logger.warn('draft_invalid_pdf', {
      caseId,
      formId,
      reason: 'invalid_signature',
      requestId: req.id,
    });
    return undefined;
  }
  if (process.env.DRAFTS_S3_BUCKET) {
    try {
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const client = new S3Client();
      const key = `${caseId}/${formId}.pdf`;
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.DRAFTS_S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
        }),
      );
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: process.env.DRAFTS_S3_BUCKET, Key: key }),
        { expiresIn: 3600 },
      );
      logger.info('draft_saved', {
        caseId,
        formId,
        path: `s3://${process.env.DRAFTS_S3_BUCKET}/${key}`,
        size: buffer.length,
        pdfSignature,
        requestId: req.id,
      });
      return url;
    } catch (err) {
      logger.warn('draft_url_generation_failed', {
        caseId,
        formId,
        error: err.stack,
        requestId: req.id,
      });
      return undefined;
    }
  }
  const draftsDir = process.env.DRAFTS_DIR || '/tmp/forms';
  const filePath = path.join(draftsDir, caseId, `${formId}.pdf`);
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, buffer);
    const stat = await fs.promises.stat(filePath);
    if (!stat.size) {
      await fs.promises.unlink(filePath).catch(() => {});
      logger.warn('draft_invalid_pdf', {
        caseId,
        formId,
        reason: 'empty_file',
        requestId: req.id,
      });
      return undefined;
    }
    logger.info('draft_saved', {
      caseId,
      formId,
      path: filePath,
      size: stat.size,
      pdfSignature,
      requestId: req.id,
    });
  } catch (err) {
    logger.error('form_fill_file_write_failed', {
      caseId,
      formId,
      error: err.stack,
      requestId: req.id,
    });
    return undefined;
  }
  try {
    const baseUrl = process.env.DRAFTS_BASE_URL;
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, '')}/${caseId}/${formId}.pdf`;
    }
    const host = req.get ? req.get('host') : 'localhost';
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}/forms/${caseId}/${formId}.pdf`;
  } catch (err) {
    logger.warn('draft_url_generation_failed', {
      caseId,
      formId,
      error: err.stack,
      requestId: req.id,
    });
    return undefined;
  }
}

module.exports = { saveDraft };
