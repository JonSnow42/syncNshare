import { MongoMemoryServer } from 'mongodb-memory-server';

async function startLocalDev() {
  console.log('\n======================================================');
  console.log('Starting ephemeral local development MongoDB instance...');
  console.log('======================================================\n');

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'development';

  console.log(`[Local Dev DB] Ephemeral MongoDB running at: ${uri}`);
  console.log('[Local Dev DB] Ready for manual browser testing.\n');

  // Dynamically import bootstrap
  await import('./index');

  const cleanExit = async () => {
    console.log('\nStopping local database...');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);
}

startLocalDev().catch((err) => {
  console.error('Failed to start local dev server:', err);
  process.exit(1);
});
