interface ConsentClient {
  assertConsentReady(): Promise<void>;
  createSession(): Promise<{ sessionId: string }>;
  acceptConsent(sessionId: string): Promise<unknown>;
}

export async function startConsentedSession(client: ConsentClient) {
  // Verify the visible version and full text before creating even an empty visitor session.
  await client.assertConsentReady();
  const created = await client.createSession();
  await client.acceptConsent(created.sessionId);
  return created;
}
