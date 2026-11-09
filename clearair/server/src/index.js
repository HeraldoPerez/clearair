import { createApp } from "./app.js";
import { createNwsClient } from "./nws.js";

const port = Number(process.env.PORT) || 3001;

// NWS asks apps to identify themselves. Put your own contact in .env if you deploy this.
const userAgent = process.env.NWS_USER_AGENT || "ClearAir (https://github.com/Khalick/clearair)";

const app = createApp({ nws: createNwsClient({ userAgent }) });

app.listen(port, () => {
  console.log(`ClearAir server listening on http://localhost:${port}`);
});
