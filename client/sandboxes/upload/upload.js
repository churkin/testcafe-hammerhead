import * as Browser from '../../util/browser';
import * as DOM from '../../util/dom';
import * as Event from '../../util/event';
import * as EventSimulator from '../event/simulator';
import * as Service from '../../util/service';
import * as Listeners from '../event/listeners';
import SharedConst from '../../../shared/const';

var eventEmitter = new Service.EventEmitter();

export const FILE_UPLOADING_EVENT = 'fileUploading';

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

function riseChangeEvent (input) {
    EventSimulator.change(input);
}

function getCurrentInfoManager (input) {
    var contextWindow = input[SharedConst.DOM_SANDBOX_PROCESSED_CONTEXT];

    return contextWindow.Hammerhead._UploadManager;
}

/*eslint-disable max-nested-callbacks */
export function init (window) {
    Listeners.addInternalEventListener(window, ['change'], function (e, dispatched) {
        var input              = e.target || e.srcElement;
        var currentInfoManager = getCurrentInfoManager(input);

        if (DOM.isFileInput(input) && !dispatched) {
            Event.stopPropagation(e);
            Event.preventDefault(e);

            if (!!input.value || !!currentInfoManager.getValue(input)) {
                var fileNames = currentInfoManager.getFileNames(input.files, input.value);

                eventEmitter.emit(FILE_UPLOADING_EVENT, fileNames, input, function (complete) {
                    currentInfoManager.loadFileListData(input, input.files, function (fileList) {
                        currentInfoManager.setUploadInfo(input, fileList, input.value);
                        currentInfoManager.sendFilesInfoToServer(fileList, fileNames, function (errs) {
                            riseChangeEvent(input);
                            complete(errs);
                        });
                    });
                });
            }
        }
    });
}
/*eslint-enable max-nested-callbacks */

export function getFiles (input) {
    return input.files !== void 0 ? getCurrentInfoManager(input).getFiles(input) : void 0;
}

export function getUploadElementValue (input) {
    return getCurrentInfoManager(input).getValue(input);
}

export function setUploadElementValue (input, value) {
    if (value === '') {
        if (getCurrentInfoManager(input).clearUploadInfo(input) && Browser.isIE && Browser.version > 10)
            riseChangeEvent(input);
    }

    return value;
}

export function upload (input, filePaths, callback) {
    var currentInfoManager = getCurrentInfoManager(input);

    filePaths = filePaths || [];

    currentInfoManager.loadFilesInfoFromServer(filePaths, function (filesInfo) {
        currentInfoManager.prepareFileListWrapper(filesInfo, function (errs, fileList) {
            if (!errs.length) {
                var value = currentInfoManager.formatValue(filePaths);

                currentInfoManager.setUploadInfo(input, fileList, value);
                riseChangeEvent(input);
            }

            callback(errs);
        });
    });
}
