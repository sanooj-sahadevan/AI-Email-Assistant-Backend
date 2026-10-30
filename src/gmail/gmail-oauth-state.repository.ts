export abstract class GmailOAuthStateRepository {
  abstract create(
    stateHash: string,
    sessionId: string,
    expiresAt: Date,
  ): Promise<void>;
  abstract consume(
    stateHash: string,
    sessionId: string,
  ): Promise<boolean>;
}
