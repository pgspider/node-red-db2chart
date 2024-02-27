module.exports = function (RED) {
    function Db2chart(config) {  // config is the object containing properties set in the flow editor
        RED.nodes.createNode(this, config);  // initialize the features shared by all nodes

        // get node properties
        this.firstcol = config.firstcol;
        var node = this;

        // Nodes register a listener on the input event to receive messages from the up-stream nodes in a flow.
        node.on('input', function (msg, send, done) {
            var inmsg = { payload: msg.payload };

            // 'send' and 'done' require Node-RED 1.x+
            send = send || function () { node.send.apply(node, arguments); };

            // validate input
            var ret = validateInput(inmsg, node, done);
            if (ret !== RETCODE.SUCCESS) {
                return;
            }

            // convert data
            msg.payload = convertData(inmsg, node, done);
            if (msg.payload.length === 0) {
                return;
            }

            // send output.
            send(msg);

        });
    }
    RED.nodes.registerType("db2chart", Db2chart);
}

// Return code definition
const RETCODE = {
    SUCCESS: 0,                     // OK
    INVALID_OBJECT: -1,             // Invalid object in the input array
    INVALID_MARKED_LABEL: -2,       // Label cannot be marked if there only one column
    INCONSISTENT_OBJECT: -3,        // Objects in the input array are not consistent
    INVALID_SINGLE_OBJECT: -4,      // Input is not a single object
    INVALID_DATA_TYPE: -5           // Invalid data type
}

/*
 * Validate input message
 * Return 0: Validation OK.
 * Return a negative number: Validation failed.
*/
function validateInput(inmsg, node, done) {
    var err;
    // validate input message, check whether it is an array.
    if (Array.isArray(inmsg.payload)) {
        // validate items in the array, check if they are objects.
        var properties = Object.getOwnPropertyNames(inmsg.payload[0]);
        
        for (var w in inmsg.payload) {
            if (Object.prototype.toString.call(inmsg.payload[w]) !== '[object Object]') {
                err = "Invalid object in the payload array at the index " + w;
                reportError(node, err, done);
                return RETCODE.INVALID_OBJECT;
            }

            // If there is one column, first col cannot be marked as label
            var key_len = Object.keys(inmsg.payload[w]).length;
            if ((key_len === 1) && (node.firstcol === true)) {
                err = "Cannot mark the first column as label";
                reportError(node, err, done);             
                return RETCODE.INVALID_MARKED_LABEL;
            }

            // validate property of all items. Property name and order must be the same.
            var properties_tmp = Object.getOwnPropertyNames(inmsg.payload[w]);
            // compare to check the consistency
            if (properties.toString() !== properties_tmp.toString()) {
                err = "Object is inconsistent at the index " + w;
                reportError(node, err, done);  
                return RETCODE.INCONSISTENT_OBJECT;
            }            
        }
    }
    else {
        // Validate the single object
        if (Object.prototype.toString.call(inmsg.payload) !== '[object Object]') {
            err = "Invalid input message payload, neither array nor single object";
            reportError(node, err, done);           
            return RETCODE.INVALID_SINGLE_OBJECT;
        }

        // If there is one column, first col cannot be marked as label
        var key_len = Object.keys(inmsg.payload).length;
        if ((key_len === 1) && (node.firstcol === true)) {
            err = "Cannot mark the first column as label";
            reportError(node, err, done);
            return RETCODE.INVALID_MARKED_LABEL;
        }
    }

    return RETCODE.SUCCESS;
}

/*
 * Convert data
 * Get information from input message and save to series, data and labels arrays to form the output.
 */
function convertData(inmsg, node, done) {
    var series = [];
    var labels = [];

    // If the payload is a single object, convert it to an array with only one object.
    if (Object.prototype.toString.call(inmsg.payload) === '[object Object]') {
        inmsg.payload = [inmsg.payload];
    }

    // save info to the labels array
    for (var w in inmsg.payload) {
        if (node.firstcol) {
            var obj = inmsg.payload[w];
            labels.push(Object.values(obj)[0]);

            // if using the first column as labels, data will be the remaining columns.
            // So, we need to remove the first column in each object of input array.
            var key_names = Object.keys(obj);
            delete obj[key_names[0]];
            inmsg.payload[w] = obj;
        }
        else {
            // the default labels are the index of the input array.
            labels.push(w);
        }
    }

    // save the object properties to the series array.
    series = Object.getOwnPropertyNames(inmsg.payload[0]);

    // save the object values to the data array 
    // get size of an object
    var key_len = Object.keys(inmsg.payload[0]).length;
    var data = new Array(key_len);
    for (let i = 0; i < key_len; i++) {
        data[i] = new Array(); // empty array
    }

    for (var w in inmsg.payload) {
        var obj = inmsg.payload[w];
        for (let i = 0; i < key_len; i++) {
            data[i].push(Object.values(obj)[i]);
        }
    }

    // validate data: data is number only
    for (let i = 0; i < key_len; i++) {
        var ret = validateDataType(data[i], "number");
        if (ret !== RETCODE.SUCCESS) {
            var err = "Invalid data type: " + series[i] + " accept only Number type";
            reportError(node, err, done);
            return [];
        }
    }

    // form the output message and return
    return [{ series, data, labels }];
}

/*
 * Validate data type
 */
function validateDataType(input_array, expected_type) {
    for (var w in input_array) {
        if (typeof input_array[w] !== expected_type) {
            return RETCODE.INVALID_DATA_TYPE;
        }
    }

    return RETCODE.SUCCESS;
}

/*
 * Report error to the editor
 */
function reportError(node, err, done) {
    if (done) {
        // Node-RED 1.x+ compatible
        done(err);
    } else {
        // Node-RED 0.x compatible
        node.error(err, node.msg);
    }  
}
