import DomProcessor from './dom';
import DomAdapter from './dom/adapter-server';
import * as Const from '../const';
import * as contentUtils from '../utils/content';
import whacko from 'whacko';

const BODY_CREATED_EVENT_SCRIPT = [
    `<script type="text/javascript" class="${Const.SHADOW_UI_SCRIPT_CLASSNAME}">
        if (window.Hammerhead)
           window.Hammerhead._raiseBodyCreatedEvent();
        var script = document.currentScript || document.scripts[document.scripts.length - 1];
        script.parentNode.removeChild(script);
    </script>`
].join('\n');

var domProcessor = new DomProcessor(new DomAdapter());

function getPageProcessingOptions (ctx, urlReplacer) {
    return {
        crossDomainProxyPort: ctx.serverInfo.crossDomainPort,
        isIFrame:             ctx.isIFrame,
        styleUrl:             ctx.getInjectableStyles()[0],
        scripts:              ctx.getInjectableScripts(),
        urlReplacer:          urlReplacer,
        isIframeWithImageSrc: ctx.contentInfo && ctx.contentInfo.isIFrameWithImageSrc
    };
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
        resources.push(Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME);
        resources.push('"href = "');
        resources.push(processingOptions.styleUrl);
        resources.push('">');
    }

    if (processingOptions.scripts) {
        processingOptions.scripts.forEach(function (scriptUrl) {
            resources.push('<script type="text/javascript" class="');
            resources.push(Const.SHADOW_UI_SCRIPT_CLASSNAME);
            resources.push('" charset="UTF-8" src="');
            resources.push(scriptUrl);
            resources.push('">');
            resources.push('</script>');
        });
    }

    if (resources.length)
        $('head').prepend(resources.join(''));
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

export function process (html, ctx, actualCharset, urlReplacer, processingOpts) {
    processingOpts = processingOpts || getPageProcessingOptions(ctx, urlReplacer);

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

            var result = process(iframeHtml, ctx, actualCharset, urlReplacer, processingOpts);

            processingOpts.isIFrame = storedIsIframe;

            callback(result);
        };

        var pageProcessor = new DomProcessor(new DomAdapter(processingOpts.isIFrame, processingOpts.crossDomainProxyPort));

        pageProcessor.on(pageProcessor.HTML_PROCESSING_REQUIRED, iframeHtmlProcessor);
        pageProcessor.processPage($, processingOpts.urlReplacer);
        pageProcessor.off(pageProcessor.HTML_PROCESSING_REQUIRED, iframeHtmlProcessor);

        addPageResources($, processingOpts);
        addBodyCreatedEventScript($);
        changeMetas($);

        return (bom || '') + $.html();
    }
}
