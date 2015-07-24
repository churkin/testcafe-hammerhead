import UrlUtil from './url-util';
import JSProcessor from './js-processor';
import SharedConst from './const';
import SharedUtil from './util';

var CSS_URL_PROPERTY_VALUE_PATTERN = /(url\s*\(\s*)(?:(')([^\s']*)(')|(")([^\s"]*)(")|([^\s\)]*))(\s*\))|(@import\s+)(?:(')([^\s']*)(')|(")([^\s"]*)("))/g;

var BOM_REGEX = new RegExp( // Byte Order Mark
    '^(\\xEF\\xBB\\xBF|' +
    '\\xFE\\xFF|' +
    '\\xFF\\xFE|' +
    '\\x00\\x00\\xFE\\xFF|' +
    '\\xFF\\xFE\\x00\\x00|' +
    '\\x2B\\x2F\\x76\\x38|' +
    '\\x2B\\x2F\\x76\\x39|' +
    '\\x2B\\x2F\\x76\\x2B|' +
    '\\x2B\\x2F\\x76\\x2F|' +
    '\\xF7\\x64\\x4C|' +
    '\\xDD\\x73\\x66\\x73|' +
    '\\x0E\\xFE\\xFF|' +
    '\\xFB\\xEE\\x28|' +
    '\\x84\\x31\\x95\\x33)'
);

var CDATA_REG_EX     = /^(\s)*\/\/<!\[CDATA\[([\s\S]*)\/\/\]\]>(\s)*$/;
var EMPTY_URL_REG_EX = /^(\w+:)?\/\/\:0/;// Ignore '//:0/' url (http://www.myntra.com/)
var HTML_COMMENT_POSTFIX_REG_EX        = /(\/\/[^\n]*|\n\s*)-->[^\n]*([\n\s]*)?$/;
var HTML_COMMENT_PREFIX_REG_EX         = /^(\s)*<!--[^\n]*\n/;
var HTML_COMMENT_SIMPLE_POSTFIX_REG_EX = /-->\s*$/;
var HTML_STRING_REG_EX                 = /^\s*('|")\s*(<[\s\S]+>)\s*('|")\s*$/;
var JAVASCRIPT_PROTOCOL_REG_EX         = /^\s*javascript\s*:/i;
var SOURCE_MAP_REG_EX                  = /#\s*sourceMappingURL\s*=\s*[^\s]+(\s|\*\/)/i;
var URL_ATTRS                          = ['href', 'src', 'action', 'manifest', 'data'];

var URL_ATTR_TAGS = {
    href:     ['a', 'link', 'image', 'area', 'base'],
    src:      ['img', 'embed', 'script', 'source', 'video', 'audio', 'input', 'frame', 'iframe'],
    action:   ['form'],
    manifest: ['html'],
    data:     ['object']
};

var TARGET_ATTR_TAGS = {
    a:    true,
    form: true,
    area: true,
    base: true
};

var DomProc = function (strategy) {
    var domProc = this;

    this.strategy         = strategy;
    this.IFRAME_FLAG_TAGS = this.strategy.IFRAME_FLAG_TAGS;
    this.EVENTS           = this.strategy.EVENTS;

    this.strategy.attachEventEmitter(this);

    this.IS_STYLESHEET_PROCESSED_REG_EX = new RegExp('^\\s*' + SharedConst.IS_STYLESHEET_PROCESSED_COMMENT
            .replace(/\/|\*/g, '\\$&'));
    this.OVERRIDE_DOM_METH_SCRIPT       = 'window["' + SharedConst.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME + '"]';
    this.SCRIPT_HEADER                  = '\r\ntypeof window !== "undefined" && ' + this.OVERRIDE_DOM_METH_SCRIPT +
                                          ' && ' + this.OVERRIDE_DOM_METH_SCRIPT + '();\r\n' +
                                          JSProcessor.MOCK_ACCESSORS;
    this.SCRIPT_HEADER_REG_EX           = new RegExp('^\\s*typeof[^\\n]+' +
                                                     SharedConst.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME +
                                                     '[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+\\n[^\\n]+__proc\\$Script;', 'i');

    var selectors = {
        HAS_HREF_ATTR: function (el) {
            var tagName = domProc.strategy.getTagName(el).toLowerCase();

            return URL_ATTR_TAGS.href.indexOf(tagName) !== -1;
        },

        HAS_SRC_ATTR: function (el) {
            var tagName = domProc.strategy.getTagName(el).toLowerCase();

            return URL_ATTR_TAGS.src.indexOf(tagName) !== -1;
        },

        HAS_ACTION_ATTR: function (el) {
            var tagName = domProc.strategy.getTagName(el).toLowerCase();

            return URL_ATTR_TAGS.action.indexOf(tagName) !== -1;
        },

        HAS_MANIFEST_ATTR: function (el) {
            var tagName = domProc.strategy.getTagName(el).toLowerCase();

            return URL_ATTR_TAGS.manifest.indexOf(tagName) !== -1;
        },

        HAS_DATA_ATTR: function (el) {
            var tagName = domProc.strategy.getTagName(el).toLowerCase();

            return URL_ATTR_TAGS.data.indexOf(tagName) !== -1;
        },

        HTTP_EQUIV_META: function (el) {
            var tagName = domProc.strategy.getTagName(el).toLowerCase();

            return tagName === 'meta' && domProc.strategy.hasAttr(el, 'http-equiv');
        },

        ALL: function () {
            return true;
        },

        IS_SCRIPT: function (el) {
            return domProc.strategy.getTagName(el).toLowerCase() === 'script';
        },

        IS_INPUT: function (el) {
            return domProc.strategy.getTagName(el).toLowerCase() === 'input';
        },

        IS_STYLE: function (el) {
            return domProc.strategy.getTagName(el).toLowerCase() === 'style';
        },

        HAS_EVENT_HANDLER: function (el) {
            return domProc.strategy.hasEventHandler(el);
        },

        IS_SANDBOXED_IFRAME: function (el) {
            return domProc.strategy.getTagName(el).toLowerCase() === 'iframe' &&
                   domProc.strategy.hasAttr(el, 'sandbox');
        }
    };

    this.HTML_STRING_REG_EX         = HTML_STRING_REG_EX;
    this.JAVASCRIPT_PROTOCOL_REG_EX = JAVASCRIPT_PROTOCOL_REG_EX;
    this.TARGET_ATTR_TAGS           = TARGET_ATTR_TAGS;
    this.URL_ATTR_TAGS              = URL_ATTR_TAGS;
    this.URL_ATTRS                  = URL_ATTRS;

    this.HTML_PROCESSING_REQUIRED = 'HTML_PROCESSING_REQUIRED';

    this.elementProcessorPatterns = [
        {
            selector:          selectors.HAS_HREF_ATTR,
            urlAttr:           'href',
            elementProcessors: [this.processTargetBlank, this.processUrlAttrs, this.processUrlJsAttr]
        },
        {
            selector:          selectors.HAS_SRC_ATTR,
            urlAttr:           'src',
            elementProcessors: [this.processTargetBlank, this.processUrlAttrs, this.processUrlJsAttr]
        },
        {
            selector:          selectors.HAS_ACTION_ATTR,
            urlAttr:           'action',
            elementProcessors: [this.processTargetBlank, this.processUrlAttrs, this.processUrlJsAttr]
        },
        {
            selector:          selectors.HAS_MANIFEST_ATTR,
            urlAttr:           'manifest',
            elementProcessors: [this.processUrlAttrs, this.processUrlJsAttr]
        },
        {
            selector:          selectors.HAS_DATA_ATTR,
            urlAttr:           'data',
            elementProcessors: [this.processUrlAttrs, this.processUrlJsAttr]
        },
        { selector: selectors.HTTP_EQUIV_META, urlAttr: 'content', elementProcessors: [this.processMetaElement] },
        { selector: selectors.ALL, elementProcessors: [this.processStyleAttr] },
        { selector: selectors.IS_SCRIPT, elementProcessors: [this.processScriptElement] },
        { selector: selectors.IS_STYLE, elementProcessors: [this.processStylesheetElement] },
        { selector: selectors.IS_INPUT, elementProcessors: [this.processAutoComplete] },
        { selector: selectors.HAS_EVENT_HANDLER, elementProcessors: [this.processEvtAttr] },
        { selector: selectors.IS_SANDBOXED_IFRAME, elementProcessors: [this.processSandboxedIframe] }
    ];
};

function isTopParentIFrame (el) {
    var elWindow = el[SharedConst.DOM_SANDBOX_PROCESSED_CONTEXT];

    return elWindow && window.top === elWindow.parent;
}

// Element processors
DomProc.prototype.processAutoComplete = function (el) {
    var storedUrlAttr = this.getStoredAttrName('autocomplete');
    var processed     = this.strategy.hasAttr(el, storedUrlAttr);
    var attrValue     = this.strategy.getAttr(el, processed ? storedUrlAttr : 'autocomplete');

    if (!processed)
        this.strategy.setAttr(el, storedUrlAttr, attrValue || attrValue === '' ? attrValue : 'none');

    this.strategy.setAttr(el, 'autocomplete', 'off');
};

DomProc.prototype.processJsAttr = function (el, attr, jsProtocol) {
    var storedUrlAttr = this.getStoredAttrName(attr);
    var processed     = this.strategy.hasAttr(el, storedUrlAttr);
    var attrValue     = this.strategy.getAttr(el, processed ? storedUrlAttr : attr);

    var code    = jsProtocol ? attrValue.replace(JAVASCRIPT_PROTOCOL_REG_EX, '') : attrValue;
    var matches = code.match(HTML_STRING_REG_EX);

    var domProc = this;

    var setAttributes = function (value, processedValue, processedAttrValue) {
        if (value !== processedValue) {
            if (!processed)
                domProc.strategy.setAttr(el, storedUrlAttr, attrValue);

            domProc.strategy.setAttr(el, attr, processedAttrValue);
        }
    };

    if (matches && jsProtocol) {
        var html = matches[2];

        this.emit(this.HTML_PROCESSING_REQUIRED, html, function (processedHTML) {
            /*eslint-disable no-script-url*/
            var processedAttrValue = 'javascript:\'' + processedHTML.replace(/'/g, "\\'") + '\'';

            /*eslint-enable no-script-url*/
            setAttributes(html, processedHTML, processedAttrValue);
        });

    }
    else {
        var processedCode      = this.processScript(code, true);
        var processedAttrValue = processedCode;

        /*eslint-disable no-script-url*/
        if (jsProtocol)
            processedAttrValue = 'javascript:' + processedAttrValue;
        /*eslint-enable no-script-url*/

        setAttributes(code, processedCode, processedAttrValue);
    }
};

DomProc.prototype.processEvtAttr = function (el) {
    for (var i = 0; i < this.EVENTS.length; i++) {
        var attrValue = this.strategy.getAttr(el, this.EVENTS[i]);

        if (attrValue)
            this.processJsAttr(el, this.EVENTS[i], JAVASCRIPT_PROTOCOL_REG_EX.test(attrValue));
    }
};

DomProc.prototype.processMetaElement = function (el, urlReplacer, pattern) {
    if (this.strategy.getAttr(el, 'http-equiv').toLowerCase() === 'refresh') {
        var attr = this.strategy.getAttr(el, pattern.urlAttr);

        attr = attr.replace(/(url=)(.*)$/i, function () {
            return arguments[1] + urlReplacer(arguments[2]);
        });

        this.strategy.setAttr(el, pattern.urlAttr, attr);
    }
};

DomProc.prototype.processSandboxedIframe = function (el) {
    var attrValue = this.strategy.getAttr(el, 'sandbox');

    if (attrValue.indexOf('allow-scripts') === -1) {
        var storedAttr = this.getStoredAttrName('sandbox');

        this.strategy.setAttr(el, storedAttr, attrValue);
        this.strategy.setAttr(el, 'sandbox', attrValue + ' allow-scripts');
    }
};

DomProc.prototype.processScriptElement = function (script) {
    var scriptContent = this.strategy.getScriptContent(script);

    if (!scriptContent)
        return;

    var scriptProcessedOnServer = JSProcessor.isScriptProcessed(scriptContent);

    if (scriptProcessedOnServer)
        return;

    // NOTE: we do not process scripts that are not executed during a page loading. We process scripts with type
    // text/javascript, application/javascript etc. (list of MIME types is specified in the w3c.org html5
    // specification). If type is not set, it 'text/javascript' by default.
    var scriptType                 = this.strategy.getAttr(script, 'type');
    var executableScriptTypesRegEx = /(application\/((x-)?ecma|(x-)?java)script)|(text\/)(javascript(1\.{0-5})?|((x-)?ecma|x-java|js|live)script)/;
    var isExecutableScript         = !scriptType || executableScriptTypesRegEx.test(scriptType);

    if (isExecutableScript) {
        var result              = scriptContent;
        var commentPrefix       = '';
        var commentPrefixMatch  = result.match(HTML_COMMENT_PREFIX_REG_EX);
        var commentPostfix      = '';
        var commentPostfixMatch = null;
        var hasCDATA            = CDATA_REG_EX.test(result);

        if (commentPrefixMatch) {
            commentPrefix       = commentPrefixMatch[0];
            commentPostfixMatch = result.match(HTML_COMMENT_POSTFIX_REG_EX);

            if (commentPostfixMatch)
                commentPostfix = commentPostfixMatch[0];
            else if (!HTML_COMMENT_SIMPLE_POSTFIX_REG_EX.test(commentPrefix))
                commentPostfix = '//-->';

            result = result.replace(commentPrefix, '').replace(commentPostfix, '');
        }

        if (hasCDATA)
            result = result.replace(CDATA_REG_EX, '$2');

        result = commentPrefix + this.processScript(result) + commentPostfix;

        if (hasCDATA)
            result = '\n//<![CDATA[\n' + result + '//]]>';

        this.strategy.setScriptContent(script, result);
    }
};

DomProc.prototype.processStyleAttr = function (el, urlReplacer) {
    var style = this.strategy.getAttr(el, 'style');

    if (style)
        this.strategy.setAttr(el, 'style', this.processStylesheet(style, urlReplacer));
};

DomProc.prototype.processStylesheetElement = function (el, urlReplacer) {
    var content = this.strategy.getStyleContent(el);

    if (content && urlReplacer) {
        content = this.processStylesheet(content, urlReplacer, true);

        this.strategy.setStyleContent(el, content);
    }
};

DomProc.prototype.processTargetBlank = function (el) {
    // NOTE: replace target='_blank' to avoid popups
    var attrValue = this.strategy.getAttr(el, 'target');

    // NOTE: Value may have whitespace
    attrValue = attrValue && attrValue.replace(/\s/g, '');

    if (attrValue === '_blank' || attrValue === 'blank')
        this.strategy.setAttr(el, 'target', '_self');
};

DomProc.prototype.processUrlAttrs = function (el, urlReplacer, pattern) {
    if (urlReplacer && pattern.urlAttr) {
        var storedUrlAttr     = this.getStoredAttrName(pattern.urlAttr);
        var resourceUrl       = this.strategy.getAttr(el, pattern.urlAttr);
        var processedOnServer = !!this.strategy.getAttr(el, storedUrlAttr);

        // NOTE: page resource URL with proxy URL
        if ((resourceUrl || resourceUrl === '') && !processedOnServer) {
            if (UrlUtil.isSupportedProtocol(resourceUrl) && !EMPTY_URL_REG_EX.test(resourceUrl)) {
                var elTagName    = this.strategy.getTagName(el).toLowerCase();
                var isIframe     = elTagName === 'iframe';
                var isScript     = elTagName === 'script';
                var resourceType = null;
                var target       = this.strategy.getAttr(el, 'target');

                // On the server the elements shouldn't process with target=_parent,
                // because we don't know who is the parent of the processing page (iframe or top window)
                if (!this.strategy.needToProcessUrl(elTagName, target))
                    return;

                if (isIframe || this.isOpenLinkInIFrame(el))
                    resourceType = UrlUtil.IFRAME;
                else if (isScript)
                    resourceType = UrlUtil.SCRIPT;

                var parsedResourceUrl = UrlUtil.parseUrl(resourceUrl);
                var isRelativePath    = !parsedResourceUrl.host;
                var proxyUrl          = '';

                // NOTE: Only non relative iframe src can be cross-domain
                if (isIframe && !isRelativePath) {
                    var location = urlReplacer('/');
                    var proxyUrlObj = UrlUtil.parseProxyUrl(location);
                    var originUrl = proxyUrlObj.originUrl;

                    if (!parsedResourceUrl.protocol)
                        resourceUrl = proxyUrlObj.originResourceInfo.protocol + resourceUrl;

                    // Cross-domain iframe
                    if (!UrlUtil.sameOriginCheck(originUrl, resourceUrl)) {
                        var proxyHostname = UrlUtil.parseUrl(location).hostname;

                        proxyUrl = resourceUrl ? this.strategy.getProxyUrl(resourceUrl, proxyHostname,
                                                 this.strategy.getCrossDomainPort(), proxyUrlObj.jobInfo.uid,
                                                 proxyUrlObj.jobInfo.ownerToken, UrlUtil.IFRAME) : '';
                    }

                }
                proxyUrl = proxyUrl === '' && resourceUrl ? urlReplacer(resourceUrl, resourceType) : proxyUrl;

                this.strategy.setAttr(el, storedUrlAttr, resourceUrl);

                if (elTagName === 'img' && proxyUrl !== '')
                    this.strategy.setAttr(el, pattern.urlAttr, UrlUtil.resolveUrlAsOrigin(resourceUrl, urlReplacer));
                else
                    this.strategy.setAttr(el, pattern.urlAttr, proxyUrl);
            }
        }
    }
};

DomProc.prototype.processUrlJsAttr = function (el, urlReplacer, pattern) {
    if (JAVASCRIPT_PROTOCOL_REG_EX.test(this.strategy.getAttr(el, pattern.urlAttr)))
        this.processJsAttr(el, pattern.urlAttr, true);
};

function isTestCafeElement (el) {
    return typeof el.className === 'string' && el.className.indexOf(SharedConst.SHADOW_UI_CLASSNAME_POSTFIX) > -1;
}

DomProc.prototype.processPage = function ($, urlReplacer) {
    var $base    = $('base');
    var baseUrl  = $base.length ? this.strategy.getAttr($base[0], 'href') : '';
    var domProc = this;

    function replacer (resourceUrl, resourceType) {
        return urlReplacer(resourceUrl, resourceType, baseUrl);
    }

    var $all = $('*');

    for (var i = 0; i < this.elementProcessorPatterns.length; i++) {
        var pattern = this.elementProcessorPatterns[i];

        /*eslint-disable no-loop-func*/
        $all.filter(function () {
            return pattern.selector(this);
        }).each(function () {
            if (!this[SharedConst.ELEMENT_PROCESSED_FLAG]) {
                for (var j = 0; j < pattern.elementProcessors.length; j++)
                    pattern.elementProcessors[j].call(domProc, this, replacer, pattern);
            }
        });
        /*eslint-enable no-loop-func*/
    }
};

DomProc.prototype.processElement = function (el, urlReplacer) {
    // NOTE: When the 'script' element created it is not executed. It occurs after the element is appended to a
    // document. But in IE 9 only, if you get script's 'document', 'children' or 'all' property, the script is executed
    // at the same time (before it is appended to a document). JQuery element's 'is' function implementation gets
    // 'document' property and the script is executed too early. Therefore we should check clone element instead it. (B237231)
    var elementForSelectorCheck = this.strategy.getElementForSelectorCheck(el);

    for (var i = 0; i < this.elementProcessorPatterns.length; i++) {
        var pattern = this.elementProcessorPatterns[i];

        if (pattern.selector(elementForSelectorCheck) && !isTestCafeElement(el)) {
            for (var j = 0; j < pattern.elementProcessors.length; j++)
                pattern.elementProcessors[j].call(this, el, urlReplacer, pattern);
        }
    }
};

// Utils
DomProc.prototype.getStoredAttrName = function (attr) {
    return attr + SharedConst.DOM_SANDBOX_STORED_ATTR_POSTFIX;
};

DomProc.prototype.getBOM = function (text) {
    var match = text.match(BOM_REGEX);

    return match ? match[0] : null;
};

DomProc.prototype.processScript = function (text, withoutHeader) {
    var bom = this.getBOM(text);

    if (bom)
        text = text.replace(bom, '');

    text = JSProcessor.process(text);

    // Overriding methods that work with the DOM.
    if (!JSProcessor.isDataScript(text) && !withoutHeader &&
        text.indexOf(SharedConst.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME) === -1)
        text = this.SCRIPT_HEADER + text;

    return bom ? bom + text : text;
};

DomProc.prototype.processManifest = function (manifest, urlReplacer) {
    var lines = manifest.split('\n');

    for (var i = 0; i < lines.length; i++) {
        var line = SharedUtil.trim(lines[i]);

        if (line && line !== 'CACHE MANIFEST' && line !== 'NETWORK:' && line !== 'FALLBACK:' &&
            line !== 'CACHE:' && line[0] !== '#' && line !== '*') {

            var isFallbackItem = line.indexOf(' ') !== -1;

            /*eslint-disable indent*/
            if (isFallbackItem) {
                var urls = line.split(' ');

                lines[i] = urlReplacer(urls[0]) + ' ' + urlReplacer(urls[1]);
            }
            else
                lines[i] = urlReplacer(line);
            /*eslint-enable indent*/
        }
    }

    return lines.join('\n');
};

function replaceStylsheetUrls (css, processor) {
    return css.replace(CSS_URL_PROPERTY_VALUE_PATTERN, function () {
        var prefix     = arguments[1] || arguments[10];
        var openQuote  = arguments[2] || arguments[5] || arguments[11] || arguments[14] || '';
        var url        = arguments[3] || arguments[6] || arguments[8] || arguments[12] || arguments[15];
        var closeQuote = arguments[4] || arguments[7] || arguments[13] || arguments[16] || '';
        var postfix    = arguments[9] || '';

        return url ? prefix + openQuote + processor(url) + closeQuote + postfix : arguments[0];
    });
}

DomProc.prototype.processStylesheet = function (css, urlReplacer, isStylesheetTable) {
    var isStylesheetProcessed = this.IS_STYLESHEET_PROCESSED_REG_EX.test(css);

    if (typeof css === 'string' && !isStylesheetProcessed) {
        var prefix = isStylesheetTable ? SharedConst.IS_STYLESHEET_PROCESSED_COMMENT + '\n' : '';

        // Replace :hover pseudo class
        css = css.replace(/\s*:\s*hover(\W)/gi, '[' + SharedConst.HOVER_PSEUDO_CLASS_ATTR + ']$1');

        // Remove source map directive
        css = css.replace(SOURCE_MAP_REG_EX, '$1');

        // NOTE: replace URLs in css rules with the proxy URLs.
        return prefix + replaceStylsheetUrls(css, urlReplacer);
    }

    return css;
};

DomProc.prototype.cleanUpStylesheet = function (css, parseProxyUrl, formatUrl) {
    if (typeof css === 'string') {
        css = css.replace(new RegExp('\\[' + SharedConst.HOVER_PSEUDO_CLASS_ATTR + '\\](\\W)', 'ig'), ':hover$1');

        return replaceStylsheetUrls(css, function (url) {
            var originUrlObj = parseProxyUrl(url);

            if (originUrlObj)
                return formatUrl(originUrlObj.originResourceInfo);

            return url;
        });
    }

    return css;
};

DomProc.prototype.isOpenLinkInIFrame = function (el) {
    var tagName = this.strategy.getTagName(el).toLowerCase();
    var target  = this.strategy.getAttr(el, 'target');

    if (target !== '_top') {
        var mustProcessTag = this.IFRAME_FLAG_TAGS.indexOf(tagName) !== -1;
        var isNameTarget   = target ? target[0] !== '_' : false;

        if (target === '_parent')
            return mustProcessTag && !isTopParentIFrame(el);

        if (mustProcessTag && (this.strategy.hasIFrameParent(el) || isNameTarget))
            return true;
    }

    return false;
};

export default DomProc;
