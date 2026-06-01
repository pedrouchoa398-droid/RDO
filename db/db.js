/**
 * Database Layer - IndexedDB Core Management
 * Handles database initialization, versioning, and migrations
 * 
 * Version History:
 * v1: Initial schema (projects, teams, settings, drafts, reports)
 * v2: Added indexes for better query performance
 */

const DB_NAME = 'RDO_DB';
const DB_VERSION = 2;

/**
 * Store definitions with their schemas
 */
const STORES = {
  reports: {
    name: 'reports',
    keyPath: 'id',
    indexes: [
      { name: 'date', keyPath: 'date' },
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'createdAt', keyPath: 'createdAt' }
    ]
  },
  projects: {
    name: 'projects',
    keyPath: 'id',
    indexes: [
      { name: 'name', keyPath: 'name', unique: false }
    ]
  },
  teams: {
    name: 'teams',
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' }
    ]
  },
  settings: {
    name: 'settings',
    keyPath: 'key',
    indexes: []
  },
  drafts: {
    name: 'drafts',
    keyPath: 'id',
    indexes: [
      { name: 'projectId', keyPath: 'projectId' },
      { name: 'lastModified', keyPath: 'lastModified' }
    ]
  },
  logos: {
    name: 'logos',
    keyPath: 'projectId',
    indexes: []
  }
};

let dbInstance = null;

/**
 * Initialize or upgrade database
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database failed to open:', request.error);
      reject(new Error(`Database error: ${request.error.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log(`Database opened successfully at v${DB_VERSION}`);
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;

      console.log(`Upgrading database from v${oldVersion} to v${newVersion}`);

      // Create or update stores
      Object.values(STORES).forEach(storeConfig => {
        // Drop existing store if upgrading (except for migration scenarios)
        if (db.objectStoreNames.contains(storeConfig.name)) {
          if (oldVersion < 2) {
            db.deleteObjectStore(storeConfig.name);
          }
        }

        // Create store if it doesn't exist
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const store = db.createObjectStore(storeConfig.name, {
            keyPath: storeConfig.keyPath
          });

          // Create indexes
          storeConfig.indexes.forEach(index => {
            store.createIndex(
              index.name,
              index.keyPath,
              { unique: index.unique || false }
            );
          });

          console.log(`Created store: ${storeConfig.name}`);
        }
      });

      // Version-specific migrations
      if (oldVersion < 1) {
        console.log('Initializing database schema');
      }
      if (oldVersion < 2) {
        console.log('Adding performance indexes');
      }
    };
  });
}

/**
 * Get database instance (lazy initialization)
 */
export async function getDB() {
  if (!dbInstance) {
    await initializeDatabase();
  }
  return dbInstance;
}

/**
 * Execute transaction on database
 */
export async function executeTransaction(
  storeNames,
  mode = 'readonly',
  callback
) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeNames, mode);

      transaction.onerror = () => {
        reject(new Error(`Transaction error: ${transaction.error.message}`));
      };

      transaction.oncomplete = () => {
        resolve();
      };

      // Execute callback with transaction stores
      const stores = {};
      storeNames.forEach(name => {
        stores[name] = transaction.objectStore(name);
      });

      callback(stores, transaction);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Single store operation helper
 */
export async function executeStoreOperation(storeName, mode, callback) {
  return executeTransaction([storeName], mode, ({ [storeName]: store }) => {
    return callback(store);
  });
}

/**
 * Clear entire database (for testing/reset)
 */
export async function clearDatabase() {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.keys(STORES), 'readwrite');

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      console.log('Database cleared');
      resolve();
    };

    Object.keys(STORES).forEach(storeName => {
      transaction.objectStore(storeName).clear();
    });
  });
}

/**
 * Delete database entirely
 */
export async function deleteDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = null;
      console.log('Database deleted');
      resolve();
    };
  });
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  const stats = {};

  for (const storeName of Object.keys(STORES)) {
    await executeStoreOperation(storeName, 'readonly', (store) => {
      return new Promise((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          stats[storeName] = countRequest.result;
          resolve();
        };
      });
    });
  }

  return stats;
}

export { STORES, DB_NAME, DB_VERSION };
