var DomProcessor = Hammerhead.get('./dom-processor/dom-processor');

asyncTest('cross domain messaging between windows', function () {
    expect(0);

    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('target-url.html');
    document.body.appendChild(iframe);

    var result      = 0;
    var checkResult = function () {
        if (result === 4) {
            iframe.parentNode.removeChild(iframe);
            eval(DomProcessor.processScript("window.onmessage = null;"));
            start();
        }
    };

    var onMessageHandler = function (e) {
        if (e.origin.indexOf('target_url') === -1)
            return;

        if (parseInt(e.data))
            result++;

        checkResult();
    };

    eval(DomProcessor.processScript("window.onmessage = onMessageHandler;"));
});

