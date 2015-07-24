import Crypto from 'crypto';

//NOTE: Max cache size is 50 MBytes
const MAX_SIZE = 50 * 1024 * 1024;
//NOTE: clean up cache to the half of the max size
const CLEAN_UP_DEST_SIZE = Math.round(MAX_SIZE / 2);

export default class ProcessedJSCache {
    //TODO use LRU cache instead

    constructor () {
        this.items = {};
        this.size  = 0;
    }

    _cleanUp () {
        var cache = this;

        var lruOrdered = Object.keys(this.items)
            //NOTE: map cache data to {digest, lastUse} pair
            .map((digest) => ({
                digest:  digest,
                lastUse: cache.items[digest].lastUse
            }))
            //NOTE: sort it by lastUse
            .sort((a, b) => a.lastUse > b.lastUse ? 1 : -1);

        for (var i = 0; i < lruOrdered.length; i++) {
            var digest = lruOrdered[i].digest;

            cache.size -= cache.items[digest].size;
            delete cache.items[digest];

            if (cache.size <= CLEAN_UP_DEST_SIZE)
                break;
        }
    }

    add (js, processedJs) {
        var cache   = this;
        var lastUse = new Date().getTime();

        setTimeout(function () {
            var hash = Crypto.createHash('md5');

            hash.update(js);

            var digest = hash.digest('hex');
            var size   = processedJs.length;

            cache.size += size;

            cache.items[digest] = {
                data:    processedJs,
                size:    size,
                lastUse: lastUse
            };

            if (cache.size > MAX_SIZE)
                cache._cleanUp();
        });
    }

    pick (js) {
        var hash = Crypto.createHash('md5');

        hash.update(js);

        var digest    = hash.digest('hex');
        var cacheItem = this.items[digest];

        if (cacheItem) {
            cacheItem.lastUse = new Date().getTime();

            return cacheItem.data;
        }

        return null;
    }
}
