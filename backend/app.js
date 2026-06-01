'use strict';

const http = require('http');

function cleanErrorMessage(error) {
  return String(error && (error.message || error.stack) || error || 'Unknown backend startup error')
    .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^'",\s}&)]+/gi, '$1=[redacted]')
    .slice(0, 4000);
}

function startDiagnosticServer(error) {
  const message = cleanErrorMessage(error);
  console.error(error);

  const server = http.createServer((req, res) => {
    const body = JSON.stringify({
      ok: false,
      service: 'lms-api',
      status: 'startup_failed',
      message,
      timestamp: new Date().toISOString(),
    });

    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
  });

  server.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}

(async () => {
  try {
    const { bootstrap } = require('./dist/main');
    await bootstrap();
  } catch (error) {
    startDiagnosticServer(error);
  }
})();
