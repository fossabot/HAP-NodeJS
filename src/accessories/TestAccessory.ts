import * as tlv from '../lib/util/tlv';

export class TestAccessory {

    constructor() {

    }

    test() {
        console.log("Test223!");
    }

}

const t = tlv.encode(1, 2);

console.log(t.toString("hex"));
console.log(new TestAccessory().test());
