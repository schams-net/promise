"use strict";
/*
 * Promise
 */

const AWS = require('aws-sdk');
const util = require('util');

/**
 * Handler function
 *
 * @param {object} event - Lambda event from inbound email received by AWS SES.
 * @param {object} context - Lambda context object.
 * @param {object} callback - Lambda callback object.
 * @param {object} overrides - Overrides for the default data
 */
exports.handler = function(event, context, callback, overrides) {
    var steps = overrides && overrides.steps ? overrides.steps : [
        exports.step1,
        exports.step2,
        exports.step3
    ];
    var data = {
        event: event,
        callback: callback,
        context: context,
        config: [],
        response: '',
        log: overrides && overrides.log ? overrides.log : console.log,
        ses: overrides && overrides.ses ? overrides.ses : new AWS.SES(),
        s3: overrides && overrides.s3 ? overrides.s3 : new AWS.S3({
            signatureVersion: 'v4'
        })
    };
    Promise.series(steps, data)
        .then(function(data) {
            data.log({
                level: "info",
                message: "Process finished successfully."
            });
            return data.callback();
        })
        .catch(function(err) {
            data.log({
                level: "error",
                message: "Step returned error: " + err.message,
                error: err,
                stack: err.stack
            });
            return data.callback(new Error("Error: Step returned error."));
        });
};

/**
 * Step 1
 *
 * @param {object} data - Data bundle
 * @return {object} - Promise resolved with data.
 */
exports.step1 = function(data) {
    data.items = ["foobar", "blubb", "pfiffikus"];
    return Promise.resolve(data);
};

/**
 * Step 2
 *
 * @param {object} data - Data bundle
 * @return {object} - Promise resolved with data.
 */
exports.step2 = function(data) {
    return new Promise(function(resolve, reject) {
        for (const [index, item] of data.items.entries()) {
            console.log('Read config for: ' + item);
            var params = {
                Bucket: "ses.schams.net",
                Key: "promise/" + item
            };
            var getObjectPromise = data.s3.getObject(params).promise();
            getObjectPromise.then(function(foobar) {
                console.log('Success');
                var config = JSON.parse(foobar.Body.toString('utf-8'));
                if (config) {
                    data.config[item] = config;
                }
            }).catch(function(err) {
                console.log(err);
            });
        }
        return resolve(data);
    });
};

/**
 * Step 3
 *
 * @param {object} data - Data bundle
 * @return {object} - Promise resolved with data.
 */
exports.step3 = function(data) {
    console.log(util.inspect(data, {
        depth: 5
    }));
    return Promise.resolve(data);
};

/**
 *
 */
Promise.series = function(promises, initValue) {
    return promises.reduce(function(chain, promise) {
        if (typeof promise !== 'function') {
            return Promise.reject(
                new Error("Error: Invalid promise item: " + promise)
            );
        }
        return chain.then(promise);
    }, Promise.resolve(initValue));
};
