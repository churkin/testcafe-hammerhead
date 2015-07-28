export default class DomProcessorStrategy {
    constructor () {
        this.EVENTS = ['onblur', 'onchange', 'onclick', 'oncontextmenu', 'oncopy', 'oncut',
            'ondblclick', 'onerror', 'onfocus', 'onfocusin', 'onfocusout', 'onhashchange', 'onkeydown',
            'onkeypress', 'onkeyup', 'onload', 'onmousedown', 'onmouseenter', 'onmouseleave',
            'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel', 'onpaste', 'onreset',
            'onresize', 'onscroll', 'onselect', 'onsubmit', 'ontextinput', 'onunload', 'onwheel',
            'onpointerdown', 'onpoi nterup', 'onpointercancel', 'onpointermove', 'onpointerover', 'onpointerout',
            'onpointerenter', 'onpointerleave', 'ongotpointercapture', 'onlostpointercapture',
            'onmspointerdown', 'onmspointerup', 'onmspointercancel', 'onmspointermove', 'onmspointerover',
            'onmspointerout', 'onmspointerenter', 'onmspointerleave', 'onmsgotpointercapture', 'onmslostpointercapture'
        ];

        this.IFRAME_FLAG_TAGS = ['a', 'form'];
    }

    getAttr () {
        throw new Error('DomProcessorStrategy#getAttr needs to be overridden.');
    }

    hasAttr () {
        throw new Error('DomProcessorStrategy#hasAttr needs to be overridden.');
    }

    hasEventHandler () {
        throw new Error('DomProcessorStrategy#hasEventHandler needs to be overridden.');
    }

    getTagName () {
        throw new Error('DomProcessorStrategy#getTagName needs to be overridden.');
    }

    setAttr () {
        throw new Error('DomProcessorStrategy#setAttr needs to be overridden.');
    }

    setScriptContent () {
        throw new Error('DomProcessorStrategy#setScriptContent needs to be overridden.');
    }

    getScriptContent () {
        throw new Error('DomProcessorStrategy#getScriptContent needs to be overridden.');
    }

    getStyleContent () {
        throw new Error('DomProcessorStrategy#getStyleContent needs to be overridden.');
    }

    setStyleContent () {
        throw new Error('DomProcessorStrategy#setStyleContent needs to be overridden.');
    }

    getElementForSelectorCheck () {
        throw new Error('DomProcessorStrategy#getElementForSelectorCheck needs to be overridden.');
    }

    needToProcessUrl () {
        throw new Error('DomProcessorStrategy#needToProcessUrl needs to be overridden.');
    }

    attachEventEmitter () {
        throw new Error('DomProcessorStrategy#attachEventEmitter needs to be overridden.');
    }

    hasIFrameParent () {
        throw new Error('DomProcessorStrategy#elementInIFrame needs to be overridden.');
    }

    getCrossDomainPort () {
        throw new Error('DomProcessorStrategy#getCrossDomainPort needs to be overridden.');
    }

    getProxyUrl () {
        throw new Error('DomProcessorStrategy#getProxyUrl needs to be overridden.');
    }

    isTopParentIFrame () {
        throw new Error('DomProcessorStrategy#isTopParentIFrame needs to be overridden.');
    }
}
