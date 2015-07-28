import Crypto from 'crypto';
import Lru from 'lru-cache';

export default class ProcessedJSCache {
    constructor () {
        this.cache = new Lru({
            //NOTE: Max cache size is 50 MBytes
            max: 50 * 1024 * 1024,

            length: function (n) {
                // 1 char ~ 1 byte
                return n.length;
            }
        });
    }

    add (js, processedJs) {
        var hash = Crypto.createHash('md5');

        hash.update(js);

        var digest = hash.digest('hex');

        this.cache.set(digest, processedJs);
    }

    pick (js) {
        var hash = Crypto.createHash('md5');

        hash.update(js);

        var digest = hash.digest('hex');

        return this.cache.get(digest);
    }
}
