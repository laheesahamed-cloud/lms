'use strict';

const { bootstrap } = require('./dist/main');

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
