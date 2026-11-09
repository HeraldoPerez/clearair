/** An error that maps to an HTTP status and a message that's safe to show users. */
export class HttpError extends Error {
  constructor(status, message, options) {
    super(message, options);
    this.name = "HttpError";
    this.status = status;
  }
}

/** The point is outside the area the National Weather Service covers. */
export class NotCoveredError extends HttpError {
  constructor(message = "No weather forecast for this location. ClearAir only covers the US.") {
    super(404, message);
    this.name = "NotCoveredError";
  }
}

/** An upstream API failed or sent something we can't use. */
export class UpstreamError extends HttpError {
  constructor(message, { url, upstreamStatus, cause } = {}) {
    super(502, message, { cause });
    this.name = "UpstreamError";
    this.url = url;
    this.upstreamStatus = upstreamStatus;
  }
}
