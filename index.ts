'use strict';

/**
 * 2011 Peter 'Pita' Martischka
 * 2020 John McLear
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Database as DatabaseCache} from './lib/CacheAndBufferLayer';
import {normalizeLogger} from './lib/logging';
import {callbackify} from 'util';
import {Settings} from './lib/AbstractDatabase';
import {Database as CassandraDatabase} from './databases/cassandra_db'
import {Database as CouchDatabase} from './databases/couch_db'
import {Database as DirtyDatabase} from './databases/dirty_db'
import {Database as DirtyGitDatabase} from './databases/dirty_git_db'
import {Database as ElasticSearchDatabase} from './databases/elasticsearch_db'
import {Database as MemoryDatabase} from './databases/memory_db'
import {Database as MockDatabase} from './databases/mock_db'
import {Database as MongoDBDatabase} from './databases/mongodb_db'
import {Database as MSSQLDatabase} from './databases/mssql_db'
import {Database as MYSQLDatabase} from './databases/mysql_db'
import {Database as PostgresDatabase} from './databases/postgres_db'
import {Database as PostgresPoolDatabase} from './databases/postgrespool_db'
import {Database as RedisDatabase} from './databases/redis_db'
import {Database as RethinkDatabase} from './databases/rethink_db'
import {Database as SQLiteDatabase} from './databases/sqlite_db'
import {Database as Surrealb} from './databases/surrealdb_db'


const cbDb = {
  init: () => {},
  flush: () => {},
  get: () => {},
  remove: () => {},
  findKeys: () => {},
  close: () => {},
  getSub: () => {},
  setSub: () => {},
};
const fns = ['close', 'findKeys', 'flush', 'get', 'getSub', 'init', 'remove', 'set', 'setSub'];
for (const fn of fns) {
  // @ts-ignore
  cbDb[fn] = callbackify(DatabaseCache.prototype[fn]);
}
const makeDoneCallback = (callback: (err?:any)=>{}, deprecated:(err:any)=>{}) => (err: null) => {
  if (callback) callback(err);
  if (deprecated) deprecated(err);
  if (err != null && callback == null && deprecated == null) throw err;
};

export const Database = class {
  public readonly type: any;
  public dbModule: any;
  public readonly dbSettings: any;
  public readonly wrapperSettings: any | {};
  public readonly logger: Function | null;
  public db: any;
  public metrics: any;
  /**
   * @param type The type of the database
   * @param dbSettings The settings for that specific database type
   * @param wrapperSettings
   * @param logger Optional logger object. If no logger object is provided no logging will occur.
   *     The logger object is expected to be a log4js logger object or `console`. A logger object
   *     from another logging library should also work, but performance may be reduced if the logger
   *     object does not have is${Level}Enabled() methods (isDebugEnabled(), etc.).
   */
  constructor(type: undefined | string, dbSettings: Settings | null | string, wrapperSettings?: null | {}, logger: any = null) {
    if (!type) {
      type = 'sqlite';
      dbSettings = null;
      wrapperSettings = null;
    }

    // saves all settings and require the db module
    this.type = type;
    this.dbSettings = dbSettings;
    this.wrapperSettings = wrapperSettings;
    this.logger = normalizeLogger(logger);

  }

  /**
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  async init(callback = null) {
    const db:any = this.initDB();
    db.logger = this.logger;
    this.db = new DatabaseCache(db, this.wrapperSettings, this.logger);
    this.metrics = this.db.metrics;
    if (callback != null) {
      return cbDb.init.call(this.db);
    }
    return this.db.init();
  }

  initDB(){
    switch (this.type){
        case 'mysql':
            return new MYSQLDatabase(this.dbSettings);
        case 'postgres':
          return new PostgresDatabase(this.dbSettings);
        case 'sqlite':
          return new SQLiteDatabase(this.dbSettings);
        case 'mongodb':
          return new MongoDBDatabase(this.dbSettings);
        case 'redis':
          return new RedisDatabase(this.dbSettings);
        case 'cassandra':
          return new CassandraDatabase(this.dbSettings);
        case 'dirty':
          return new DirtyDatabase(this.dbSettings);
        case 'dirtygit':
            return new DirtyGitDatabase(this.dbSettings);
        case 'elasticsearch':
            return new ElasticSearchDatabase(this.dbSettings);
        case 'memory':
            return new MemoryDatabase(this.dbSettings);
        case 'mock':
            return new MockDatabase(this.dbSettings);
        case 'mssql':
            return new MSSQLDatabase(this.dbSettings);
        case 'postgrespool':
            return new PostgresPoolDatabase(this.dbSettings);
        case 'rethink':
            return new RethinkDatabase(this.dbSettings);
        case 'couch':
            return new CouchDatabase(this.dbSettings);
        case 'surrealdb':
            return new Surrealb(this.dbSettings);
        default:
            throw new Error('Invalid database type');
    }
  }

  /**
   * Wrapper functions
   */

  /**
   * Deprecated synonym of flush().
   *
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  doShutdown(callback = null) {
    return this.flush(callback);
  }

  /**
   * Writes any unsaved changes to the underlying database.
   *
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  flush(callback = null) {
    if (!cbDb || !cbDb.flush === undefined) return null;
    if (callback != null) { // @ts-ignore
      return cbDb.flush.call(this.db, callback);
    }
    return this.db.flush();
  }

  /**
   * @param key
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  get(key:string, callback = null) {
    if (callback != null) { // @ts-ignore
      return cbDb.get.call(this.db, key, callback);
    }
    return this.db.get(key);
  }

  /**
   * @param key
   * @param notKey
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  findKeys(key:string, notKey:string, callback = null) {
    if (callback != null) { // @ts-ignore
      return cbDb.findKeys.call(this.db, key, notKey, callback);
    }
    return this.db.findKeys(key, notKey);
  }

  /**
   * Removes an entry from the database if present.
   *
   * @param key
   * @param cb Deprecated. Node-style callback. Called when the write has been committed to the
   *     underlying database driver. If null, a Promise is returned.
   * @param deprecated Deprecated callback that is called just after cb. Ignored if cb is null.
   */
  remove(key:string, cb = null, deprecated = null) {
    if (cb != null) { // @ts-ignore
      return cbDb.remove.call(this.db, key, makeDoneCallback(cb, deprecated));
    }
    return this.db.remove(key);
  }

  /**
   * Adds or changes the value of an entry.
   *
   * @param key
   * @param value
   * @param cb Deprecated. Node-style callback. Called when the write has been committed to the
   *     underlying database driver. If null, a Promise is returned.
   * @param deprecated Deprecated callback that is called just after cb. Ignored if cb is null.
   */
  set(key:string, value:string, cb = null, deprecated = null) {
    if (cb != null) { // @ts-ignore
      return cbDb.get.call(this.db, key, value, makeDoneCallback(cb, deprecated));
    }
    return this.db.set(key, value);
  }

  /**
   * @param key
   * @param sub
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  getSub(key:string, sub:string, callback = null) {
    if (callback != null) { // @ts-ignore
      return cbDb.getSub.call(this.db, key, sub, callback);
    }
    return this.db.getSub(key, sub);
  }

  /**
   * Adds or changes a subvalue of an entry.
   *
   * @param key
   * @param sub
   * @param value
   * @param cb Deprecated. Node-style callback. Called when the write has been committed to the
   *     underlying database driver. If null, a Promise is returned.
   * @param deprecated Deprecated callback that is called just after cb. Ignored if cb is null.
   */
  setSub(key:string, sub:string, value:string, cb = null, deprecated = null) {
    if (cb != null) {
      // @ts-ignore
      return cbDb.setSub.call(this.db, key, sub, value, makeDoneCallback(cb, deprecated));
    }
    return this.db.setSub(key, sub, value);
  }

  /**
   * Flushes unwritten changes then closes the connection to the underlying database. After this
   * returns, any future call to a method on this object may result in an error.
   *
   * @param callback - Deprecated. Node-style callback. If null, a Promise is returned.
   */
  close(callback = null) {
    if (callback != null) { // @ts-ignore
      return cbDb.close.call(this.db, callback);
    }
    return this.db.close();
  }
};

/**
 * Deprecated synonym of Database.
 */
exports.database = exports.Database;
