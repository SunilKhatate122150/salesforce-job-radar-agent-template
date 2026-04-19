import handler from '../../src/webServer.js';

export default async function(req, res) {
  // Specifically handle study sessions
  return handler(req, res);
}
