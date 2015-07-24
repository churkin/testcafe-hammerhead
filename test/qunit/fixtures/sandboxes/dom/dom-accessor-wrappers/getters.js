var Browser       = Hammerhead.get('./util/browser');
var IFrameSandbox = Hammerhead.get('./sandboxes/iframe');
var NativeMethods = Hammerhead.get('./sandboxes/native-methods');
var ShadowUI      = Hammerhead.get('./sandboxes/shadow-ui');
var UrlUtil       = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

if (!Browser.isIE || Browser.version > 9) {
    test('autocomplete', function () {
        var input  = $('<input>')[0];
        var etalon = NativeMethods.createElement.call(document, 'input');

        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.setAttribute('autocomplete', 'off');
        NativeMethods.setAttribute.call(etalon, 'autocomplete', 'off');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.setAttribute('autocomplete', 'on');
        NativeMethods.setAttribute.call(etalon, 'autocomplete', 'on');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.setAttribute('autocomplete', '');
        NativeMethods.setAttribute.call(etalon, 'autocomplete', '');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');

        input.removeAttribute('autocomplete');
        NativeMethods.removeAttribute.call(etalon, 'autocomplete');
        strictEqual(eval(processScript('input.autocomplete')), etalon.autocomplete);
        strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    });
}

test('url', function () {
    var $scriptWithSrc      = $('<script src="http://some.com/script.js">');
    var $scriptWithEmptySrc = $('<script src="">');
    var $scriptWithoutSrc   = $('<script>');
    var $linkWithOnlyHash   = $('<a href="#hash">');

    var proxyLocation = UrlUtil.OriginLocation.get();

    strictEqual(eval(processScript('$scriptWithSrc[0].src')), 'http://some.com/script.js');
    strictEqual(eval(processScript('$scriptWithEmptySrc[0].src')), proxyLocation);
    strictEqual(eval(processScript('$scriptWithoutSrc[0].src')), '');
    strictEqual(eval(processScript('$linkWithOnlyHash[0].href')), proxyLocation + '#hash');
});

//T123960: Health monitor - change url properties of link not changed stored attribute(xda-developers.com)
test('stored attribute changing after change url', function () {
    var link     = $('<a>')[0];
    var url      = '/path?param=value';
    var proxyUrl = UrlUtil.getProxyUrl(url);

    setProperty(link, 'href', url);
    equal(link.href, proxyUrl);
    equal(getProperty(link, 'href'), UrlUtil.parseProxyUrl(proxyUrl).originUrl);

    eval(processScript('link.pathname="newPath"'));
    ok(/newPath$/.test(getProperty(link, 'pathname')));
    equal(link.href, UrlUtil.getProxyUrl('/newPath?param=value'));
    ok(/\/newPath\?param=value$/.test(getProperty(link, 'href')));
});

test('attributes', function () {
    var link       = $('<a href="http://some.com/" rel="x">')[0];
    var attributes = null;

    eval(processScript('attributes = link.attributes'));
    strictEqual(link.attributes.length, 3);
    strictEqual(attributes.length, 2);
    strictEqual(attributes[0].value, attributes[0].name === 'href' ? 'http://some.com/' : 'x');
    strictEqual(attributes[1].value, attributes[1].name === 'rel' ? 'x' : 'http://some.com/');
    strictEqual(attributes.item(1).value, attributes.item(1).name === 'rel' ? 'x' : 'http://some.com/');
    strictEqual(attributes['href'].value, 'http://some.com/');
    strictEqual(attributes['rel'].value, 'x');
    strictEqual(attributes['ReL'].value, 'x');
    strictEqual(attributes.getNamedItem('rel').value, 'x');

    var div = $('<div attr1="value1" attr2="value2">')[0];

    eval(processScript('attributes = div.attributes'));
    strictEqual(div.attributes, attributes);
});

asyncTest('document properties', function () {
    var $input       = $('<input />').appendTo('body');
    var $shadowInput = $('<input />').appendTo(ShadowUI.getRoot());

    expect(3);

    equal(getProperty(document, 'activeElement'), document.body);

    $shadowInput[0].focus();

    setTimeout(function () {
        equal(getProperty(document, 'activeElement'), document.body);

        $input[0].focus();
        setTimeout(function () {
            $shadowInput[0].focus();

            setTimeout(function () {
                equal(getProperty(document, 'activeElement'), $input[0]);

                $input.remove();
                $shadowInput.remove();

                start();
            }, 0);
        }, 0);
    }, 0);
});

if (Browser.isWebKit) {
    test('url in stylesheet properties', function () {
        var el       = document.createElement('div');
        var url      = 'http://google.com/image.png';
        var proxyUrl = UrlUtil.getProxyUrl(url);

        eval(processScript('el.style.backgroundImage="url(' + url + ')"'));
        equal(getProperty(el.style, 'backgroundImage'), 'url(' + url +
                                                        ')', 'backgroundImage');
        equal(el.style.backgroundImage, 'url(' + proxyUrl + ')', 'backgroundImage');

        eval(processScript('el.style.background="url(' + url + ')"'));
        equal(getProperty(el.style, 'background'), 'url(' + url + ')', 'background');
        equal(el.style.background, 'url(' + proxyUrl + ')', 'background');

        eval(processScript('el.style.listStyle="url(' + url + ')"'));
        equal(getProperty(el.style, 'listStyle'), 'url(' + url + ')', 'listStyle');
        equal(el.style.listStyle, 'url(' + proxyUrl + ')', 'listStyle');

        eval(processScript('el.style.listStyleImage="url(' + url + ')"'));
        equal(getProperty(el.style, 'listStyleImage'), 'url(' + url +
                                                       ')', 'listStyleImage');
        equal(el.style.listStyleImage, 'url(' + proxyUrl + ')', 'listStyleImage');

        eval(processScript('el.style.cssText="background-image: url(' + url + ')"'));
        equal(getProperty(el.style, 'cssText'), 'background-image: url(' + url +
                                                ');', 'cssText');
        equal(el.style.cssText, 'background-image: url(' + proxyUrl + ');', 'cssText');

        eval(processScript('el.style.cursor="url(' + url + '), auto"'));
        equal(getProperty(el.style, 'cursor'), 'url(' + url + '), auto', 'cursor');
        equal(el.style.cursor, 'url(' + proxyUrl + '), auto', 'cursor');
    });
}

