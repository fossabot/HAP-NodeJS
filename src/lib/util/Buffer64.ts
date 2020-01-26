export namespace Buffer64 {

    export const MAX_UINT64 = BigInt("0xFFFFFFFFFFFFFFFF");
    export const MIN_UINT64 = BigInt("0");
    export const MAX_INT64 = BigInt("9223372036854775807");
    export const MIN_INT64 = BigInt("-9223372036854775808");

    // Reading BigInts: https://github.com/nodejs/node/blob/bbab963db80528f3f932269774f1d5d6012fbb68/lib/internal/buffer.js#L83-L157
    export function readBigUInt64LE(buffer: Buffer, offset: number = 0): bigint {
        const first = buffer[offset];
        const last = buffer[offset + 7];
        if (first === undefined || last === undefined)
            boundsError(offset, buffer.length - 8);

        const lo = first +
            buffer[++offset] * 2 ** 8 +
            buffer[++offset] * 2 ** 16 +
            buffer[++offset] * 2 ** 24;

        const hi = buffer[++offset] +
            buffer[++offset] * 2 ** 8 +
            buffer[++offset] * 2 ** 16 +
            last * 2 ** 24;

        return BigInt(lo) + (BigInt(hi) << BigInt("32"));
    }

    export function readBigUInt64BE(buffer: Buffer, offset = 0): bigint {
        const first = buffer[offset];
        const last = buffer[offset + 7];
        if (first === undefined || last === undefined)
            boundsError(offset, buffer.length - 8);

        const hi = first * 2 ** 24 +
            buffer[++offset] * 2 ** 16 +
            buffer[++offset] * 2 ** 8 +
            buffer[++offset];

        const lo = buffer[++offset] * 2 ** 24 +
            buffer[++offset] * 2 ** 16 +
            buffer[++offset] * 2 ** 8 +
            last;

        return (BigInt(hi) << BigInt("32")) + BigInt(lo);
    }

    export function readBigInt64LE(buffer: Buffer, offset = 0): bigint {
        const first = buffer[offset];
        const last = buffer[offset + 7];
        if (first === undefined || last === undefined)
            boundsError(offset, buffer.length - 8);

        const val = buffer[offset + 4] +
            buffer[offset + 5] * 2 ** 8 +
            buffer[offset + 6] * 2 ** 16 +
            (last << 24); // Overflow
        return (BigInt(val) << BigInt(32)) +
            BigInt(first +
                buffer[++offset] * 2 ** 8 +
                buffer[++offset] * 2 ** 16 +
                buffer[++offset] * 2 ** 24);
    }

    export function readBigInt64BE(buffer: Buffer, offset = 0): bigint {
        const first = buffer[offset];
        const last = buffer[offset + 7];
        if (first === undefined || last === undefined)
            boundsError(offset, buffer.length - 8);

        const val = (first << 24) + // Overflow
            buffer[++offset] * 2 ** 16 +
            buffer[++offset] * 2 ** 8 +
            buffer[++offset];
        return (BigInt(val) << BigInt(32)) +
            BigInt(buffer[++offset] * 2 ** 24 +
                buffer[++offset] * 2 ** 16 +
                buffer[++offset] * 2 ** 8 +
                last);
    }

    // Writing BigInts: https://github.com/nodejs/node/blob/bbab963db80528f3f932269774f1d5d6012fbb68/lib/internal/buffer.js#L569-L629
    function writeBigU_Int64LE(buf: Buffer, value: bigint, offset: number, min: bigint, max: bigint) {
        checkInt(value, min, max, buf, offset, 7);

        let lo = Number(value & BigInt("0xffffffff"));
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        let hi = Number(value >> BigInt(32) & BigInt("0xffffffff"));
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        return offset;
    }

    export function writeBigUInt64LE(buffer: Buffer, value: bigint, offset: number = 0) {
        return writeBigU_Int64LE(buffer, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    }

    function writeBigU_Int64BE(buf: Buffer, value: bigint, offset: number, min: bigint, max: bigint) {
        checkInt(value, min, max, buf, offset, 7);

        let lo = Number(value & BigInt("0xffffffff"));
        buf[offset + 7] = lo;
        lo = lo >> 8;
        buf[offset + 6] = lo;
        lo = lo >> 8;
        buf[offset + 5] = lo;
        lo = lo >> 8;
        buf[offset + 4] = lo;
        let hi = Number(value >> BigInt(32) & BigInt("0xffffffff"));
        buf[offset + 3] = hi;
        hi = hi >> 8;
        buf[offset + 2] = hi;
        hi = hi >> 8;
        buf[offset + 1] = hi;
        hi = hi >> 8;
        buf[offset] = hi;
        return offset + 8;
    }

    export function writeBigUInt64BE(buffer: Buffer, value: bigint, offset = 0) {
        return writeBigU_Int64BE(buffer, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    }

    export function writeBigInt64LE(buffer: Buffer, value: bigint, offset = 0) {
        return writeBigU_Int64LE(buffer, value, offset, BigInt(-1) * BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    }

    export function writeBigInt64BE(buffer: Buffer, value: bigint, offset = 0) {
        return writeBigU_Int64BE(buffer, value, offset, BigInt(-1) * BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    }

    //https://github.com/nodejs/node/blob/bbab963db80528f3f932269774f1d5d6012fbb68/lib/internal/buffer.js#L68-L80
    function boundsError(value: number, length: number) {
        if (Math.floor(value) !== value) {
            throw new RangeError(`The value of offset is out of range. It must be an integer. Received ${value}`);
        }

        if (length < 0) {
            throw new RangeError("Attempt to access memory outside buffer bounds");
        }

        throw new RangeError(`The value of offset is out of range. It must be >= 0 and <= ${length}. Received ${value}`);
    }

    // https://github.com/nodejs/node/blob/bbab963db80528f3f932269774f1d5d6012fbb68/lib/internal/buffer.js#L49-L66
    function checkInt(value: bigint | number, min: bigint | number, max: bigint | number, buf: Buffer, offset: number, byteLength: number) {
        if (value > max || value < min) {
            const n = typeof min === 'bigint' ? 'n' : '';
            let range;
            if (byteLength > 3) {
                if (min === 0 || min === BigInt("0")) {
                    range = `>= 0${n} and < 2${n} ** ${(byteLength + 1) * 8}${n}`;
                } else {
                    range = `>= -(2${n} ** ${(byteLength + 1) * 8 - 1}${n}) and < 2 ** ` +
                        `${(byteLength + 1) * 8 - 1}${n}`;
                }
            } else {
                range = `>= ${min}${n} and <= ${max}${n}`;
            }

            throw new RangeError(`The value of value is out of range. It must be ${range}. Received ${value}`);
        }


        checkBounds(buf, offset, byteLength);
    }

    // https://github.com/nodejs/node/blob/bbab963db80528f3f932269774f1d5d6012fbb68/lib/internal/buffer.js#L43
    function checkBounds(buf: Buffer, offset: number, byteLength: number) {
        if (buf[offset] === undefined || buf[offset + byteLength] === undefined)
            boundsError(offset, buf.length - (byteLength + 1));
    }

}
