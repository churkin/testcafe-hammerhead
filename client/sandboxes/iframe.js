import * as Browser from '../util/browser';
import * as DOM from '../util/dom';
import NativeMethods from './native-methods';
import SharedConst from '../../shared/const';
import * as Service from '../util/service';
import ServiceCommands from '../../shared/service-msg-cmd';
import Transport from '../transport';
import UrlUtil from '../util/url';

// For iframes without src only!
export const IFRAME_READY_TO_INIT          = 'iframeReadyToInit';
export const IFRAME_READY_TO_INIT_INTERNAL = 'iframeReadyToInitInternal';
export const IFRAME_DOCUMENT_CREATED       = 'iframeDocumentCreated';
export const IFRAME_DOCUMENT_RECREATED     = 'iframeDocumentRecreated';

const IFRAME_WINDOW_INITED = 'hh_iwi_5d9138e9';

var eventEmitter = new Service.EventEmitter();

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

export function isIframeInitialized (iframe) {
    var isFFIframeUninitialized = Browser.isMozilla && iframe.contentWindow.document.readyState === 'uninitialized';

    return !isFFIframeUninitialized && !!iframe.contentDocument.documentElement;
}

export function isWindowInited (window) {
    return window[IFRAME_WINDOW_INITED];
}

export function iframeReadyToInitHandler (e) {
    // Get and evaluate iframe task script
    Transport.syncServiceMsg({ cmd: ServiceCommands.GET_IFRAME_TASK_SCRIPT }, function (iFrameTaskScript) {
        e.iframe.contentWindow.eval.apply(e.iframe.contentWindow, [iFrameTaskScript]);
    });
}

eventEmitter.on(IFRAME_READY_TO_INIT, iframeReadyToInitHandler);

function raiseReadyToInitEvent (iframe) {
    if (UrlUtil.isIframeWithoutSrc(iframe)) {
        var iframeInitialized       = isIframeInitialized(iframe);
        var iframeWindowInitialized = iframe.contentWindow[IFRAME_WINDOW_INITED];

        if (iframeInitialized && !iframeWindowInitialized) {
            // Ok, iframe fully loaded now, but Hammerhead not injected
            iframe.contentWindow[IFRAME_WINDOW_INITED] = true;

            // Rise this internal event to eval Hammerhead code script
            eventEmitter.emit(IFRAME_READY_TO_INIT_INTERNAL, {
                iframe: iframe
            });

            // Rise this event to eval "task" script and to call Hammerhead initialization method after
            eventEmitter.emit(IFRAME_READY_TO_INIT, {
                iframe: iframe
            });

            iframe.contentWindow[SharedConst.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME]();
        }
        else if (!iframeInitialized) {
            // Even if iframe is not loaded (iframe.contentDocument.documentElement not exist) we should still
            // override document.write method, without Hammerhead initializing. This method can be called
            // before iframe fully loading, we are obliged to override it now
            if (iframe.contentDocument.write.toString() === NativeMethods.documentWrite.toString()) {
                eventEmitter.emit(IFRAME_DOCUMENT_CREATED, {
                    iframe: iframe
                });
            }
        }
        /*eslint-disable no-empty */
        else if (iframeWindowInitialized && (Browser.isMozilla || Browser.isIE)) {
            // IE recreates iframe document after document.write calling.
            // FireFox recreates iframe document during loading
//                if (iframe.contentDocument.write.toString() === NativeMethods.documentWrite.toString()) {
//                    eventEmitter.emit(IFRAME_DOCUMENT_RECREATED, {
//                        iframe: iframe
//                    });
//                }
        }
        /*eslint-enable no-empty */
    }

}

export function iframeAddedToDom (el) {
    if (!DOM.isShadowUIElement(el)) {
        raiseReadyToInitEvent(el);

        if (!Browser.isWebKit && el.contentDocument) {
            NativeMethods.documentAddEventListener.call(el.contentDocument, 'DOMContentLoaded', function () {
                raiseReadyToInitEvent(el);
            });
        }
    }
}

export function onIframeBeganToRun (iframe) {
    raiseReadyToInitEvent(iframe);
}

export function overrideIframe (el) {
    if (DOM.isShadowUIElement(el))
        return;

    var src = NativeMethods.getAttribute.call(el, 'src');

    if (!src || !UrlUtil.isSupportedProtocol(src)) {
        if (el.contentWindow) {
            raiseReadyToInitEvent(el);

            var readyHandler = function () {
                if (el.contentWindow)
                    raiseReadyToInitEvent(el);
            };

            NativeMethods.addEventListener.call(el, 'load', readyHandler);

            if (Browser.isMozilla)
                NativeMethods.documentAddEventListener.call(el.contentDocument, 'ready', readyHandler);

        }
        else {
            var handler = function () {
                if (!DOM.isShadowUIElement(el)) {
                    if (DOM.isCrossDomainIframe(el))
                        NativeMethods.removeEventListener.call(el, 'load', handler);
                    else
                        raiseReadyToInitEvent(el);
                }
            };

            if (DOM.isElementInDocument(el))
                raiseReadyToInitEvent(el);

            NativeMethods.addEventListener.call(el, 'load', handler);
        }
    }
    else {
        if (DOM.isElementInDocument(el))
            raiseReadyToInitEvent(el);

        NativeMethods.addEventListener.call(el, 'load', function () {
            raiseReadyToInitEvent(el);
        });
    }
}
