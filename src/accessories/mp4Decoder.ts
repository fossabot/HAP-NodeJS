import {VideoData} from "./data";
import fs from 'fs';

const hexdump = require('hexdump-nodejs');

const containers = ['moov',
    'moof',
    'trak',
    'traf',
    'tfad',
    'mvex',
    'mdia',
    'minf',
    'dinf',
    'stbl',
    'stsd',
    'sinf',
    'mfra',
    'udta',
    'meta',
    'schi',
    'avc1',
    'avc3',
    'hvc1',
    'hev1',
    'mp4a',
    'encv',
    'enca',
    'skip',
    'edts'];

const buf = fs.readFileSync("~/Downloads/segments/out.mp4");
//const buf = fs.readFileSync("/Users/andi/Desktop/secure-video.mp4");
const mediaInitialization = Buffer.concat([VideoData.INIT]);
const wholeFIle = Buffer.concat([
    VideoData.INIT,
    VideoData.SEQUENCE2_1, VideoData.SEQUENCE2_2,
    VideoData.SEQUENCE3_1, VideoData.SEQUENCE3_2,
    VideoData.SEQUENCE4_1, VideoData.SEQUENCE4_2,
]);

let lastBox: Buffer | undefined = undefined;
let i = 0;
parseBox(buf).forEach((box, index) => {
    if (lastBox === undefined) {
        lastBox = box.data;
    } else {
        //console.log(hexdump(lastBox));
        //console.log(hexdump(box.data));

        const data = Buffer.concat([lastBox, box.data!]);
        fs.writeFileSync(`/Users/andi/Downloads/segments/out-seg${i++}`, data);
        lastBox = undefined;
    }
});

console.log(JSON.stringify(parseBox(buf, false), null, 4));

interface MP4Box {
    type: string,
    length: number,
    offset: number,
    data?: Buffer,
    boxes?: MP4Box[],
}

function parseBox(buf: Buffer, includeData: boolean = true, offset: number = 0, indent: number = 0) {
    const results = [];

    while (offset < buf.length) {
        const length = buf.readUInt32BE(offset);
        const type = buf.toString("utf8", offset + 4, offset + 8).trim();

        if (length == 0) {
            break;
        }

        const boxData = buf.slice(offset, offset + length);
        const box: MP4Box = {
            type: type,
            offset: offset,
            length: length,
            data: includeData? boxData: undefined,
        };

        if (containers.includes(type) && boxData.length > 0) {
            box.boxes = parseBox(boxData, includeData, 8, indent++);
        }

        results.push(box);
        offset += length;
    }

    return results;
}
