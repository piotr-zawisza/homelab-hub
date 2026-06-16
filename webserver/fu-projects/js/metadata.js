export const PNGMetadata = {
    crcTable: (function() {
        let c; let table = [];
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            table[n] = c;
        }
        return table;
    })(),
    crc32: function(buf) {
        let crc = 0 ^ (-1);
        for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ this.crcTable[(crc ^ buf[i]) & 0xFF];
        return (crc ^ (-1)) >>> 0;
    },
    writeChunk: function(type, data) {
        const typeArray = new TextEncoder().encode(type);
        const chunk = new Uint8Array(4 + 4 + data.length + 4);
        const view = new DataView(chunk.buffer);
        view.setUint32(0, data.length);
        chunk.set(typeArray, 4);
        chunk.set(data, 8);
        const crcData = new Uint8Array(4 + data.length);
        crcData.set(typeArray, 0);
        crcData.set(data, 4);
        view.setUint32(8 + data.length, this.crc32(crcData));
        return chunk;
    },
    inject: async function(blob, keyword, text) {
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const keywordData = new TextEncoder().encode(keyword);
        const textData = new TextEncoder().encode(text);
        const chunkData = new Uint8Array(keywordData.length + 1 + textData.length);
        chunkData.set(keywordData, 0);
        chunkData[keywordData.length] = 0;
        chunkData.set(textData, keywordData.length + 1);
        const newChunk = this.writeChunk('tEXt', chunkData);
        let iendPos = buffer.length - 12;
        const newBuffer = new Uint8Array(buffer.length + newChunk.length);
        newBuffer.set(buffer.slice(0, iendPos), 0);
        newBuffer.set(newChunk, iendPos);
        newBuffer.set(buffer.slice(iendPos), iendPos + newChunk.length);
        return new Blob([newBuffer], { type: 'image/png' });
    },
    extract: async function(blob, targetKeyword) {
        const arrayBuffer = await blob.arrayBuffer();
        const view = new DataView(arrayBuffer);
        const buffer = new Uint8Array(arrayBuffer);
        if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null;
        let offset = 8;
        const decoder = new TextDecoder();
        while (offset < buffer.length) {
            const length = view.getUint32(offset);
            const type = decoder.decode(buffer.slice(offset + 4, offset + 8));
            if (type === 'tEXt') {
                const data = buffer.slice(offset + 8, offset + 8 + length);
                const nullPos = data.indexOf(0);
                if (nullPos !== -1) {
                    const keyword = decoder.decode(data.slice(0, nullPos));
                    if (keyword === targetKeyword) return decoder.decode(data.slice(nullPos + 1));
                }
            }
            if (type === 'IEND') break;
            offset += 12 + length;
        }
        return null;
    }
};