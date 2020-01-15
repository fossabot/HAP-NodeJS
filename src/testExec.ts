const tsNode = require("ts-node");
tsNode.register({
    project: "./tsconfig.json",
    files: true,
});

const testAccessory = require("../src/accessories/TestAccessory.ts");

console.log(testAccessory);

require("../src/accessories/console-log.js");
