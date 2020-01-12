import fs from 'fs';
import {VideoData} from "./data";

const names = ["mediaInitialization.mp4",
    "sequence2_1.mp4", "sequence2_2.mp4",
    "sequence3_1.mp4", "sequence3_2.mp4",
    "sequence4_1.mp4", "sequence4_2.mp4"];
const list = [VideoData.INIT
    ,VideoData.SEQUENCE2_1 ,VideoData.SEQUENCE2_2
    ,VideoData.SEQUENCE3_1 ,VideoData.SEQUENCE3_2
    ,VideoData.SEQUENCE4_1 ,VideoData.SEQUENCE4_2];
const data = Buffer.concat(list);

//fs.writeFileSync("/Users/andi/Desktop/secure-video.mp4", data);
let last: Buffer = Buffer.alloc(0);
list.forEach((sequence, index) => {
    const name = names[index];

    if (index == 0) {
        fs.writeFileSync("~/Downloads/" + name, sequence);
    } else {
        if (index % 2 !== 0) {
            last = sequence;
        } else {
            const data = Buffer.concat([last, sequence]);
            fs.writeFileSync("~/Downloads/" + name, data)
        }
    }
});
