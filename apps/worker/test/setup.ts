// Net-connect disabled: any outbound request that is not routed through an injected stub
// (createApp(deps).fetch) throws, so an unmocked call fails the test. Never a live call.
export const NET_GUARD_MESSAGE = 'net-connect disabled in tests: inject fetch via createApp(deps)';

globalThis.fetch = ((): never => {
  throw new Error(NET_GUARD_MESSAGE);
}) as unknown as typeof fetch;
