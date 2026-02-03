import { pipeline } from '@huggingface/transformers';

class MemoryEmbedder {
    pipe = null;

    async init() {
        console.log("Loading BGE-Large (ONNX)... This takes a moment on first run.");
        this.pipe = await pipeline('feature-extraction', 'Xenova/bge-large-en-v1.5');
        console.log("Model Loaded!");
    }

    async createMemoryObject(
        text, 
        speakerId, 
        audience, 
        location, 
        msgType = "chat"
    ) {
        if (!this.pipe) throw new Error("Initialize with .init() first!");

        // Generate normalized embedding
        const result = await this.pipe(text, { pooling: 'mean', normalize: true });
        
        // result.data is already a Float32Array-like object
        const embedding = Array.from(result.data);

        return {
            id: crypto.randomUUID(),// reconsider this attribute. 
            embedding,
            content: text,
            metadata: {
                speaker_id: speakerId,
                audience,
                location,
                timestamp: Math.floor(Date.now() / 1000),
                msg_type: msgType
            }
        };
    }


        // Inside MemoryEmbedder class
    async getQueryVector(text) {
        if (!this.pipe) throw new Error("Initialize with .init() first!");
        const result = await this.pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }
}

export { MemoryEmbedder };