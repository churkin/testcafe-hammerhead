import ResourceProcessorBase from './resource-processor-base';
import Lru from 'lru-cache';
import { processScript } from '../script';
import istanbul from 'istanbul';

const instrumenter = new istanbul.Instrumenter();

class ScriptResourceProcessor extends ResourceProcessorBase {
    constructor () {
        super();

        this.jsCache = new Lru({
            // NOTE: Max cache size is 50 MBytes.
            max: 50 * 1024 * 1024,

            length: function (n) {
                // NOTE: 1 char ~ 1 byte.
                return n.length;
            }
        });
    }

    processResource (script, ctx) {
        if (!script)
            return script;

        let processedScript = this.jsCache.get(script);

        if (!processedScript) {
            try {
                console.log(processedScript);
                script = instrumenter.instrumentSync(script, ctx.reqOpts.url);

                const tracker = instrumenter.currentState.trackerVar;

                script = 'window.toptop = window.toptop || []; window.toptop.push("' + tracker + '")' + script;
            } catch (e) {
                console.log(e);
            }

            processedScript = processScript(script, true);
            this.jsCache.set(script, processedScript);
        }

        return processedScript;
    }

    shouldProcessResource (ctx) {
        return ctx.contentInfo.isScript;
    }
}

export default new ScriptResourceProcessor();
