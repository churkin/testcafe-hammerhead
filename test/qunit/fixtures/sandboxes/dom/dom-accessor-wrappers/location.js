var Browser             = Hammerhead.get('./util/browser');
var DomAccessorWrappers = Hammerhead.get('./sandboxes/dom-accessor-wrappers');
var IFrameSandbox       = Hammerhead.get('./sandboxes/iframe');
var UrlUtil             = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

asyncTest('iframe with empty src', function () {
    var $iframe1 = $('<iframe id="test1">');
    var $iframe2 = $('<iframe id="test2" src="">');
    var $iframe3 = $('<iframe id="test3" src="about:blank">');

    function assert ($iframe, callback) {
        $iframe.bind('load', function () {
            DomAccessorWrappers.init(this.contentWindow, this.contentDocument);

            var hyperlink = this.contentDocument.createElement('a');

            hyperlink.setAttribute('href', '/test');
            this.contentDocument.body.appendChild(hyperlink);

            equal(
                eval(processScript('hyperlink.href')),
                'https://example.com/test'
            );

            equal(
                eval(processScript('this.contentDocument.location.href')),
                'about:blank'
            );

            callback();
        });
        $iframe.appendTo('body');
    }

    assert($iframe1, function () {
        assert($iframe2, function () {
            assert($iframe3, function () {
                $iframe1.remove();
                $iframe2.remove();
                $iframe3.remove();

                start();
            });
        });
    });
});

//// Only Chrome raises 'load' event for iframes with 'javascript:' src and creates window instance
if (Browser.isWebKit) {
    asyncTest('iframe with "javascript:" src', function () {
        var $iframe = $('<iframe id="test3" src="javascript:void(0);">');

        $iframe.bind('load', function () {
            DomAccessorWrappers.init(this.contentWindow, this.contentDocument);

            var hyperlink = this.contentDocument.createElement('a');

            hyperlink.setAttribute('href', '/test');
            this.contentDocument.body.appendChild(hyperlink);

            equal(eval(processScript('hyperlink.href')), 'https://example.com/test');
            equal(eval(processScript('this.contentDocument.location.href')), 'about:blank');

            $iframe.remove();
            start();
        });

        $iframe.appendTo('body');
    });
}

test('iframe', function () {
    var checkProp = function (prop, value) {
        var windowMock                                         = {
            location: UrlUtil.getProxyUrl('http://google.net:90/'),

            top: {
                document: document
            }
        };

        DomAccessorWrappers.init(windowMock, {});
        windowMock[DomAccessorWrappers.LOCATION_WRAPPER][prop] = value;
        equal(UrlUtil.getProxyUrl(windowMock.location).resourceType, UrlUtil.Iframe);
    };

    var checkFunc = function (func, value) {
        var windowMock = {
            location: {
                toString: function () {
                    return UrlUtil.getProxyUrl('http://google.net:90/')
                },

                assign: function (value) {
                    windowMock.location.assign_value = value;
                },

                replace: function (value) {
                    windowMock.location.replace_value = value;
                }
            },

            top: { document: document }
        };

        DomAccessorWrappers.init(windowMock, {});
        windowMock[DomAccessorWrappers.LOCATION_WRAPPER][func](value);
        equal(UrlUtil.getProxyUrl(windowMock.location[func + '_value']).resourceType, UrlUtil.Iframe);
    };

    checkProp('port', 1333);
    checkProp('host', 'google.com:80');
    checkProp('hostname', 'google.com');
    checkProp('pathname', '/index.html');
    checkProp('protocol', 'https:');
    checkProp('href', 'http://google.com');
    checkProp('search', '?param=value');
    checkFunc('assign', 'http://google.com');
    checkFunc('replace', 'http://google.com');
});

asyncTest('cross-domain iframe', function () {
    // Fix it;
    ok(true);
    start();
    return;

    var $iframe    = $('<iframe>');
    var storedPort = Settings.get().CROSS_DOMAIN_PROXY_PORT;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = 1336;

    $iframe[0].src = window.getCrossDomainPageUrl('hammerhead/execute-script.html');

    var handler = function () {
        $iframe.unbind('load', handler);

        $iframe.bind('load', function () {
            equal($iframe[0].contentWindow.location.host, location.host);
            Settings.get().CROSS_DOMAIN_PROXY_PORT = storedPort;
            start();
        });

        var message = 'location.href = "' + location.host + '";';

        eval(DomProcessor.processScript('$iframe[0].contentWindow.postMessage(message, "*");'));
    };

    $iframe.bind('load', handler);
    $iframe.appendTo('body');
});

test('get location origin', function () {
    var locWrapper = getLocation(location);

    equal(locWrapper.origin, 'https://example.com');
});

test('create location wrapper before iframe loading', function () {
    var $iframe = $('<iframe id="test001">').appendTo('body');

    ok(!!eval(processScript('$iframe[0].contentWindow.location')));
    ok(!!eval(processScript('$iframe[0].contentDocument.location')));

    $iframe.remove();
});
