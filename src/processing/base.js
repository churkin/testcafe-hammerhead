export default class ProcessorBase {
    processResource (/* ctx, content, charset, urlReplacer */) {
        throw new Error('Not implemented');
    }

    shouldProcessResource (/* ctx */) {
        throw new Error('Not implemented');
    }
}
