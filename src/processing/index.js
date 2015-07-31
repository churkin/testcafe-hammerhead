import url from 'url';
import urlUtil from '../utils/url';
import * as ERR from '../errs';
import DomProcessor from './dom/index';
import DomAdapter from './dom/adapter-server';
import * as contentUtils from '../utils/content';
import pageProcessor from './page';
import Lru from 'lru-cache';

var jsCache = new Lru({
    //NOTE: Max cache size is 50 MBytes
    max: 50 * 1024 * 1024,

    length: function (n) {
        // 1 char ~ 1 byte
        return n.length;
    }
});

var domProcessor = new DomProcessor(new DomAdapter());

var processors = {
    page: pageProcessor.processResource.bind(pageProcessor),

    script: function (script) {
        var processedJs = jsCache.get(script);

        if (!processedJs) {
            processedJs = domProcessor.processScript(script);
            jsCache.set(script, processedJs);
        }

        return processedJs;
    },

    stylesheet: function (style, ctx) {
        var urlReplacer = getResourceUrlReplacer(ctx);

        return domProcessor.processStylesheet(style, urlReplacer);
    },

    manifest: function (manifest, ctx) {
        var urlReplacer = getResourceUrlReplacer(ctx);

        return domProcessor.processManifest(manifest, urlReplacer);
    },

    json: function (json) {
        return domProcessor.processScript(json, true);
    }
};

function getProcessor (ctx) {
    var contentInfo = ctx.contentInfo;

    if (pageProcessor.shouldProcessResource(ctx))
        return processors.page;

    else if (contentInfo.isCSS)
        return processors.stylesheet;

    else if (contentInfo.isScript && !ctx.isXhr)
        return processors.script;

    else if (contentInfo.isManifest)
        return processors.manifest;

    else if (contentInfo.isJSON)
        return processors.json;

    return null;
}

async function decode (content, encoding, charset) {
    try {
        var decoded = await contentUtils.decodeContent(content, encoding, charset);

        return decoded;
    }
    catch (e) {
        throw { code: ERR.INJECTOR_RESOURCE_DECODING_FAILED, encoding: encoding };
    }
}

async function encode (content, encoding, charset) {
    try {
        var encoded = await contentUtils.encodeContent(content, encoding, charset);

        return encoded;
    }
    catch (e) {
        throw { code: ERR.INJECTOR_RESOURCE_ENCODING_FAILED, encoding: encoding };
    }
}

function getResourceUrlReplacer (ctx) {
    return function (resourceUrl, resourceType, baseUrl) {
        // NOTE: resolve base url without a protocol ('//google.com/path' for example)
        baseUrl     = baseUrl ? url.resolve(ctx.dest.url, baseUrl) : '';
        resourceUrl = urlUtil.prepareUrl(resourceUrl);

        var resolvedUrl = url.resolve(baseUrl || ctx.dest.url, resourceUrl);

        try {
            return ctx.toProxyUrl(resolvedUrl, false, resourceType);
        }
        catch (err) {
            return resourceUrl;
        }
    };
}

// API
export async function process (ctx, customCharset) {
    var body        = ctx.destResBody;
    var contentInfo = ctx.contentInfo;
    var encoding    = contentInfo.encoding;
    var charset     = customCharset || contentInfo.charset;

    var decoded = await decode(body, encoding, charset);

    var processor = getProcessor(ctx);

    if (!processor)
        return body;

    var processed = processor(decoded, ctx, charset, getResourceUrlReplacer(ctx));

    if (processed === null)
        return null;

    return await encode(processed, encoding, charset);
}
