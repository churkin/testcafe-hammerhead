var DomAccessorWrappers = Hammerhead.get('./sandboxes/dom-accessor-wrappers');
var JSProcessor         = Hammerhead.get('../shared/js-processor');

test('wrapped properties equals with accessors properties', function () {
    var elementPropertyAccessorsKeys = Object.keys(DomAccessorWrappers.elementPropertyAccessors);
    var wrappedProperties            = Object.keys(JSProcessor.wrappedProperties);

    equal(elementPropertyAccessorsKeys.length, wrappedProperties.length);

    for (var i = 0; i < wrappedProperties.length; i++)
        ok(elementPropertyAccessorsKeys.indexOf(wrappedProperties[i]) !== -1, wrappedProperties[i])
});
