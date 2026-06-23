module.exports = {
	nodes: [require('./dist/nodes/StatistaApi/StatistaApi.node.js').StatistaApi],
	credentials: [require('./dist/credentials/StatistaApi.credentials.js').StatistaApi],
};
