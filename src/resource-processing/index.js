import url from 'url';
import urlUtil from '..//url-util';
import whacko from 'whacko';
import * as ERR from '../errs';
import ProcessedJsCache from './processed-js-cache';
import * as sharedConst from '..//const';
import DomProcessor from '..//dom-processor';
import DomProcStrategy from './dom-processor-strategy-server';
import * as contentUtils from '../utils/content';

const BODY_CREATED_EVENT_SCRIPT = [
    `<script type="text/javascript" class="${sharedConst.SHADOW_UI_SCRIPT_CLASSNAME}">
        if (window.Hammerhead)
           window.Hammerhead._raiseBodyCreatedEvent();
        var script = document.currentScript || document.scripts[document.scripts.length - 1];
        script.parentNode.removeChild(script);
    </script>`
].join('\n');

var jsCache = new ProcessedJsCache();
var domProcessor = new DomProcessor(new DomProcStrategy());

var processors = {
    page: function (html, ctx, actualCharset, processingOpts) {
        processingOpts = processingOpts || getPageProcessingOptions(ctx);

        var defaultCharset = ctx.contentInfo.charset;

        var bom = domProcessor.getBOM(html);

        html = bom ? html.replace(bom, '') : html;

        prepareHtml(html, processingOpts);

        var $ = whacko.load(html);

        actualCharset = actualCharset || defaultCharset;

        var rightCharset = getRightCharset($, defaultCharset, actualCharset);

        // Restart processing with page charset
        if (rightCharset)
            process(ctx, rightCharset);
        else {
            var iframeHtmlProcessor = function (iframeHtml, callback) {
                var storedIsIframe = processingOpts.isIFrame;

                processingOpts.isIFrame = true;

                var result = processors.page(iframeHtml, ctx, actualCharset, processingOpts);

                processingOpts.isIFrame = storedIsIframe;

                callback(result);
            };

            var pageProcessor = new DomProcessor(new DomProcStrategy(processingOpts.isIFrame, processingOpts.crossDomainProxyPort));

            pageProcessor.on(pageProcessor.HTML_PROCESSING_REQUIRED, iframeHtmlProcessor);
            pageProcessor.processPage($, processingOpts.urlReplacer);
            pageProcessor.off(pageProcessor.HTML_PROCESSING_REQUIRED, iframeHtmlProcessor);

            addPageResources($, processingOpts);
            addBodyCreatedEventScript($);
            changeMetas($);

            return (bom || '') + $.html();
        }
    },

    script: function (script) {
        var processedJs = jsCache.pick(script);

        if (!processedJs) {
            processedJs = domProcessor.processScript(script);
            jsCache.add(script, processedJs);
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

    if (ctx.isPage || ctx.contentInfo.isIFrameWithImageSrc)
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

// Page processor
function getPageProcessingOptions (ctx) {
    return {
        crossDomainProxyPort: ctx.serverInfo.crossDomainPort,
        isIFrame:             ctx.isIFrame,
        styleUrl:             ctx.getInjectableStyles()[0],
        scripts:              ctx.getInjectableScripts(),
        urlReplacer:          getResourceUrlReplacer(ctx),
        isIframeWithImageSrc: ctx.contentInfo && ctx.contentInfo.isIFrameWithImageSrc
    };
}

function getPageCharset ($) {
    var metas = [];

    $('meta').each(function (meta) {
        var $meta = $(meta);

        metas.push({
            httpEquiv: $meta.attr('http-equiv'),
            content:   $meta.attr('content'),
            charset:   $meta.attr('charset')
        });
    });

    return contentUtils.parseCharsetFromMeta(metas);
}

function addPageResources ($, processingOptions) {
    var resources = [];

    if (processingOptions.styleUrl) {
        resources.push('<link rel="stylesheet" type="text/css" class="');
        resources.push(sharedConst.SHADOW_UI_STYLESHEET_FULL_CLASSNAME);
        resources.push('"href = "');
        resources.push(processingOptions.styleUrl);
        resources.push('">');
    }

    if (processingOptions.scripts) {
        processingOptions.scripts.forEach(function (scriptUrl) {
            resources.push('<script type="text/javascript" class="');
            resources.push(sharedConst.SHADOW_UI_SCRIPT_CLASSNAME);
            resources.push('" charset="UTF-8" src="');
            resources.push(scriptUrl);
            resources.push('">');
            resources.push('</script>');
        });
    }

    if (resources.length)
        $('head').prepend(resources.join(''));
}

function getRightCharset ($, defaultCharset, actualCharset) {
    if (!defaultCharset) {
        // NOTE: if the charset doesn't set in server's header and if the charset sets in page's meta tag
        // and isn't equal to the default charset, we restart processing with the new charset.
        // We returns null if need to restart procession.
        var pageCharset = getPageCharset($);

        if (pageCharset && pageCharset !== actualCharset)
            return pageCharset;
    }

    return '';
}

function changeMetas ($) {
    // TODO: figure out how to emulate the behavior of the tag
    $('meta[name="referrer"][content="origin"]').remove();
    // NOTE: Remove existing compatible meta tag and add a new at the beginning of the head
    $('meta[http-equiv="X-UA-Compatible"]').remove();
    $('head').prepend('<meta http-equiv="X-UA-Compatible" content="IE=edge" />');
}

function prepareHtml (html, processingOpts) {
    if (processingOpts && processingOpts.iframeImageSrc)
        return '<html><body><img src="' + processingOpts.iframeImageSrc + '" /></body></html>';

    return html;
}

function addBodyCreatedEventScript ($) {
    $('body').prepend(BODY_CREATED_EVENT_SCRIPT);
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

    var processed = processor(decoded, ctx, charset);

    if (processed === null)
        return null;

    return await encode(processed, encoding, charset);
}
