// *****************************************************************************
// Copyright 2013-2016 Aerospike, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License")
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// *****************************************************************************

/**
 * @module aerospike
 *
 * @description The Aerospike module is the main entry point for the Aerospike
 * Node.js Client API. It provides methods for creating new client instances
 * that connect to a specific Aerospike server cluster.
 *
 * # Data Model
 *
 * ## Record
 *
 * A record is how the data is represented and stored in the database. A record
 * is represented as an object. The keys of the object are the names of the fields
 * (bins) of a record. The values for each field can either be Number, String,
 * Array, Buffer or an Object itself. Aerospike supports integer, double,
 * string, bytes, array and map data types.
 *
 * Note: Array can contain an array or an object as a value in it. Similarly
 * the object can contain an array or an object as a value in it. Essentially
 * nesting of arrays in an object, and nesting of objects in an array is
 * allowed.
 *
 * Example of a record with 5 fields:
 *
 * ```js
 * var record = {
 *   int_bin: 123,
 *   str_bin: 'xyz',
 *   buff_bin: new Buffer('hello world!'),
 *   arr_bin: [1, 2, 3],
 *   obj_bin: {num: 123, str: 'abc', buff: new Buffer([0xa, 0xb, 0xc])}
 * }
 * ```
 *
 * ### Unsupported Data Types
 *
 * Aerospike does currently not support a boolean data type. To store boolean
 * values in the database the application needs to convert them to a supported
 * data type as the client does not do any automatica data type conversions.
 * Attempting to store a boolean value in a record bin will lead to a parameter
 * error being returned by the client.
 *
 * ## Metadata
 *
 * Some operations allow you to provide metadata with a record, including:
 *
 * - `gen` – (optional) The generation (version) of the record. Must be an Integer.
 * - `ttl` – (optional) The time-to-live in seconds (expiration) of the record. Must be an Integer.
 *
 * Example:
 *
 * ```js
 * var metadata = {
 *   gen: 1,
 *   ttl: 6000
 * }
 * ```
 *
 * @example
 *
 * const Aerospike = require('aerospike')
 * const Key = Aerospike.Key
 *
 * const config = {
 *   hosts: '192.168.0.1:3000',
 *   policies: {
 *     timeout: 50
 *   }
 * }
 *
 * Aerospike.connect(config, (error, client) => {
 *   if (error) throw error
 *   var key = new Key('test', 'demo', 'key1')
 *   client.get(key, (error, record, meta) => {
 *     if (error) {
 *       switch (error.code) {
 *         case Aerospike.status.AEROSPIKE_ERR_RECORD_NOT_FOUND:
 *           console.error('record ' + key.key + ' does not exist')
 *           break;
 *         default:
 *           throw error
 *       }
 *     } else {
 *       console.log(record, meta)
 *     }
 *     client.close()
 *   })
 * })
 */

const as = require('../build/Release/aerospike.node')

const AerospikeError = require('./aerospike_error')
const Client = require('./client')
const Double = require('./double')
const GeoJSON = require('./geojson')
const Key = require('./key')
const filter = require('./filter')
const info = require('./info')
const operator = require('./operator')

/**
 * Whether event loop resources have been released
 *
 * @type {boolean}
 * @private
 */
var _eventLoopReleased = false

/**
 * @function module:aerospike.client
 *
 * @summary Creates a new {@link Client} instance.
 *
 * @param {Client~Config} config - The configuration for the client.
 */
function client (config) {
  config = config || {}
  return new Client(this, config)
}

/**
 * @function module:aerospike.connect
 *
 * @summary Creates a new {@link Client} instance and connects to the Aerospike cluster.
 *
 * @param {Client~Config} [config] - The configuration for the client.
 * @param {Client~connectCallback} callback - The funcation to call, once the client is connected to the cluster successfully.
 */
function connect (config, callback) {
  if (typeof config === 'function') {
    callback = config
    config = null
  }
  var client = this.client(config)
  client.connect(callback)
  return client
}

/**
 * @function module:aerospike.key
 *
 * @summary Creates a new {@link Key} instance.
 *
 * @description Provided for backward compatibility. Use the {@link Key} class
 * constructor instead.
 *
 * @param {string} ns - The Namespace to which the key belongs.
 * @param {string} set - The Set to which the key belongs.
 * @param {(string|number|Buffer)} value - The unique key value. Keys can be
 * strings, integers or an instance of the Buffer class.
 *
 * @deprecated in v2.0
 */
function key (ns, set, key) {
  return new Key(ns, set, key)
}

/**
 * @function module:aerospike.releaseEventLoop
 *
 * @summary Release event loop resources.
 *
 * @description This method releases the event loop resources held by the
 * Aerospike C client library. It is normally called automatically when the
 * Aerospike Node.js client instance is closed. However, when the application
 * needs to create multiple client instances, then the event loop resources
 * need to be released explicitly by calling this method and `releaseEventLoop
 * = false` needs to be passed in the {@link Client#close} method.
 *
 * @example <caption>Working with multiple client instances.</caption>
 *
 * const Aerospike = require('aerospike')
 *
 * // called one or more times to handle a new work request
 * function handleRequest (request) {
 *   Aerospike.connect(function (err, client) {
 *     if (err) {
 *       // handle error
 *     }
 *     // handle request
 *     client.close(false) // do not release event loop
 *   })
 * }
 *
 * // called when application shuts down
 * function shutdown () {
 *   Aerospike.releaseEventLoop()
 * }
 */
function releaseEventLoop () {
  _eventLoopReleased = true
  if (as.get_cluster_count() > 0) {
    setTimeout(releaseEventLoop, 5)
  } else {
    as.release_as_event_loop()
  }
}

function eventLoopReleased () {
  return _eventLoopReleased
}

function Aerospike () {
  // classes && data types
  this.Client = Client
  this.AerospikeError = AerospikeError
  this.Double = Double
  this.GeoJSON = GeoJSON
  this.Key = Key

  // top-level methods exposed through Aerospike module
  this.client = client
  this.connect = connect
  this.eventLoopReleased = eventLoopReleased
  this.key = key
  this.releaseEventLoop = releaseEventLoop

  // other commands contained in sub-modules
  this.filter = filter
  this.operator = operator
  this.info = info

  // enums imported from C client library
  this.language = as.language

  /**
   * @member {Object} log
   * @readonly
   * @static
   *
   * Enumeration of log levels
   *
   * @example
   *
   * const Aerospike = require('aerospike')
   *
   * var config = {
   *   log: { level: Aerospike.log.INFO }
   * }
   * Aerospike.connect(config, (error, client) => {
   *   if (error) throw error
   *
   *   var key = new Aerospike.Key('test', 'demo', 'k1')
   *   client.get(key, (error, record) => {
   *     if (error) throw error
   *     console.info(record)
   *     client.close()
   *   })
   * })
   *
   * @property {number} OFF
   * @property {number} ERROR
   * @property {number} WARN
   * @property {number} DEBUG
   * @property {number} DETAIL
   */
  this.log = as.log

  /**
   * @member {Object} policy
   * @readonly
   * @static
   *
   * Enumeration of policy values.
   *
   * @example
   *
   * const Aerospike = require('aerospike')
   *
   * // global policy, applied to all commands that do not override it
   * var config = {
   *   policies: {
   *     timeout: 100,
   *     retry: Aerospike.policy.retry.ONCE
   *   }
   * }
   *
   * Aerospike.connect(config, (error, client) => {
   *   if (error) throw error
   *
   *   var key = new Aerospike.Key('test', 'demo', 'k1')
   *   var record = {i: 1234}
   *
   *   // override policy for put command
   *   var policy = {
   *     exists: Aerospike.policy.exists.CREATE,
   *     key: Aerospike.policy.key.SEND
   *   }
   *
   *   client.put(key, record, {}, policy, (error) => {
   *     if (error && error.code === Aerospike.status.AEROSPIKE_ERR_RECORD_EXISTS) {
   *       console.info('record already exists')
   *     } else if (error) {
   *       throw error
   *     }
   *     client.close()
   *   })
   * })
   *
   * @property {object} retry - Retry Policy - Specifies the behavior of failed
   * operations.
   *
   * @property {number} retry.NONE - Only attempt an operation once.
   *
   * @property {number} retry.ONCE - If an operation fails, attempt the operation one
   * more time.
   *
   * @property {object} gen - Generation Policy - Specifies the behavior of
   * record modifications with regard to the generation value.
   *
   * @property {number} gen.IGNORE - Write a record, regardless of generation.
   *
   * @property {number} gen.EQ - Write a record, ONLY if generations are equal.
   *
   * @propery {number} gen.GT - Write a record, ONLY if local generation is
   * greater than remote generation.
   *
   * @property {object} key - Key Policy - Specifies the behavior for whether
   * keys or digests should be sent to the cluster.
   *
   * @property {number} key.DIGEST - Send the digest value of the key. This is
   * the recommended mode of operation. This calculates the digest and sends
   * the digest to the server. The digest is only calculated on the client, and
   * not the server.
   *
   * @property {number} key.SEND - Send the key, in addition to the digest
   * value. If you want keys to be returned when scanning or querying, the keys
   * must be stored on the server. This policy causes a write operation to
   * store the key. Once the key is stored, the server will keep it - there is
   * no need to use this policy on subsequent updates of the record. If this
   * policy is used on read or delete operations, or on subsequent updates of a
   * record with a stored key, the key sent will be compared with the key
   * stored on the server. A mismatch will cause
   * AEROSPIKE_ERR_RECORD_KEY_MISMATCH to be returned.
   *
   * @property {object} exists - Existence Policy - Specifies the behavior for
   * writing the record depending whether or not it exists.
   *
   * @property {number} exists.IGNORE - Write the record, regardless of
   * existence.  (I.e. create or update.)
   *
   * @property {number} exists.CREATE - Create a record, ONLY if it doesn't
   * exist.
   *
   * @property {number} exists.UPDATE - Update a record, ONLY if it exists.
   *
   * @property {number} exists.REPLACE - Completely replace a record, ONLY if
   * it exists.
   *
   * @property {number} exists.CREATE_OR_REPLACE - Completely replace a record
   * if it exists, otherwise create it.
   *
   * @property {object} replica - Specifies which partition replica to read from.
   *
   * @property {number} replica.MASTER - Read from the partition master replica
   * node.
   *
   * @property {number} replica.ANY - Read from an unspecified replica node.
   *
   * @property {object} consistencyLevel - Specifies the number of replicas to
   * be consulted in a read operation to provide the desired consistency
   * guarantee.
   *
   * @property {number} consistencyLevel.ONE - Involve a single replica in the
   * operation.
   *
   * @property {number} consistencyLevel.ALL - Involve all replicas in the
   * operation.
   *
   * @property {object} commitLevel - Specifies the number of replicas required
   * to be successfully committed before returning success in a write operation
   * to provide the desired consistency guarantee.
   *
   * @property {number} commitLevel.ALL - Return success only after
   * successfully committing all replicas.
   *
   * @property {number} commitLevel.MASTER - Return success after successfully
   * committing the master replica.
   */
  this.policy = as.policy

  /**
   * Enumeration of predicate types.
   * @private
   */
  this.predicates = as.predicates

  /**
   * @member {Object} jobStatus
   * @readonly
   * @static
   *
   * @description Enumeration of job status codes.
   *
   * @see {@link Job#infoCallback} returns the job status.
   *
   * @property {number} UNDEF - The job status is undefined. This is likely due to the status not being properly checked.
   *
   * @property {number} INPROGRESS - The job is currently running.
   *
   * @property {number} COMPLETED - The job completed successfully.
   */
  this.jobStatus = as.jobStatus

  /**
   * @member {Object} scanPriority
   * @readonly
   * @static
   *
   * @description Enumeration of priority levels for a scan operation.
   *
   * @see {@link Scan#priority}
   *
   * @property {number} AUTO - The cluster will auto adjust the scan priority.
   *
   * @property {number} LOW - Low scan priority.
   *
   * @property {number} MEDIUM - Medium scan priority.
   *
   * @property {number} HIGH - High scan priority.
   */
  this.scanPriority = as.scanPriority

  /**
   * @member {Object} indexDataType
   * @readonly
   * @static
   *
   * @description Enumeration of secondary index data types.
   *
   * @property {number} STRING - Values contained in the secondary index are strings.
   *
   * @property {number} NUMERIC - Values contained in the secondary index are integers.
   *
   * @property {number} GEO2DSPHERE - Values contained in the secondary index are GeoJSON values (points or polygons)..
   *
   * @see {@link Client#createIndex}
   */
  this.indexDataType = as.indexDataType

  /**
   * @member {Object} indexType
   * @readonly
   * @static
   *
   * @description Enumeration of secondary index types.
   *
   * @property {number} DEFAULT - Default secondary index type for bins containing scalar values (i.e. integer, string).
   *
   * @property {number} LIST - Secondary index for bins containing
   * <a href="http://www.aerospike.com/docs/guide/cdt-list.html" title="Aerospike List Data Type">&uArr;Lists</a>;
   * the index will be build over the individual entries of the list.
   *
   * @property {number} MAPKEYS - Secondary index for bins containing
   * <a href="http://www.aerospike.com/docs/guide/cdt-map.html" title="Aerospike Maps Data Type">&uArr;Maps</a>;
   * the index will be build over the individual keys of the map entries.
   *
   * @property {number} MAPVALUES - Secondary index for bins containing
   * <a href="http://www.aerospike.com/docs/guide/cdt-map.html" title="Aerospike Maps Data Type">&uArr;Maps</a>;
   * the index will be build over the individual values of the map entries.
   *
   * @see {@link Client#createIndex}
   */
  this.indexType = as.indexType

  /**
   * @member {Object} status
   * @readonly
   * @static
   *
   * @description Enumeration of error status codes.
   *
   * @property {number} AEROSPIKE_ERR_INVALID_NODE - Node invalid or could not
   * be found.
   *
   * @property {number} AEROSPIKE_ERR_NO_MORE_CONNECTIONS - Asynchronous
   * connection error.
   *
   * @property {number} AEROSPIKE_ERR_ASYNC_CONNECTION - Asynchronous
   * connection error.
   *
   * @property {number} AEROSPIKE_ERR_CLIENT_ABORT - Query or scan was aborted
   * in user's callback.
   *
   * @property {number} AEROSPIKE_ERR_INVALID_HOST - Host name could not be
   * found in DNS lookup.
   *
   * @property {number} AEROSPIKE_NO_MORE_RECORDS - No more records available
   * when parsing batch, scan or query records.
   *
   * @property {number} AEROSPIKE_ERR_PARAM - Invalid client API parameter.
   *
   * @property {number} AEROSPIKE_ERR_CLIENT - Generic client API usage error.
   *
   * @property {number} AEROSPIKE_ERR - Generic client error (deprecated)
   *
   * @property {number} AEROSPIKE_OK - Generic success.
   *
   * @property {number} AEROSPIKE_ERR_SERVER - Generic error returned by the
   * server.
   *
   * @property {number} AEROSPIKE_ERR_RECORD_NOT_FOUND - Record does not exist
   * in database. May be returned by read, or write with policy
   * `{ exists: Aerospike.policy.exists.UPDATE }`
   *
   * @property {number} AEROSPIKE_ERR_RECORD_GENERATION - Generation of record
   * in database does not satisfy write policy.
   *
   * @property {number} AEROSPIKE_ERR_REQUEST_INVALID - Request protocol
   * invalid, or invalid protocol field.
   *
   * @property {number} AEROSPIKE_ERR_RECORD_EXISTS - Record already exists.
   * May be returned by write with policy
   * `{ exists: Aerospike.policy.exists.CREATE }`.
   *
   * @property {number} AEROSPIKE_ERR_BIN_EXISTS - Bin already exists.
   *
   * @property {number} AEROSPIKE_ERR_CLUSTER_CHANGE - A cluster state change
   * occurred during the request.
   *
   * @property {number} AEROSPIKE_ERR_SERVER_FULL - The server node is running
   * out of memory and/or storage device space reserved for the specified
   * namespace.
   *
   * @property {number} AEROSPIKE_ERR_TIMEOUT - Request timed out. Can be
   * triggered by client or server.
   *
   * @property {number} AEROSPIKE_ERR_NO_XDR - XDR not available for the
   * cluster.
   *
   * @property {number} AEROSPIKE_ERR_CLUSTER - Generic cluster discovery &
   * connection error.
   *
   * @property {number} AEROSPIKE_ERR_BIN_INCOMPATIBLE_TYPE - Bin modification
   * operation cannot be done on an existing bin due to its value type.
   *
   * @property {number} AEROSPIKE_ERR_RECORD_TOO_BIG - Record being
   * (re-)written cannot fit in a storage write block.
   *
   * @property {number} AEROSPIKE_ERR_RECORD_BUSY - Too many concurrent
   * requests for one record - a "hot key" situation.
   *
   * @property {number} AEROSPIKE_ERR_SCAN_ABORTED - Scan aborted by user.
   *
   * @property {number} AEROSPIKE_ERR_UNSUPPORTED_FEATURE - Sometimes our doc,
   * or our customers' wishes, get ahead of us. We may have processed something
   * that the server is not ready for (unsupported feature).
   *
   * @property {number} AEROSPIKE_ERR_BIN_NOT_FOUND - Bin-level replace-only
   * supported on server but not on client.
   *
   * @property {number} AEROSPIKE_ERR_DEVICE_OVERLOAD - The server node's
   * storage device(s) can't keep up with the write load.
   *
   * @property {number} AEROSPIKE_ERR_RECORD_KEY_MISMATCH - Record key sent
   * with transaction did not match key stored on server.
   *
   * @property {number} AEROSPIKE_ERR_NAMESPACE_NOT_FOUND - Namespace in
   * request not found on server.
   *
   * @property {number} AEROSPIKE_ERR_BIN_NAME - Sent too-long bin name (should
   * be impossible in this client) or exceeded namespace's bin name quota.
   *
   * @property {number} AEROSPIKE_ERR_FAIL_FORBIDDEN - Operation not allowed at
   * this time.
   *
   * @property {number} AEROSPIKE_QUERY_END - There are no more records left
   * for query.
   *
   * @property {number} AEROSPIKE_SECURITY_NOT_SUPPORTED - Security
   * functionality not supported by connected server.
   *
   * @property {number} AEROSPIKE_SECURITY_NOT_ENABLED - Security functionality
   * not enabled by connected server.
   *
   * @property {number} AEROSPIKE_SECURITY_SCHEME_NOT_SUPPORTED - Security type
   * not supported by connected server.
   *
   * @property {number} AEROSPIKE_INVALID_COMMAND - Administration command is
   * invalid.
   *
   * @property {number} AEROSPIKE_INVALID_FIELD - Administration field is
   * invalid.
   *
   * @property {number} AEROSPIKE_ILLEGAL_STATE - Security protocol not
   * followed.
   *
   * @property {number} AEROSPIKE_INVALID_USER - User name is invalid.
   *
   * @property {number} AEROSPIKE_USER_ALREADY_EXISTS - User was previously
   * created.
   *
   * @property {number} AEROSPIKE_INVALID_PASSWORD - Password is invalid.
   *
   * @property {number} AEROSPIKE_EXPIRED_PASSWORD - Password has expired.
   *
   * @property {number} AEROSPIKE_FORBIDDEN_PASSWORD - Forbidden password (e.g.
   * recently used).
   *
   * @property {number} AEROSPIKE_INVALID_CREDENTIAL - Security credential is
   * invalid.
   *
   * @property {number} AEROSPIKE_INVALID_ROLE - Role name is invalid.
   *
   * @property {number} AEROSPIKE_ROLE_ALREADY_EXISTS - Role name already
   * exists.
   *
   * @property {number} AEROSPIKE_INVALID_PRIVILEGE - Privilege is invalid.
   *
   * @property {number} AEROSPIKE_NOT_AUTHENTICATED - User must be
   * authenticated before performing database operations.
   *
   * @property {number} AEROSPIKE_ROLE_VIOLATION - User does not possess the
   * required role to perform the database operation.
   *
   * @property {number} AEROSPIKE_ERR_UDF - Generic UDF error.
   *
   * @property {number} AEROSPIKE_ERR_LARGE_ITEM_NOT_FOUND - The requested item
   * in a large collection was not found.
   *
   * @property {number} AEROSPIKE_ERR_BATCH_DISABLED - Batch functionality has
   * been disabled.
   *
   * @property {number} AEROSPIKE_ERR_BATCH_MAX_REQUESTS_EXCEEDED - Batch max.
   * requests have been exceeded.
   *
   * @property {number} AEROSPIKE_ERR_BATCH_QUEUES_FULL - All batch queues are
   * full.
   *
   * @property {number} AEROSPIKE_ERR_GEO_INVALID_GEOJSON - Invalid/unsupported
   * GeoJSON.
   *
   * @property {number} AEROSPIKE_ERR_INDEX_FOUND - Index found.
   *
   * @property {number} AEROSPIKE_ERR_INDEX_NOT_FOUND - Index not found.
   *
   * @property {number} AEROSPIKE_ERR_INDEX_OOM - Index is out of memory.
   *
   * @property {number} AEROSPIKE_ERR_INDEX_NOT_READABLE - Unable to read the
   * index.
   *
   * @property {number} AEROSPIKE_ERR_INDEX - Generic secondary index error.
   *
   * @property {number} AEROSPIKE_ERR_INDEX_NAME_MAXLEN - Index name is too long.
   *
   * @property {number} AEROSPIKE_ERR_INDEX_MAXCOUNT - System alrady has
   * maximum allowed indeces.
   *
   * @property {number} AEROSPIKE_ERR_QUERY_ABORTED - Query was aborted.
   *
   * @property {number} AEROSPIKE_ERR_QUERY_QUEUE_FULL - Query processing queue
   * is full.
   *
   * @property {number} AEROSPIKE_ERR_QUERY_TIMEOUT - Secondary index query
   * timed out on server.
   *
   * @property {number} AEROSPIKE_ERR_QUERY - Generic query error.
   *
   * @property {number} AEROSPIKE_ERR_UDF_NOT_FOUND - UDF does not exist.
   *
   * @property {number} AEROSPIKE_ERR_LUA_FILE_NOT_FOUND - LUA file does not exist.
   *
   * @property {number} AEROSPIKE_ERR_LDT_INTERNAL - Internal LDT error.
   *
   * @property {number} AEROSPIKE_ERR_LDT_NOT_FOUND - LDT item not found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_UNIQUE_KEY - Unique key violation:
   * Duplicated item inserted when 'unique key' was set.
   *
   * @property {number} AEROSPIKE_ERR_LDT_INSERT - General error during insert
   * operation.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SEARCH - General error during search
   * operation.
   *
   * @property {number} AEROSPIKE_ERR_LDT_DELETE - General error during delete
   * operation.
   *
   * @property {number} AEROSPIKE_ERR_LDT_INPUT_PARM - General input parameter
   * error.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TYPE_MISMATCH - LDT type mismatch for
   * this bin.
   *
   * @property {number} AEROSPIKE_ERR_LDT_NULL_BIN_NAME - The supplied LDT bin
   * name is null.
   *
   * @property {number} AEROSPIKE_ERR_LDT_BIN_NAME_NOT_STRING - The supplied
   * LDT bin name must be a string.
   *
   * @property {number} AEROSPIKE_ERR_LDT_BIN_NAME_TOO_LONG - The supplied LDT
   * bin name exceeded the 14 char limit.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TOO_MANY_OPEN_SUBRECS - Internal
   * Error: too many open records at one time.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TOP_REC_NOT_FOUND - Internal Error:
   * Top Record not found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUB_REC_NOT_FOUND - Internal Error:
   * Sub Record not found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_BIN_DOES_NOT_EXIST - LDT Bin does not
   * exist.
   *
   * @property {number} AEROSPIKE_ERR_LDT_BIN_ALREADY_EXISTS - Collision: LDT
   * Bin already exists.
   *
   * @property {number} AEROSPIKE_ERR_LDT_BIN_DAMAGED - LDT control structures
   * in the Top Record are damanged. Cannot proceed.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_POOL_DAMAGED - Internal Error:
   * LDT Subrecord pool is damanged.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_DAMAGED - LDT control
   * structure in the Sub Record are damaged. Cannot proceed.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_OPEN - Error encountered while
   * opening a Sub Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_UPDATE - Error encountered
   * while updating a Sub Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_CREATE - Error encountered
   * while creating a Sub Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_DELETE - Error encountered
   * while deleting a Sub Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_SUBREC_CLOSE - Error encountered
   * while closing a Sub Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TOPREC_UPDATE - Error encountered
   * while updating a TOP Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TOPREC_CREATE - Error encountered
   * while creating a TOP Record.
   *
   * @property {number} AEROSPIKE_ERR_LDT_FILTER_FUNCTION_BAD - The filter
   * function name was invalid.
   *
   * @property {number} AEROSPIKE_ERR_LDT_FILTER_FUNCTION_NOT_FOUND - The
   * filter function was not found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_KEY_FUNCTION_BAD - The function to
   * extract the Unique Value from a complex object was invalid.
   *
   * @property {number} AEROSPIKE_ERR_LDT_KEY_FUNCTION_NOT_FOUND - The function
   * to extract the Unique Value from a complex object was not found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TRANS_FUNCTION_BAD - The function to
   * transform an object into a binary form was invalid.
   *
   * @property {number} AEROSPIKE_ERR_LDT_TRANS_FUNCTION_NOT_FOUND - The
   * function to transform an object into a binary form was not found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_UNTRANS_FUNCTION_BAD - The function
   * to untransform an object from binary form to live form was invalid.
   *
   * @property {number} AEROSPIKE_ERR_LDT_UNTRANS_FUNCTION_NOT_FOUND - The
   * function to untransform an object from binary form to live form was not
   * found.
   *
   * @property {number} AEROSPIKE_ERR_LDT_USER_MODULE_BAD - The UDF user module
   * name for LDT Overrides was invalid.
   *
   * @property {number} AEROSPIKE_ERR_LDT_USER_MODULE_NOT_FOUND - The UDF user
   * module name for LDT Overrides was not found.
   *
   * @see {@link AerospikeError#code}
   */
  this.status = as.status
}
module.exports = new Aerospike()

as.register_as_event_loop()
