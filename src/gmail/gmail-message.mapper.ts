import type { gmail_v1 } from 'googleapis';
import type { Prisma } from '@prisma/client';

type GmailHeader = gmail_v1.Schema$MessagePartHeader;
type GmailPart = gmail_v1.Schema$MessagePart;

function headerValue(
  headers: GmailHeader[] | null | undefined,
  name: string,
): string | undefined {
  return headers?.find((header) => header.name?.toLowerCase() === name)
    ?.value ?? undefined;
}

function parseSender(value: string | undefined): {
  senderEmail: string | null;
  senderName: string | null;
} {
  if (!value) {
    return { senderEmail: null, senderName: null };
  }

  const addressMatch = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (addressMatch) {
    const name = addressMatch[1].replace(/^["']|["']$/g, '').trim();
    return {
      senderEmail: addressMatch[2].trim() || null,
      senderName: name || null,
    };
  }

  return { senderEmail: value.trim() || null, senderName: null };
}

function decodePlainTextBody(part: GmailPart | undefined): string | null {
  if (!part) {
    return null;
  }

  if (
    part.filename ||
    part.mimeType?.toLowerCase() === 'text/html'
  ) {
    return null;
  }

  if (part.mimeType?.toLowerCase() === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }

  for (const child of part.parts ?? []) {
    const body = decodePlainTextBody(child);
    if (body !== null) {
      return body;
    }
  }

  return null;
}

function receivedAt(message: gmail_v1.Schema$Message): Date {
  const internalDate = Number(message.internalDate);
  if (Number.isFinite(internalDate) && internalDate >= 0) {
    return new Date(internalDate);
  }

  const headerDate = headerValue(message.payload?.headers, 'date');
  if (headerDate) {
    const parsedDate = new Date(headerDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date(0);
}

export function mapGmailMessage(
  message: gmail_v1.Schema$Message,
): Prisma.EmailCreateManyInput | null {
  if (!message.id) {
    return null;
  }

  const headers = message.payload?.headers;
  const sender = parseSender(headerValue(headers, 'from'));
  return {
    gmailMessageId: message.id,
    threadId: message.threadId ?? null,
    senderEmail: sender.senderEmail,
    senderName: sender.senderName,
    subject: headerValue(headers, 'subject')?.trim() || '(no subject)',
    snippet: message.snippet ?? null,
    body: decodePlainTextBody(message.payload),
    receivedAt: receivedAt(message),
    isRead: message.labelIds ? !message.labelIds.includes('UNREAD') : true,
  };
}
