/*******************************************************************************
 *
 *   Copyright 2013-2014 Aerospike, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 ******************************************************************************/

// we want to test the built aerospike module
var aerospike = require('../build/Release/aerospike');
var options = require('./util/options');
var assert = require('assert');
var expect = require('expect.js');

var keygen = require('./generators/key');
var metagen = require('./generators/metadata');
var recgen = require('./generators/record');
var putgen = require('./generators/put');

var status = aerospike.status;
var policy = aerospike.policy;

describe('client.info()', function() {

    var config = {
        hosts: [
            { addr: options.host, port: options.port }
        ],
        log: {
            level: options.log
        },
        policies: {
            timeout: options.timeout
        }
    };

    before(function(done) {
        done();
    });

    after(function(done) {
        done();
    });

    it('should get "objects" from a single node', function(done) {
        var host = {addr: options.host, port: options.port};
        var count = 0;
        aerospike.client(config)
            .info("objects", host, function(err, response, host) {
                expect(err).to.be.ok();
                expect(err.code).to.equal(status.AEROSPIKE_OK);
                count++;
            }, function() {
                expect(count).to.equal(1);
                done();
            });
    });

    it('should get "objects" from entire cluster', function(done) {
        aerospike.client(config).connect(function(err, client){
            client.info("objects", function(err, response, host) {
                expect(err).to.be.ok();
                expect(err.code).to.equal(status.AEROSPIKE_OK);
            }, function() {
                client.close();
                done();
            });
        });
    });
});
