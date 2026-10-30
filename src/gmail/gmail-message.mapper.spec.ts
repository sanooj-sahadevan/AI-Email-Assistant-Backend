import { mapGmailMessage } from './gmail-message.mapper.js';

describe('mapGmailMessage', () => {
  it('maps message identifiers, sender, headers, dates, snippets, and plain text', () => {
    expect(
      mapGmailMessage({
        id: 'gmail-123',
        threadId: 'thread-456',
        internalDate: '1760000000000',
        snippet: 'Hello preview',
        payload: {
          headers: [
            { name: 'From', value: '"Ada Lovelace" <ada@example.com>' },
            { name: 'Subject', value: ' Hello ' },
          ],
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/html', body: { data: 'PGI+SGVsbG88L2I+' } },
            { mimeType: 'text/plain', body: { data: 'SGVsbG8=' } },
          ],
        },
      }),
    ).toEqual({
      gmailMessageId: 'gmail-123',
      threadId: 'thread-456',
      senderEmail: 'ada@example.com',
      senderName: 'Ada Lovelace',
      subject: 'Hello',
      snippet: 'Hello preview',
      body: 'Hello',
      receivedAt: new Date(1760000000000),
      isRead: true,
    });
  });

  it('handles missing fields without inventing message content', () => {
    expect(mapGmailMessage({ id: 'gmail-empty' })).toMatchObject({
      gmailMessageId: 'gmail-empty',
      threadId: null,
      senderEmail: null,
      senderName: null,
      subject: '(no subject)',
      snippet: null,
      body: null,
      receivedAt: new Date(0),
    });
    expect(mapGmailMessage({})).toBeNull();
  });

  it('does not decode HTML parts as message bodies', () => {
    expect(
      mapGmailMessage({
        id: 'gmail-html',
        payload: { mimeType: 'text/html', body: { data: 'PGgxPkhlbGxvPC9oMT4=' } },
      })?.body,
    ).toBeNull();
  });
});
