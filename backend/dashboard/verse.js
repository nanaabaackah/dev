export const createGetDashboardVerseHandler =
  ({ getDashboardVerseOfDayPayload }) =>
  async (_req, res) => {
    const payload = await getDashboardVerseOfDayPayload();
    res.json(payload);
  };
